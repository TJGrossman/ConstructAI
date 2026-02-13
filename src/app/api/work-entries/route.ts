import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { projectId, workEntries } = await req.json();

    console.log('[Work Entries] Received:', { projectId, workEntriesCount: workEntries?.length, workEntries });

    if (!projectId || !workEntries?.length) {
      return NextResponse.json(
        { error: "projectId and workEntries are required" },
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

  // Get or create draft invoice for this project
  let invoice = await prisma.invoice.findFirst({
    where: { projectId, status: "draft" },
    include: { lineItems: true },
  });

  if (!invoice) {
    // Create new draft invoice
    const lastInvoice = await prisma.invoice.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
    });

    invoice = await prisma.invoice.create({
      data: {
        projectId,
        number: (lastInvoice?.number || 0) + 1,
        status: "draft",
        subtotal: 0,
        taxRate: 0,
        taxAmount: 0,
        total: 0,
      },
      include: { lineItems: true },
    });
  }

  // Add work entries to invoice
  for (const entry of workEntries) {
    console.log('[Work Entry] Processing entry:', entry);

    const estimateLineItem = await prisma.estimateLineItem.findUnique({
      where: { id: entry.estimateLineItemId },
    });

    console.log('[Work Entry] Found estimate line item:', estimateLineItem);

    if (!estimateLineItem) {
      console.log('[Work Entry] Skipping - estimate line item not found for ID:', entry.estimateLineItemId);
      continue; // Skip if estimate line item not found
    }

    // If estimate item has a parent, ensure parent exists in invoice
    let invoiceParentId: string | null = null;
    if (estimateLineItem.parentId) {
      // Check if parent invoice line item already exists
      const existingParent = invoice.lineItems.find(
        (item) => item.estimateLineItemId === estimateLineItem.parentId
      );

      if (existingParent) {
        invoiceParentId = existingParent.id;
      } else {
        // Create parent invoice line item (grouping header with $0 cost)
        const estimateParent = await prisma.estimateLineItem.findUnique({
          where: { id: estimateLineItem.parentId },
        });

        if (estimateParent) {
          const createdParent = await prisma.invoiceLineItem.create({
            data: {
              invoiceId: invoice.id,
              estimateLineItemId: estimateParent.id,
              description: estimateParent.description,
              category: estimateParent.category,
              parentId: null, // Parents are top-level
              timeHours: null,
              timeRate: null,
              timeCost: null,
              materialsCost: null,
              total: 0, // Parent total will be calculated from children
              notes: null,
              sortOrder: invoice.lineItems.length,
            },
          });
          invoiceParentId = createdParent.id;
          console.log('[Work Entry] Created parent invoice line item:', createdParent);
        }
      }
    }

    // Check if this line item already has an invoice entry
    const existingInvoiceItem = invoice.lineItems.find(
      (item) => item.estimateLineItemId === entry.estimateLineItemId
    );

    if (existingInvoiceItem) {
      // Update existing invoice line item
      await prisma.invoiceLineItem.update({
        where: { id: existingInvoiceItem.id },
        data: {
          timeHours: entry.actualTimeHours ? Number(entry.actualTimeHours) : null,
          timeRate: entry.actualTimeRate ? Number(entry.actualTimeRate) : null,
          timeCost: entry.actualTimeCost ? Number(entry.actualTimeCost) : null,
          materialsCost: entry.actualMaterialsCost ? Number(entry.actualMaterialsCost) : null,
          total: Number(entry.actualTotal),
          notes: entry.notes || null,
        },
      });
    } else {
      // Create new invoice line item (preserving hierarchy from estimate)
      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          estimateLineItemId: entry.estimateLineItemId,
          description: entry.description || estimateLineItem.description,
          category: estimateLineItem.category,
          parentId: invoiceParentId, // Link to parent if it exists
          timeHours: entry.actualTimeHours ? Number(entry.actualTimeHours) : null,
          timeRate: entry.actualTimeRate ? Number(entry.actualTimeRate) : null,
          timeCost: entry.actualTimeCost ? Number(entry.actualTimeCost) : null,
          materialsCost: entry.actualMaterialsCost ? Number(entry.actualMaterialsCost) : null,
          total: Number(entry.actualTotal),
          notes: entry.notes || null,
          sortOrder: invoice.lineItems.length,
        },
      });
    }
  }

  // Recalculate invoice totals
  const allLineItems = await prisma.invoiceLineItem.findMany({
    where: { invoiceId: invoice.id },
  });

  console.log('[Work Entry] All invoice line items:', allLineItems.map(item => ({
    id: item.id,
    description: item.description,
    total: item.total,
    parentId: item.parentId,
    estimateLineItemId: item.estimateLineItemId
  })));

  // Sum only child items (items with parentId) to avoid counting parent headers
  // Parent headers are created with $0 total, but let's be explicit
  const subtotal = allLineItems.reduce((sum, item) => {
    // Skip parent items (items without parentId are grouping headers)
    if (!item.parentId) {
      console.log(`[Work Entry] Skipping parent item: ${item.description}`);
      return sum;
    }
    console.log(`[Work Entry] Adding child item total: ${item.total}, running sum: ${sum + Number(item.total)}`);
    return sum + Number(item.total);
  }, 0);

  console.log('[Work Entry] Calculated subtotal:', subtotal);

  // Get user's tax rate
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const taxRate = Number(user?.defaultTaxRate || 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Update invoice totals
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      subtotal,
      taxRate,
      taxAmount,
      total,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId,
      userId,
      action: "work_entry_created",
      entityType: "invoice",
      entityId: invoice.id,
      details: { workEntries },
    },
  });

  // Fetch updated invoice
  const updatedInvoice = await prisma.invoice.findUnique({
    where: { id: invoice.id },
    include: { lineItems: true },
  });

  return NextResponse.json(updatedInvoice, { status: 201 });
  } catch (error) {
    console.error('[Work Entries] Error:', error);
    return NextResponse.json(
      {
        error: "Failed to create work entries",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
