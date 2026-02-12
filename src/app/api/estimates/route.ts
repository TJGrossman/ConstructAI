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
      lineItems: {
        create: (lineItems as LineItem[]).map((item, index) => ({
          catalogItemId: item.catalogItemId || null,
          description: item.description,
          category: item.category || null,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          total: item.total,
          sortOrder: index,
        })),
      },
    },
    include: { lineItems: true },
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

  return NextResponse.json(estimate, { status: 201 });
}
