import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Plus, FolderOpen } from "lucide-react";

export const dynamic = 'force-dynamic';

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-red-100 text-red-700",
};

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id: string })?.id;

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      customer: true,
      _count: { select: { estimates: true, invoices: true, changeOrders: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16">
          <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to start generating estimates.
          </p>
          <Link
            href="/dashboard/projects/new"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="rounded-lg border bg-card p-5 transition-colors hover:bg-accent"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="font-semibold">{project.name}</h3>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[project.status] || statusColors.active}`}
                >
                  {project.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {project.customer.name}
              </p>
              {project.address && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {project.address}
                </p>
              )}
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                <span>{project._count.estimates} estimates</span>
                <span>{project._count.changeOrders} COs</span>
                <span>{project._count.invoices} invoices</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
