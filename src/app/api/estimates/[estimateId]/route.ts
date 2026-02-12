import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  const updated = await prisma.estimate.update({
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

  return NextResponse.json(updated);
}
