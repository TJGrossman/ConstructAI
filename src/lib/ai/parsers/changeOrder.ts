import { LineItem } from "../processor";

export function validateChangeOrderLineItems(items: LineItem[]): LineItem[] {
  return items
    .filter((item) => item.description && item.action)
    .map((item) => {
      const action = (["add", "remove", "modify"].includes(item.action || "")
        ? item.action
        : "add") as "add" | "remove" | "modify";

      // Calculate time cost
      const timeHours = item.timeHours ?? null;
      const timeRate = item.timeRate ?? null;
      const timeCost = timeHours && timeRate ? Math.round(timeHours * timeRate * 100) / 100 : null;

      // Round materials cost
      const materialsCost = item.materialsCost ? Math.round(item.materialsCost * 100) / 100 : null;

      // Calculate total (negative for remove)
      const calculatedTotal = Math.round(((timeCost || 0) + (materialsCost || 0)) * 100) / 100;
      const total = action === "remove" ? -Math.abs(calculatedTotal) : calculatedTotal;

      return {
        ...item,
        action,
        timeHours,
        timeRate,
        timeCost,
        materialsCost,
        total,
      };
    });
}

export function calculateCostImpact(items: LineItem[]): number {
  // Only sum root-level items to avoid double-counting hierarchy
  const rootItems = items.filter((item) => !item.parentId);
  return rootItems.reduce((sum, item) => sum + item.total, 0);
}
