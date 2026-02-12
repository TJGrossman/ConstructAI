import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateInvoiceTotals } from "@/lib/ai/parsers/invoice";
import { LineItem } from "@/lib/ai/processor";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { projectId, lineItems, notes, dueDate } = await req.json();

  if (!projectId || !lineItems?.length) {
    return NextResponse.json(
      { error: "projectId and lineItems are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const taxRate = Number(user?.defaultTaxRate || 0);

  const { subtotal, taxAmount, total } = calculateInvoiceTotals(
    lineItems as LineItem[],
    taxRate
  );

  const lastInvoice = await prisma.invoice.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
  });

  // Calculate due date from payment terms
  let calculatedDueDate = dueDate ? new Date(dueDate) : null;
  if (!calculatedDueDate && user?.paymentTerms) {
    const days = parseInt(user.paymentTerms.replace(/\D/g, "")) || 30;
    calculatedDueDate = new Date();
    calculatedDueDate.setDate(calculatedDueDate.getDate() + days);
  }

  const invoice = await prisma.invoice.create({
    data: {
      projectId,
      number: (lastInvoice?.number || 0) + 1,
      subtotal,
      taxRate,
      taxAmount,
      total,
      dueDate: calculatedDueDate,
      notes: notes || null,
      lineItems: {
        create: (lineItems as LineItem[]).map((item, index) => ({
          description: item.description,
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

  await prisma.auditLog.create({
    data: {
      projectId,
      userId,
      action: "invoice_created",
      entityType: "invoice",
      entityId: invoice.id,
      details: { total },
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { invoiceId, status } = await req.json();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, project: { userId } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      paidAt: status === "paid" ? new Date() : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      projectId: invoice.projectId,
      userId,
      action: `invoice_${status}`,
      entityType: "invoice",
      entityId: invoice.id,
      details: { status },
    },
  });

  return NextResponse.json(updated);
}
