import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateCostImpact } from "@/lib/ai/parsers/changeOrder";
import { LineItem } from "@/lib/ai/processor";

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

  const changeOrder = await prisma.changeOrder.create({
    data: {
      projectId,
      estimateId,
      number: (lastCO?.number || 0) + 1,
      title,
      description: description || title,
      costImpact,
      lineItems: {
        create: (lineItems as LineItem[]).map((item) => ({
          action: item.action || "add",
          description: item.description,
          originalDesc: item.originalDesc || null,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
    },
    include: { lineItems: true },
  });

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

  return NextResponse.json(changeOrder, { status: 201 });
}
