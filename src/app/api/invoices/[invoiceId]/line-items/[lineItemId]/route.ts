import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { invoiceId: string; lineItemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // Verify ownership through invoice -> project -> user
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, project: { userId } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Delete the line item
  await prisma.invoiceLineItem.delete({
    where: { id: params.lineItemId },
  });

  // Recalculate invoice totals
  const remainingItems = await prisma.invoiceLineItem.findMany({
    where: { invoiceId: params.invoiceId },
  });

  const subtotal = remainingItems.reduce((sum, item) => {
    const timeCost = item.timeCost ? Number(item.timeCost) : 0;
    const materialsCost = item.materialsCost ? Number(item.materialsCost) : 0;
    return sum + timeCost + materialsCost;
  }, 0);

  // Get user's tax rate
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const taxRate = Number(user?.defaultTaxRate || 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Update invoice with new totals
  await prisma.invoice.update({
    where: { id: params.invoiceId },
    data: {
      subtotal,
      taxRate,
      taxAmount,
      total,
    },
  });

  return NextResponse.json({ success: true });
}
