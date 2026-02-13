"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Check, X, AlertTriangle } from "lucide-react";
import { WorkEntryItem } from "@/lib/ai/processor";

interface WorkEntryPreviewProps {
  workEntries: WorkEntryItem[];
  estimateLineItems: Array<{
    id: string;
    description: string;
    timeCost: number | null;
    materialsCost: number | null;
    total: number;
  }>;
  onApprove: (entries: WorkEntryItem[]) => void;
  onReject: () => void;
}

export function WorkEntryPreview({
  workEntries: initialEntries,
  estimateLineItems,
  onApprove,
  onReject,
}: WorkEntryPreviewProps) {
  const [entries, setEntries] = useState(initialEntries);

  const updateEntry = (index: number, updates: Partial<WorkEntryItem>) => {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        const updated = { ...entry, ...updates };

        // Recalculate time cost
        if (
          updates.actualTimeHours !== undefined ||
          updates.actualTimeRate !== undefined
        ) {
          const hours = updated.actualTimeHours || 0;
          const rate = updated.actualTimeRate || 0;
          updated.actualTimeCost = Math.round(hours * rate * 100) / 100;
        }

        // Recalculate total
        updated.actualTotal =
          Math.round(
            ((updated.actualTimeCost || 0) + (updated.actualMaterialsCost || 0)) *
              100
          ) / 100;

        return updated;
      })
    );
  };

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const getLineItemById = (id: string) => {
    return estimateLineItems.find((item) => item.id === id);
  };

  return (
    <div className="my-3 rounded-lg border bg-card">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Work Entry Preview
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Review AI-suggested mappings to estimate line items. Adjust as needed.
        </p>
      </div>

      <div className="divide-y">
        {entries.map((entry, idx) => {
          const lineItem = getLineItemById(entry.estimateLineItemId);
          const variance = lineItem
            ? entry.actualTotal - lineItem.total
            : 0;
          const variancePercent = lineItem
            ? (variance / lineItem.total) * 100
            : 0;

          return (
            <div key={idx} className="p-4">
              {/* Mapping */}
              <div className="mb-3">
                <label className="text-sm font-medium">Mapped to:</label>
                <select
                  value={entry.estimateLineItemId}
                  onChange={(e) =>
                    updateEntry(idx, { estimateLineItemId: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {estimateLineItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.description} (Est: {formatCurrency(item.total)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="mb-3">
                <label className="text-sm font-medium">Description:</label>
                <input
                  type="text"
                  value={entry.description}
                  onChange={(e) =>
                    updateEntry(idx, { description: e.target.value })
                  }
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              {/* Costs */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Time */}
                <div>
                  <label className="text-sm font-medium">Time:</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      value={entry.actualTimeHours || ""}
                      onChange={(e) =>
                        updateEntry(idx, {
                          actualTimeHours: parseFloat(e.target.value) || null,
                        })
                      }
                      placeholder="hours"
                      className="w-20 rounded-md border px-2 py-1.5 text-sm"
                      step="0.5"
                    />
                    <span className="self-center text-muted-foreground">×</span>
                    <input
                      type="number"
                      value={entry.actualTimeRate || ""}
                      onChange={(e) =>
                        updateEntry(idx, {
                          actualTimeRate: parseFloat(e.target.value) || null,
                        })
                      }
                      placeholder="$/hr"
                      className="w-20 rounded-md border px-2 py-1.5 text-sm"
                      step="1"
                    />
                    <span className="self-center text-sm text-muted-foreground">
                      = {formatCurrency(entry.actualTimeCost || 0)}
                    </span>
                  </div>
                </div>

                {/* Materials */}
                <div>
                  <label className="text-sm font-medium">Materials:</label>
                  <input
                    type="number"
                    value={entry.actualMaterialsCost || ""}
                    onChange={(e) =>
                      updateEntry(idx, {
                        actualMaterialsCost: parseFloat(e.target.value) || null,
                      })
                    }
                    placeholder="$0.00"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Total & Variance */}
              <div className="flex items-center justify-between rounded-md bg-muted/30 p-3">
                <div>
                  <span className="text-sm font-medium">Actual Total:</span>
                  <span className="ml-2 text-lg font-semibold">
                    {formatCurrency(entry.actualTotal)}
                  </span>
                </div>
                {lineItem && (
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      Estimated: {formatCurrency(lineItem.total)}
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        variance > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {variance > 0 ? "+" : ""}
                      {formatCurrency(variance)} ({variance > 0 ? "+" : ""}
                      {variancePercent.toFixed(1)}%)
                    </div>
                  </div>
                )}
              </div>

              {/* Variance Warning */}
              {Math.abs(variancePercent) > 20 && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-yellow-50 p-2 text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    Variance exceeds 20%. Consider creating a change order.
                  </span>
                </div>
              )}

              {/* Notes */}
              {entry.notes && (
                <div className="mt-2 text-sm text-muted-foreground">
                  <strong>Notes:</strong> {entry.notes}
                </div>
              )}

              {/* Remove Button */}
              <button
                onClick={() => removeEntry(idx)}
                className="mt-2 text-sm text-muted-foreground hover:text-destructive"
              >
                <X className="inline h-3.5 w-3.5 mr-1" />
                Remove entry
              </button>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(entries)}
            disabled={entries.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Approve & Save
          </button>
          <button
            onClick={onReject}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
