import { LineItem } from "../processor";

export function validateChangeOrderLineItems(items: LineItem[]): LineItem[] {
  return items
    .filter((item) => item.description && item.action)
    .map((item) => ({
      ...item,
      action: (["add", "remove", "modify"].includes(item.action || "")
        ? item.action
        : "add") as "add" | "remove" | "modify",
      quantity: Math.round(item.quantity * 100) / 100,
      unitPrice: Math.round(item.unitPrice * 100) / 100,
      total:
        item.action === "remove"
          ? -Math.abs(Math.round(item.quantity * item.unitPrice * 100) / 100)
          : Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));
}

export function calculateCostImpact(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.total, 0);
}
