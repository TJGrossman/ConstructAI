import { LineItem } from "../processor";

export function validateInvoiceLineItems(items: LineItem[]): LineItem[] {
  return items
    .filter((item) => item.description && item.quantity > 0 && item.unitPrice >= 0)
    .map((item) => ({
      ...item,
      quantity: Math.round(item.quantity * 100) / 100,
      unitPrice: Math.round(item.unitPrice * 100) / 100,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));
}

export function calculateInvoiceTotals(
  lineItems: LineItem[],
  taxRate: number
) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  return { subtotal, taxAmount, total };
}
