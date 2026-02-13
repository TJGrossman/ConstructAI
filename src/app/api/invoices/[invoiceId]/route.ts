import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateInvoiceTotals } from "@/lib/ai/parsers/invoice";
import { LineItem } from "@/lib/ai/processor";

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: params.invoiceId,
      project: { userId },
    },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      project: { include: { customer: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(invoice);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const data = await req.json();

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, project: { userId } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Handle line items update if provided
  if (data.lineItems) {
    // Get user's tax rate
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const taxRate = Number(user?.defaultTaxRate || 0);

    // Calculate new totals
    const { subtotal, taxAmount, total } = calculateInvoiceTotals(
      data.lineItems as LineItem[],
      taxRate
    );

    // Delete existing line items
    await prisma.invoiceLineItem.deleteMany({
      where: { invoiceId: params.invoiceId },
    });

    // Recreate line items with hierarchy
    // Process items in order, tracking current parent
    const allItems = data.lineItems as LineItem[];
    let currentParentId: string | null = null;

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const isParent = item.isParent;

      // Parent items have no parentId, children use current parent
      const itemParentId: string | null = isParent ? null : currentParentId;

      const created: { id: string } = await prisma.invoiceLineItem.create({
        data: {
          invoiceId: params.invoiceId,
          estimateLineItemId: item.catalogItemId || null,
          description: item.description,
          category: item.category || null,
          parentId: itemParentId,
          timeHours: item.timeHours ?? null,
          timeRate: item.timeRate ?? null,
          timeCost: item.timeCost ?? null,
          materialsCost: item.materialsCost ?? null,
          total: item.total,
          notes: item.notes || null,
          sortOrder: i,
        },
      });

      // Update current parent when we create a parent item
      if (isParent) {
        currentParentId = created.id;
      }
    }

    // Update invoice totals
    await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: { subtotal, taxAmount, total },
    });
  }

  // Handle status update if provided
  if (data.status) {
    await prisma.invoice.update({
      where: { id: params.invoiceId },
      data: {
        status: data.status,
        paidAt: data.status === "paid" ? new Date() : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        projectId: invoice.projectId,
        userId,
        action: `invoice_${data.status}`,
        entityType: "invoice",
        entityId: invoice.id,
        details: { status: data.status },
      },
    });
  }

  // Fetch and return updated invoice
  const updated = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // Verify invoice ownership
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.invoiceId, project: { userId } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Delete the invoice (cascade will delete line items)
  await prisma.invoice.delete({
    where: { id: params.invoiceId },
  });

  return NextResponse.json({ success: true });
}
