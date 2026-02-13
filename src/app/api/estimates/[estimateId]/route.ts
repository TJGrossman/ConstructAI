import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateEstimateTotals } from "@/lib/ai/parsers/estimate";
import { LineItem } from "@/lib/ai/processor";

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { estimateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const estimate = await prisma.estimate.findFirst({
    where: {
      id: params.estimateId,
      project: { userId },
    },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      project: { include: { customer: true } },
      changeOrders: { include: { lineItems: true } },
    },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  return NextResponse.json(estimate);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { estimateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const data = await req.json();

  const estimate = await prisma.estimate.findFirst({
    where: { id: params.estimateId, project: { userId } },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Handle line items update if provided
  if (data.lineItems) {
    // Get user's tax rate
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const taxRate = Number(user?.defaultTaxRate || 0);

    // Calculate new totals
    const { subtotal, taxAmount, total } = calculateEstimateTotals(
      data.lineItems as LineItem[],
      taxRate
    );

    // Delete existing line items
    await prisma.estimateLineItem.deleteMany({
      where: { estimateId: params.estimateId },
    });

    // Recreate line items with hierarchy
    // First pass: create parents and track their old->new ID mapping
    const allItems = data.lineItems as LineItem[];
    const parentIdMap = new Map<string, string>(); // old parentId -> new parentId

    // Create parent items first
    const parentItems = allItems.filter(item => item.isParent);
    for (let i = 0; i < parentItems.length; i++) {
      const item = parentItems[i];
      const created: { id: string } = await prisma.estimateLineItem.create({
        data: {
          estimateId: params.estimateId,
          catalogItemId: item.catalogItemId || null,
          description: item.description,
          category: item.category || null,
          parentId: null,
          timeHours: item.timeHours ?? null,
          timeRate: item.timeRate ?? null,
          timeCost: item.timeCost ?? null,
          materialsCost: item.materialsCost ?? null,
          total: item.total,
          notes: item.notes || null,
          sortOrder: allItems.indexOf(item),
        },
      });

      // Map old parent ID to new parent ID
      if (item.parentId) {
        parentIdMap.set(item.parentId, created.id);
      }
      // Also map by description as fallback
      parentIdMap.set(item.description, created.id);
    }

    // Second pass: create children with correct parent references
    const childItems = allItems.filter(item => !item.isParent);
    for (const item of childItems) {
      // Find the correct parent ID
      let newParentId: string | null = null;
      if (item.parentId) {
        newParentId = parentIdMap.get(item.parentId) || null;
      }

      // If not found by ID, find parent by looking backwards in original array
      if (!newParentId) {
        const itemIndex = allItems.indexOf(item);
        for (let i = itemIndex - 1; i >= 0; i--) {
          if (allItems[i].isParent) {
            newParentId = parentIdMap.get(allItems[i].description) || null;
            break;
          }
        }
      }

      await prisma.estimateLineItem.create({
        data: {
          estimateId: params.estimateId,
          catalogItemId: item.catalogItemId || null,
          description: item.description,
          category: item.category || null,
          parentId: newParentId,
          timeHours: item.timeHours ?? null,
          timeRate: item.timeRate ?? null,
          timeCost: item.timeCost ?? null,
          materialsCost: item.materialsCost ?? null,
          total: item.total,
          notes: item.notes || null,
          sortOrder: allItems.indexOf(item),
        },
      });
    }

    // Update estimate totals
    await prisma.estimate.update({
      where: { id: params.estimateId },
      data: { subtotal, taxAmount, total },
    });
  }

  // Handle status update if provided
  if (data.status) {
    await prisma.estimate.update({
      where: { id: params.estimateId },
      data: {
        status: data.status,
        sentAt: data.status === "sent" ? new Date() : undefined,
        approvedAt: data.status === "approved" ? new Date() : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        projectId: estimate.projectId,
        userId,
        action: `estimate_${data.status}`,
        entityType: "estimate",
        entityId: estimate.id,
        details: { status: data.status },
      },
    });
  }

  // Fetch and return updated estimate
  const updated = await prisma.estimate.findUnique({
    where: { id: params.estimateId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(updated);
}
