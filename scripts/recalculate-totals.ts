import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function recalculateTotals() {
  console.log('Starting total recalculation...\n');

  try {
    // Recalculate estimates
    const estimates = await prisma.estimate.findMany({
      include: { lineItems: true, project: { include: { user: true } } },
    });

    console.log(`Found ${estimates.length} estimates to recalculate`);

    for (const estimate of estimates) {
      const lineItems = estimate.lineItems;
      const taxRate = Number(estimate.project.user.defaultTaxRate || 0);

      // Determine which items are parent headers (have children)
      const parentIds = new Set(
        lineItems.filter((item) => item.parentId).map((item) => item.parentId)
      );

      const subtotal = lineItems.reduce((sum, item) => {
        // Skip parent headers (items that have children)
        const isParentHeader = !item.parentId && parentIds.has(item.id);
        if (isParentHeader) {
          return sum;
        }
        return sum + Number(item.total);
      }, 0);

      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const total = Math.round((subtotal + taxAmount) * 100) / 100;

      // Update estimate
      await prisma.estimate.update({
        where: { id: estimate.id },
        data: { subtotal, taxAmount, total },
      });

      console.log(
        `✓ Estimate #${estimate.number}: ${estimate.subtotal} → ${subtotal} (subtotal), ${estimate.total} → ${total} (total)`
      );
    }

    // Recalculate invoices
    const invoices = await prisma.invoice.findMany({
      include: { lineItems: true, project: { include: { user: true } } },
    });

    console.log(`\nFound ${invoices.length} invoices to recalculate`);

    for (const invoice of invoices) {
      const lineItems = invoice.lineItems;
      const taxRate = Number(invoice.project.user.defaultTaxRate || 0);

      // Determine which items are parent headers (have children)
      const parentIds = new Set(
        lineItems.filter((item) => item.parentId).map((item) => item.parentId)
      );

      const subtotal = lineItems.reduce((sum, item) => {
        // Skip parent headers (items that have children)
        const isParentHeader = !item.parentId && parentIds.has(item.id);
        if (isParentHeader) {
          return sum;
        }
        return sum + Number(item.total);
      }, 0);

      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const total = Math.round((subtotal + taxAmount) * 100) / 100;

      // Update invoice
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { subtotal, taxAmount, total },
      });

      console.log(
        `✓ Invoice #${invoice.number}: ${invoice.subtotal} → ${subtotal} (subtotal), ${invoice.total} → ${total} (total)`
      );
    }

    console.log('\n✅ Total recalculation complete!');
  } catch (error) {
    console.error('❌ Error recalculating totals:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

recalculateTotals();
