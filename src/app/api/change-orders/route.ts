import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateCostImpact } from "@/lib/ai/parsers/changeOrder";
import { LineItem } from "@/lib/ai/processor";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { projectId, estimateId, title, description, lineItems } =
    await req.json();

  if (!projectId || !estimateId || !title || !lineItems?.length) {
    return NextResponse.json(
      { error: "projectId, estimateId, title, and lineItems are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const costImpact = calculateCostImpact(lineItems as LineItem[]);

  const lastCO = await prisma.changeOrder.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
  });

  // Create change order with hierarchical line items
  const changeOrder = await prisma.changeOrder.create({
    data: {
      projectId,
      estimateId,
      number: (lastCO?.number || 0) + 1,
      title,
      description: description || title,
      costImpact,
    },
  });

  // Create parent items first, then children (similar to estimate creation)
  const itemsWithIds = new Map<number, string>();
  const parentItems = (lineItems as LineItem[]).filter((item) => item.isParent);
  const childItems = (lineItems as LineItem[]).filter((item) => !item.isParent);

  // Create parent items
  for (let i = 0; i < parentItems.length; i++) {
    const item = parentItems[i];
    const created = await prisma.changeOrderLineItem.create({
      data: {
        changeOrderId: changeOrder.id,
        action: item.action || "add",
        description: item.description,
        originalDesc: item.originalDesc || null,
        category: item.category || null,
        timeHours: item.timeHours ?? null,
        timeRate: item.timeRate ?? null,
        timeCost: item.timeCost ?? null,
        materialsCost: item.materialsCost ?? null,
        total: item.total,
        notes: item.notes || null,
      },
    });
    itemsWithIds.set(i, created.id);
  }

  // Create child items
  const allItems = lineItems as LineItem[];
  for (let i = 0; i < childItems.length; i++) {
    const item = childItems[i];
    const originalIndex = allItems.indexOf(item);
    let parentId: string | null = null;

    // Find the last parent item before this child in the original array
    for (let j = originalIndex - 1; j >= 0; j--) {
      if (allItems[j].isParent) {
        const parentIndex = parentItems.indexOf(allItems[j]);
        parentId = itemsWithIds.get(parentIndex) || null;
        break;
      }
    }

    await prisma.changeOrderLineItem.create({
      data: {
        changeOrderId: changeOrder.id,
        action: item.action || "add",
        description: item.description,
        originalDesc: item.originalDesc || null,
        category: item.category || null,
        parentId,
        timeHours: item.timeHours ?? null,
        timeRate: item.timeRate ?? null,
        timeCost: item.timeCost ?? null,
        materialsCost: item.materialsCost ?? null,
        total: item.total,
        notes: item.notes || null,
      },
    });
  }

  // Fetch complete change order
  const completeChangeOrder = await prisma.changeOrder.findUnique({
    where: { id: changeOrder.id },
    include: { lineItems: true },
  });

  // Get current estimate state and create new version
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: { lineItems: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });

  if (estimate) {
    const nextVersion = (estimate.versions[0]?.versionNumber || 1) + 1;

    // Update estimate totals with cost impact
    const newSubtotal = Number(estimate.subtotal) + costImpact;
    const newTaxAmount = Math.round(newSubtotal * (Number(estimate.taxRate) / 100) * 100) / 100;
    const newTotal = Math.round((newSubtotal + newTaxAmount) * 100) / 100;

    await prisma.estimate.update({
      where: { id: estimateId },
      data: {
        subtotal: newSubtotal,
        taxAmount: newTaxAmount,
        total: newTotal,
      },
    });

    // Create version snapshot
    await prisma.estimateVersion.create({
      data: {
        estimateId,
        versionNumber: nextVersion,
        changeOrderId: changeOrder.id,
        lineItemsSnapshot: estimate.lineItems,
        subtotal: newSubtotal,
        taxRate: estimate.taxRate,
        taxAmount: newTaxAmount,
        total: newTotal,
        notes: `Change order: ${title}`,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      projectId,
      userId,
      action: "change_order_created",
      entityType: "change_order",
      entityId: changeOrder.id,
      details: { title, costImpact },
    },
  });

  return NextResponse.json(completeChangeOrder, { status: 201 });
}
