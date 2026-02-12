import { CatalogGenerationResult } from "../processor";

const VALID_CATEGORIES = [
  "demolition",
  "framing",
  "electrical",
  "plumbing",
  "hvac",
  "flooring",
  "tile",
  "painting",
  "cabinets",
  "countertops",
  "roofing",
  "siding",
  "concrete",
  "landscaping",
  "general_labor",
  "materials",
  "other",
];

const VALID_UNITS = ["hour", "sqft", "linear_ft", "each", "flat"];

export function validateCatalogItems(
  items: CatalogGenerationResult[]
): CatalogGenerationResult[] {
  return items
    .filter((item) => item.name && item.defaultRate > 0)
    .map((item) => ({
      ...item,
      category: VALID_CATEGORIES.includes(item.category)
        ? item.category
        : "other",
      unit: VALID_UNITS.includes(item.unit) ? item.unit : "each",
      defaultRate: Math.round(item.defaultRate * 100) / 100,
    }));
}
