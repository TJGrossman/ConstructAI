import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/work-entries/[id]
 * Update work entry (approve/reject or modify)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { id } = params;
  const data = await req.json();

  // Verify work entry exists and user has access
  const workEntry = await prisma.workEntry.findFirst({
    where: {
      id,
      receipt: {
        project: { userId },
      },
    },
    include: {
      receipt: true,
    },
  });

  if (!workEntry) {
    return NextResponse.json({ error: "Work entry not found" }, { status: 404 });
  }

  // Update work entry
  const updated = await prisma.workEntry.update({
    where: { id },
    data: {
      status: data.status || workEntry.status,
      actualTimeHours: data.actualTimeHours ?? workEntry.actualTimeHours,
      actualTimeRate: data.actualTimeRate ?? workEntry.actualTimeRate,
      actualTimeCost: data.actualTimeCost ?? workEntry.actualTimeCost,
      actualMaterialsCost: data.actualMaterialsCost ?? workEntry.actualMaterialsCost,
      actualTotal: data.actualTotal ?? workEntry.actualTotal,
      notes: data.notes ?? workEntry.notes,
    },
    include: {
      receipt: true,
      estimateLineItem: {
        select: {
          id: true,
          description: true,
          timeCost: true,
          materialsCost: true,
          total: true,
        },
      },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId: workEntry.receipt.projectId,
      userId,
      action: "work_entry_updated",
      entityType: "work_entry",
      entityId: id,
      details: { status: data.status },
    },
  });

  return NextResponse.json({ workEntry: updated }, { status: 200 });
}

/**
 * DELETE /api/work-entries/[id]
 * Delete a work entry
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { id } = params;

  // Verify work entry exists and user has access
  const workEntry = await prisma.workEntry.findFirst({
    where: {
      id,
      receipt: {
        project: { userId },
      },
    },
    include: {
      receipt: true,
    },
  });

  if (!workEntry) {
    return NextResponse.json({ error: "Work entry not found" }, { status: 404 });
  }

  await prisma.workEntry.delete({ where: { id } });

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId: workEntry.receipt.projectId,
      userId,
      action: "work_entry_deleted",
      entityType: "work_entry",
      entityId: id,
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
