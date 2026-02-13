import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateEstimateTotals } from "@/lib/ai/parsers/estimate";
import { LineItem } from "@/lib/ai/processor";

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { status, title, lineItems, notes } = await req.json();

  // Verify ownership
  const estimate = await prisma.estimate.findFirst({
    where: { id: params.id, project: { userId } },
    include: { project: true },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // If updating line items, recalculate totals
  let updateData: Record<string, unknown> = {};

  if (status !== undefined) {
    updateData.status = status;
  }

  if (title !== undefined) {
    updateData.title = title;
  }

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  if (lineItems) {
    // Get user's tax rate
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const taxRate = Number(user?.defaultTaxRate || 0);

    // Calculate new totals
    const { subtotal, taxAmount, total } = calculateEstimateTotals(
      lineItems as LineItem[],
      taxRate
    );

    updateData = {
      ...updateData,
      subtotal,
      taxAmount,
      total,
    };

    // Delete existing line items
    await prisma.estimateLineItem.deleteMany({
      where: { estimateId: params.id },
    });

    // Recreate line items with hierarchy
    const allItems = lineItems as LineItem[];
    let currentParentId: string | null = null;

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const parentId: string | null = item.isParent ? null : currentParentId;

      const created = await prisma.estimateLineItem.create({
        data: {
          estimateId: params.id,
          catalogItemId: item.catalogItemId || null,
          description: item.description,
          category: item.category || null,
          parentId,
          timeHours: item.timeHours ?? null,
          timeRate: item.timeRate ?? null,
          timeCost: item.timeCost ?? null,
          materialsCost: item.materialsCost ?? null,
          total: item.total,
          notes: item.notes || null,
          sortOrder: i,
        },
      });

      if (item.isParent) {
        currentParentId = created.id;
      }
    }

    // Create new version snapshot
    const versionCount = await prisma.estimateVersion.count({
      where: { estimateId: params.id },
    });

    const updatedEstimate = await prisma.estimate.findUnique({
      where: { id: params.id },
      include: { lineItems: true },
    });

    await prisma.estimateVersion.create({
      data: {
        estimateId: params.id,
        versionNumber: versionCount + 1,
        lineItemsSnapshot: updatedEstimate!.lineItems,
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes: "Estimate updated",
      },
    });
  }

  // Update the estimate
  const updated = await prisma.estimate.update({
    where: { id: params.id },
    data: updateData,
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId: estimate.projectId,
      userId,
      action: "estimate_updated",
      entityType: "estimate",
      entityId: params.id,
      details: updateData,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // Verify ownership
  const estimate = await prisma.estimate.findFirst({
    where: { id: params.id, project: { userId } },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Delete the estimate (cascades to line items and versions)
  await prisma.estimate.delete({
    where: { id: params.id },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId: estimate.projectId,
      userId,
      action: "estimate_deleted",
      entityType: "estimate",
      entityId: params.id,
      details: { title: estimate.title },
    },
  });

  return NextResponse.json({ success: true });
}
