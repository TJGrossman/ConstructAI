import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { estimateId: string; lineItemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // Verify estimate ownership
  const estimate = await prisma.estimate.findFirst({
    where: { id: params.estimateId, project: { userId } },
    include: { lineItems: true },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Delete the line item
  await prisma.estimateLineItem.delete({
    where: { id: params.lineItemId },
  });

  // Recalculate estimate totals
  const remainingItems = await prisma.estimateLineItem.findMany({
    where: { estimateId: params.estimateId },
  });

  const subtotal = remainingItems.reduce((sum, item) => {
    const timeCost = item.timeCost ? parseFloat(item.timeCost as string) : 0;
    const materialsCost = item.materialsCost ? parseFloat(item.materialsCost as string) : 0;
    return sum + timeCost + materialsCost;
  }, 0);

  const taxRate = parseFloat(estimate.taxRate as string);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Update estimate totals
  await prisma.estimate.update({
    where: { id: params.estimateId },
    data: {
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      total: total.toString(),
    },
  });

  return NextResponse.json({ success: true });
}
