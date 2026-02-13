import { LineItem } from "../processor";

export interface LineItemWithId extends LineItem {
  id?: string;
  children?: LineItemWithId[];
}

export interface RollupTotals {
  timeCost: number;
  materialsCost: number;
  total: number;
}

/**
 * Recursively calculates totals for a hierarchical line item structure
 * Parent items get their totals from the sum of their children
 */
export function calculateHierarchicalTotals(
  items: LineItemWithId[]
): Map<string, RollupTotals> {
  const totalsMap = new Map<string, RollupTotals>();

  // Build parent-child relationships
  const itemMap = new Map<string, LineItemWithId>();
  const childrenMap = new Map<string, LineItemWithId[]>();

  items.forEach((item) => {
    if (item.id) {
      itemMap.set(item.id, item);
    }
  });

  items.forEach((item) => {
    if (item.parentId) {
      if (!childrenMap.has(item.parentId)) {
        childrenMap.set(item.parentId, []);
      }
      childrenMap.get(item.parentId)!.push(item);
    }
  });

  // Recursive calculation
  function calculateTotals(item: LineItemWithId): RollupTotals {
    const children = item.id ? childrenMap.get(item.id) || [] : [];

    if (children.length > 0) {
      // Parent: sum children's totals
      const childTotals = children.map((child) => calculateTotals(child));
      const totals = {
        timeCost: childTotals.reduce((sum, t) => sum + t.timeCost, 0),
        materialsCost: childTotals.reduce((sum, t) => sum + t.materialsCost, 0),
        total: childTotals.reduce((sum, t) => sum + t.total, 0),
      };

      if (item.id) {
        totalsMap.set(item.id, totals);
      }
      return totals;
    } else {
      // Leaf: use own costs
      const totals = {
        timeCost: item.timeCost || 0,
        materialsCost: item.materialsCost || 0,
        total: item.total || 0,
      };

      if (item.id) {
        totalsMap.set(item.id, totals);
      }
      return totals;
    }
  }

  // Calculate for all root items
  items.forEach((item) => {
    if (!item.parentId) {
      calculateTotals(item);
    }
  });

  return totalsMap;
}

/**
 * Flattens hierarchical line items into a flat list with calculated parent totals
 */
export function flattenWithTotals(items: LineItemWithId[]): LineItemWithId[] {
  const totalsMap = calculateHierarchicalTotals(items);
  const result: LineItemWithId[] = [];

  // Build hierarchy structure
  const itemMap = new Map<string, LineItemWithId>();
  items.forEach((item) => {
    if (item.id) {
      itemMap.set(item.id, { ...item });
    }
  });

  items.forEach((item) => {
    if (item.id && item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(itemMap.get(item.id)!);
      }
    }
  });

  // Flatten with updated totals
  function flatten(item: LineItemWithId): void {
    const totals = item.id ? totalsMap.get(item.id) : null;
    const updatedItem = {
      ...item,
      timeCost: totals?.timeCost ?? item.timeCost,
      materialsCost: totals?.materialsCost ?? item.materialsCost,
      total: totals?.total ?? item.total,
    };

    result.push(updatedItem);

    if (item.children) {
      item.children.forEach((child) => flatten(child));
    }
  }

  // Flatten root items
  items.forEach((item) => {
    if (!item.parentId) {
      flatten(itemMap.get(item.id!) || item);
    }
  });

  return result;
}

/**
 * Calculates the grand total for all root-level line items
 */
export function calculateGrandTotal(items: LineItemWithId[]): RollupTotals {
  const totalsMap = calculateHierarchicalTotals(items);

  // Sum only root-level items (no parent)
  const rootTotals = items
    .filter((item) => !item.parentId)
    .map((item) => (item.id ? totalsMap.get(item.id) : null))
    .filter((t): t is RollupTotals => t !== null);

  return {
    timeCost: rootTotals.reduce((sum, t) => sum + t.timeCost, 0),
    materialsCost: rootTotals.reduce((sum, t) => sum + t.materialsCost, 0),
    total: rootTotals.reduce((sum, t) => sum + t.total, 0),
  };
}

/**
 * Utility to format cost for display
 */
export function formatCost(cost: number | null | undefined): string {
  if (cost === null || cost === undefined || cost === 0) {
    return "$0.00";
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Utility to format dual time+materials for display
 */
export function formatLineItemCost(item: LineItem): string {
  const parts: string[] = [];

  if (item.timeCost && item.timeCost > 0) {
    parts.push(`Time: ${item.timeHours} hrs @ ${formatCost(item.timeRate)}/hr = ${formatCost(item.timeCost)}`);
  }

  if (item.materialsCost && item.materialsCost > 0) {
    parts.push(`Materials: ${formatCost(item.materialsCost)}`);
  }

  if (parts.length === 0) {
    return `Total: ${formatCost(item.total)}`;
  }

  return parts.join(" | ");
}
