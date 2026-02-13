import { LineItem } from "../processor";
import { validateLineItems } from "../validators/lineItem";

/**
 * Validates and normalizes estimate line items for the new dual time+materials structure
 */
export function validateEstimateLineItems(items: LineItem[]): LineItem[] {
  // First validate with the new validators
  const validationResult = validateLineItems(items);
  if (!validationResult.isValid) {
    throw new Error(`Line item validation failed: ${validationResult.errors.join(", ")}`);
  }

  return items
    .filter((item) => item.description)
    .map((item) => {
      // Calculate time cost if time fields are present
      const timeHours = item.timeHours ?? null;
      const timeRate = item.timeRate ?? null;
      const timeCost = timeHours && timeRate ? Math.round(timeHours * timeRate * 100) / 100 : null;

      // Round materials cost
      const materialsCost = item.materialsCost ? Math.round(item.materialsCost * 100) / 100 : null;

      // Calculate total
      const total = Math.round(((timeCost || 0) + (materialsCost || 0)) * 100) / 100;

      return {
        ...item,
        timeHours,
        timeRate,
        timeCost,
        materialsCost,
        total,
      };
    });
}

/**
 * Calculates estimate totals from hierarchical line items
 * Sums all leaf items (items without children)
 * Parent headers always have $0 total, so we can safely sum all items
 */
export function calculateEstimateTotals(
  lineItems: LineItem[],
  taxRate: number
) {
  // Sum all items - parent headers have $0 total, so no double-counting
  // This handles both hierarchical (parent/child) and flat structures
  const subtotal = lineItems.reduce((sum, item) => {
    // Skip parent items (they're grouping headers with no cost)
    if (item.isParent) return sum;
    return sum + item.total;
  }, 0);

  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  return { subtotal, taxAmount, total };
}
