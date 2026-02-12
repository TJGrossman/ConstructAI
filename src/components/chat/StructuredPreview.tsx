"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Check, X, Pencil } from "lucide-react";

interface LineItem {
  description: string;
  catalogItemId?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category?: string;
  action?: string;
  originalDesc?: string;
}

interface StructuredPreviewProps {
  type: "estimate" | "change_order" | "invoice";
  title?: string;
  lineItems: LineItem[];
  notes?: string;
  onApprove: (lineItems: LineItem[], title: string, notes: string) => void;
  onReject: () => void;
}

export function StructuredPreview({
  type,
  title: initialTitle,
  lineItems: initialItems,
  notes: initialNotes,
  onApprove,
  onReject,
}: StructuredPreviewProps) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState(initialTitle || "");
  const [notes, setNotes] = useState(initialNotes || "");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);

  const typeLabels = {
    estimate: "Estimate",
    change_order: "Change Order",
    invoice: "Invoice",
  };

  const updateItem = (index: number, updates: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...updates };
        if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
          updated.total =
            Math.round(updated.quantity * updated.unitPrice * 100) / 100;
        }
        return updated;
      })
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="my-3 rounded-lg border bg-card">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {typeLabels[type]} Preview
            </span>
          </div>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-2 w-full border-0 bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
          placeholder="Document title..."
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              {type === "change_order" && (
                <th className="px-4 py-2 font-medium">Action</th>
              )}
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium text-right">Qty</th>
              <th className="px-4 py-2 font-medium">Unit</th>
              <th className="px-4 py-2 font-medium text-right">Rate</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b">
                {type === "change_order" && (
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        item.action === "add"
                          ? "bg-green-100 text-green-700"
                          : item.action === "remove"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {item.action}
                    </span>
                  </td>
                )}
                <td className="px-4 py-2">
                  {editingIndex === idx ? (
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                      className="w-full rounded border px-2 py-1 text-sm"
                      autoFocus
                      onBlur={() => setEditingIndex(null)}
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:underline"
                      onClick={() => setEditingIndex(idx)}
                    >
                      {item.description}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(idx, {
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-16 rounded border px-2 py-1 text-right text-sm"
                    step="0.01"
                  />
                </td>
                <td className="px-4 py-2 text-sm text-muted-foreground">
                  {item.unit}
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(idx, {
                        unitPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-24 rounded border px-2 py-1 text-right text-sm"
                    step="0.01"
                  />
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {formatCurrency(item.total)}
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() =>
                      editingIndex === idx
                        ? setEditingIndex(null)
                        : removeItem(idx)
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {editingIndex === idx ? (
                      <Pencil className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              <td
                colSpan={type === "change_order" ? 5 : 4}
                className="px-4 py-3 text-right"
              >
                Subtotal
              </td>
              <td className="px-4 py-3 text-right">
                {formatCurrency(subtotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="p-4">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)..."
          rows={2}
          className="mb-3 w-full resize-none rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(items, title, notes)}
            disabled={items.length === 0 || !title}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Approve & Create
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
