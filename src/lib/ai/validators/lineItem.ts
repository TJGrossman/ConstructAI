import { LineItem } from "../processor";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates that a line item has at least one non-zero cost component
 * (either timeCost or materialsCost)
 */
export function validateDualStructure(item: LineItem): ValidationResult {
  const errors: string[] = [];

  // Parent/grouping items can have zero costs (calculated from children)
  if (item.isParent) {
    return { isValid: true, errors: [] };
  }

  const hasTimeCost = item.timeCost !== null && item.timeCost !== undefined && item.timeCost > 0;
  const hasMaterialsCost = item.materialsCost !== null && item.materialsCost !== undefined && item.materialsCost > 0;

  if (!hasTimeCost && !hasMaterialsCost) {
    errors.push(
      `Line item "${item.description}" must have either time cost or materials cost (or both)`
    );
  }

  // Validate time consistency
  if (hasTimeCost) {
    if (!item.timeHours || item.timeHours <= 0) {
      errors.push(`Line item "${item.description}" has time cost but missing or invalid timeHours`);
    }
    if (!item.timeRate || item.timeRate <= 0) {
      errors.push(`Line item "${item.description}" has time cost but missing or invalid timeRate`);
    }
    // Check if timeCost matches timeHours * timeRate (with small tolerance for rounding)
    const expectedTimeCost = (item.timeHours || 0) * (item.timeRate || 0);
    const tolerance = 0.01;
    if (Math.abs(expectedTimeCost - (item.timeCost || 0)) > tolerance) {
      errors.push(
        `Line item "${item.description}" has inconsistent time calculation: ${item.timeHours} hrs × $${item.timeRate}/hr should equal $${expectedTimeCost}, but got $${item.timeCost}`
      );
    }
  }

  // Validate total consistency
  const expectedTotal = (item.timeCost || 0) + (item.materialsCost || 0);
  const tolerance = 0.01;
  if (Math.abs(expectedTotal - item.total) > tolerance) {
    errors.push(
      `Line item "${item.description}" has inconsistent total: timeCost ($${item.timeCost || 0}) + materialsCost ($${item.materialsCost || 0}) should equal $${expectedTotal}, but got $${item.total}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates hierarchy depth (currently limited to 2 levels)
 */
export function validateHierarchyDepth(
  items: LineItem[],
  maxDepth: number = 2
): ValidationResult {
  const errors: string[] = [];

  // Build parent-child map
  const parentMap = new Map<string | undefined, LineItem[]>();
  items.forEach((item) => {
    const parentId = item.parentId;
    if (!parentMap.has(parentId)) {
      parentMap.set(parentId, []);
    }
    parentMap.get(parentId)!.push(item);
  });

  // Check depth recursively
  function checkDepth(item: LineItem, currentDepth: number, itemIndex: number): void {
    if (currentDepth > maxDepth) {
      errors.push(
        `Line item "${item.description}" exceeds maximum hierarchy depth of ${maxDepth} levels`
      );
      return;
    }

    // Use a temporary ID for validation (would be actual ID in real data)
    const tempId = `temp_${itemIndex}`;
    const children = parentMap.get(tempId) || [];
    children.forEach((child, idx) => checkDepth(child, currentDepth + 1, idx));
  }

  // Start from root items (no parent)
  const rootItems = parentMap.get(undefined) || [];
  rootItems.forEach((item, idx) => checkDepth(item, 1, idx));

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates all line items in a collection
 */
export function validateLineItems(items: LineItem[]): ValidationResult {
  const allErrors: string[] = [];

  // Validate each item's dual structure
  items.forEach((item) => {
    const result = validateDualStructure(item);
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  });

  // Validate hierarchy depth
  const hierarchyResult = validateHierarchyDepth(items);
  if (!hierarchyResult.isValid) {
    allErrors.push(...hierarchyResult.errors);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}
