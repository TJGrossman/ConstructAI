import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { FolderOpen, FileText, Receipt, Plus } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id: string })?.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          projects: true,
          catalogItems: true,
        },
      },
    },
  });

  if (user && !user.onboardingDone) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-2xl font-bold">Welcome to ConstructAI!</h1>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s set up your service catalog to get started.
        </p>
        <Link
          href="/dashboard/onboarding"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Get Started
        </Link>
      </div>
    );
  }

  const recentProjects = await prisma.project.findMany({
    where: { userId },
    include: {
      customer: true,
      _count: { select: { estimates: true, invoices: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const stats = await Promise.all([
    prisma.project.count({ where: { userId, status: "active" } }),
    prisma.estimate.count({
      where: { project: { userId }, status: "draft" },
    }),
    prisma.invoice.count({
      where: { project: { userId }, status: "sent" },
    }),
  ]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats[0]}</p>
              <p className="text-sm text-muted-foreground">Active Projects</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats[1]}</p>
              <p className="text-sm text-muted-foreground">Draft Estimates</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats[2]}</p>
              <p className="text-sm text-muted-foreground">
                Outstanding Invoices
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Recent Projects</h2>
        {recentProjects.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">No projects yet.</p>
            <Link
              href="/dashboard/projects/new"
              className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
            >
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {project.customer.name}
                      {project.address && ` — ${project.address}`}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>
                      {project._count.estimates} estimate
                      {project._count.estimates !== 1 ? "s" : ""}
                    </p>
                    <p>
                      {project._count.invoices} invoice
                      {project._count.invoices !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
