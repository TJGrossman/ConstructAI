import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch audit logs
  const logs = await prisma.auditLog.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Fetch estimate versions (to show estimate updates in timeline)
  const estimates = await prisma.estimate.findMany({
    where: { projectId: params.projectId },
    include: {
      versions: {
        include: {
          changeOrder: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Convert estimate versions to timeline events
  const versionEvents = estimates.flatMap((estimate) =>
    estimate.versions.map((version) => ({
      id: version.id,
      action: version.versionNumber === 1 ? "estimate_created" : "estimate_updated",
      entityType: "estimate",
      entityId: estimate.id,
      createdAt: version.createdAt.toISOString(),
      details: {
        estimateNumber: estimate.number,
        estimateTitle: estimate.title,
        versionNumber: version.versionNumber,
        changeOrderId: version.changeOrderId,
        changeOrderTitle: version.changeOrder?.title,
        changeOrderNumber: version.changeOrder?.number,
        total: version.total.toString(),
        notes: version.notes,
      },
    }))
  );

  // Merge and sort all events by date
  const allEvents = [...logs, ...versionEvents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json(allEvents);
}
