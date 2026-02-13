import { WorkEntryItem } from "../processor";

export interface WorkEntryValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a work entry item
 */
export function validateWorkEntry(entry: WorkEntryItem): WorkEntryValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!entry.estimateLineItemId) {
    errors.push("Work entry must reference an estimate line item");
  }

  if (!entry.description || entry.description.trim().length === 0) {
    errors.push("Work entry must have a description");
  }

  if (!entry.actualTotal || entry.actualTotal <= 0) {
    errors.push("Work entry must have a positive actual total cost");
  }

  // Validate at least one cost component
  const hasTimeCost = entry.actualTimeCost !== null && entry.actualTimeCost !== undefined && entry.actualTimeCost > 0;
  const hasMaterialsCost = entry.actualMaterialsCost !== null && entry.actualMaterialsCost !== undefined && entry.actualMaterialsCost > 0;

  if (!hasTimeCost && !hasMaterialsCost) {
    errors.push("Work entry must have either actual time cost or materials cost (or both)");
  }

  // Validate time consistency
  if (hasTimeCost) {
    if (!entry.actualTimeHours || entry.actualTimeHours <= 0) {
      errors.push("Work entry has time cost but missing or invalid actualTimeHours");
    }
    if (!entry.actualTimeRate || entry.actualTimeRate <= 0) {
      errors.push("Work entry has time cost but missing or invalid actualTimeRate");
    }
    // Check if actualTimeCost matches actualTimeHours * actualTimeRate
    const expectedTimeCost = (entry.actualTimeHours || 0) * (entry.actualTimeRate || 0);
    const tolerance = 0.01;
    if (Math.abs(expectedTimeCost - (entry.actualTimeCost || 0)) > tolerance) {
      errors.push(
        `Work entry has inconsistent time calculation: ${entry.actualTimeHours} hrs × $${entry.actualTimeRate}/hr should equal $${expectedTimeCost}, but got $${entry.actualTimeCost}`
      );
    }
  }

  // Validate total consistency
  const expectedTotal = (entry.actualTimeCost || 0) + (entry.actualMaterialsCost || 0);
  const tolerance = 0.01;
  if (Math.abs(expectedTotal - entry.actualTotal) > tolerance) {
    errors.push(
      `Work entry has inconsistent total: actualTimeCost ($${entry.actualTimeCost || 0}) + actualMaterialsCost ($${entry.actualMaterialsCost || 0}) should equal $${expectedTotal}, but got $${entry.actualTotal}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a collection of work entries
 */
export function validateWorkEntries(entries: WorkEntryItem[]): WorkEntryValidationResult {
  const allErrors: string[] = [];

  if (!entries || entries.length === 0) {
    allErrors.push("At least one work entry is required");
    return {
      isValid: false,
      errors: allErrors,
    };
  }

  entries.forEach((entry, index) => {
    const result = validateWorkEntry(entry);
    if (!result.isValid) {
      result.errors.forEach((error) => {
        allErrors.push(`Work entry ${index + 1}: ${error}`);
      });
    }
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Calculates variance between estimated and actual costs
 */
export function calculateVariance(
  estimatedTotal: number,
  actualTotal: number
): {
  variance: number;
  variancePercent: number;
  isOverBudget: boolean;
} {
  const variance = actualTotal - estimatedTotal;
  const variancePercent = estimatedTotal > 0 ? (variance / estimatedTotal) * 100 : 0;

  return {
    variance,
    variancePercent,
    isOverBudget: variance > 0,
  };
}

/**
 * Formats variance for display
 */
export function formatVariance(variance: number, variancePercent: number): string {
  const sign = variance >= 0 ? "+" : "";
  return `${sign}$${variance.toFixed(2)} (${sign}${variancePercent.toFixed(1)}%)`;
}
