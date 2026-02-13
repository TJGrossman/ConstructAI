import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateEstimateTotals } from "@/lib/ai/parsers/estimate";
import { LineItem } from "@/lib/ai/processor";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { projectId, title, lineItems, notes } = await req.json();

  if (!projectId || !title || !lineItems?.length) {
    return NextResponse.json(
      { error: "projectId, title, and lineItems are required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get user's tax rate
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const taxRate = Number(user?.defaultTaxRate || 0);

  // Calculate totals
  const { subtotal, taxAmount, total } = calculateEstimateTotals(
    lineItems as LineItem[],
    taxRate
  );

  // Get next estimate number
  const lastEstimate = await prisma.estimate.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
  });

  // Create estimate with line items (parents first, then children)
  const estimate = await prisma.estimate.create({
    data: {
      projectId,
      number: (lastEstimate?.number || 0) + 1,
      title,
      subtotal,
      taxRate,
      taxAmount,
      total,
      notes: notes || null,
    },
  });

  // Create parent items first, then children
  const itemsWithIds = new Map<number, string>();
  const parentItems = (lineItems as LineItem[]).filter((item) => item.isParent);
  const childItems = (lineItems as LineItem[]).filter((item) => !item.isParent);

  // Create parent items
  for (let i = 0; i < parentItems.length; i++) {
    const item = parentItems[i];
    const created = await prisma.estimateLineItem.create({
      data: {
        estimateId: estimate.id,
        catalogItemId: item.catalogItemId || null,
        description: item.description,
        category: item.category || null,
        timeHours: item.timeHours ?? null,
        timeRate: item.timeRate ?? null,
        timeCost: item.timeCost ?? null,
        materialsCost: item.materialsCost ?? null,
        total: item.total,
        notes: item.notes || null,
        sortOrder: i,
      },
    });
    itemsWithIds.set(i, created.id);
  }

  // Create child items (tracking parent indices for hierarchy)
  const allItems = lineItems as LineItem[];
  for (let i = 0; i < childItems.length; i++) {
    const item = childItems[i];
    // Find parent index if this is a child
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

    await prisma.estimateLineItem.create({
      data: {
        estimateId: estimate.id,
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
        sortOrder: parentItems.length + i,
      },
    });
  }

  // Fetch the complete estimate with line items
  const completeEstimate = await prisma.estimate.findUnique({
    where: { id: estimate.id },
    include: { lineItems: true },
  });

  // Create initial version snapshot
  await prisma.estimateVersion.create({
    data: {
      estimateId: estimate.id,
      versionNumber: 1,
      lineItemsSnapshot: completeEstimate!.lineItems,
      subtotal,
      taxRate,
      taxAmount,
      total,
      notes: "Initial estimate version",
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId,
      userId,
      action: "estimate_created",
      entityType: "estimate",
      entityId: estimate.id,
      details: { title, total },
    },
  });

  return NextResponse.json(completeEstimate, { status: 201 });
}
