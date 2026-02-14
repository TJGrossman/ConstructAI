"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Check, X, Pencil, ChevronDown, ChevronRight } from "lucide-react";

interface LineItem {
  description: string;
  catalogItemId?: string;
  category?: string;

  // Hierarchical structure
  isParent?: boolean;
  parentId?: string;

  // Dual time + materials structure
  timeHours?: number | null;
  timeRate?: number | null;
  timeCost?: number | null;
  materialsCost?: number | null;
  total: number;

  notes?: string;
  action?: string;
  originalDesc?: string;
}

interface WorkEntry {
  estimateLineItemId: string;
  description: string;
  actualTimeHours?: number | null;
  actualTimeRate?: number | null;
  actualTimeCost?: number | null;
  actualMaterialsCost?: number | null;
  actualTotal: number;
  notes?: string;
}

interface StructuredPreviewProps {
  type: "estimate" | "change_order" | "invoice" | "work_entry" | "project";
  title?: string;
  lineItems?: LineItem[];
  workEntries?: WorkEntry[];
  notes?: string;
  // Project-specific fields
  projectName?: string;
  customerName?: string;
  address?: string;
  description?: string;
  customerEmail?: string;
  customerPhone?: string;
  onApprove: (lineItems: LineItem[], title: string, notes: string) => void;
  onReject: () => void;
}

export function StructuredPreview({
  type,
  title: initialTitle,
  lineItems: initialItems,
  workEntries: initialWorkEntries,
  notes: initialNotes,
  projectName: initialProjectName,
  customerName: initialCustomerName,
  address: initialAddress,
  description: initialDescription,
  customerEmail: initialCustomerEmail,
  customerPhone: initialCustomerPhone,
  onApprove,
  onReject,
}: StructuredPreviewProps) {
  const [items, setItems] = useState(initialItems || []);
  const workEntries = initialWorkEntries || [];
  const [title, setTitle] = useState(initialTitle || "");
  const [notes, setNotes] = useState(initialNotes || "");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    new Set((initialItems || []).map((_, idx) => idx).filter((idx) => (initialItems || [])[idx].isParent))
  );

  // Project fields
  const [projectName, setProjectName] = useState(initialProjectName || "");
  const [customerName, setCustomerName] = useState(initialCustomerName || "");
  const [address, setAddress] = useState(initialAddress || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [customerEmail, setCustomerEmail] = useState(initialCustomerEmail || "");
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone || "");

  // Calculate subtotal (only root-level items to avoid double-counting hierarchy)
  const rootItems = items.filter((_, idx) => {
    // Check if this item is a child (comes after a parent)
    for (let i = idx - 1; i >= 0; i--) {
      if (items[i].isParent) {
        return false;
      }
    }
    return true;
  });
  const subtotal = rootItems.reduce((sum, item) => sum + item.total, 0);

  const typeLabels = {
    estimate: "Estimate",
    change_order: "Change Order",
    invoice: "Invoice",
    work_entry: "Work Summary",
    project: "Project",
  };

  const updateItem = (index: number, updates: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...updates };

        // Recalculate time cost if time fields change
        if (
          updates.timeHours !== undefined ||
          updates.timeRate !== undefined
        ) {
          const hours = updates.timeHours ?? item.timeHours ?? 0;
          const rate = updates.timeRate ?? item.timeRate ?? 0;
          updated.timeCost = Math.round(hours * rate * 100) / 100;
        }

        // Recalculate total
        updated.total =
          Math.round(
            ((updated.timeCost || 0) + (updated.materialsCost || 0)) * 100
          ) / 100;

        return updated;
      })
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleExpand = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
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

      {type === "project" ? (
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Project Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g., Kitchen Remodel - Smith Residence"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Customer Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g., John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g., 123 Main St, Anytown, CA 90210"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Brief project description..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </div>
      ) : type === "work_entry" ? (
        <div className="p-4 space-y-3">
          {workEntries.map((entry, idx) => (
            <div key={idx} className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 font-medium">{entry.description}</div>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                {entry.actualTimeHours && entry.actualTimeRate && (
                  <>
                    <div className="text-muted-foreground">Time:</div>
                    <div className="text-right">{entry.actualTimeHours} hrs @ {formatCurrency(entry.actualTimeRate)}/hr = {formatCurrency(entry.actualTimeCost || 0)}</div>
                  </>
                )}
                {entry.actualMaterialsCost && (
                  <>
                    <div className="text-muted-foreground">Materials:</div>
                    <div className="text-right">{formatCurrency(entry.actualMaterialsCost)}</div>
                  </>
                )}
                <div className="text-muted-foreground font-medium">Total:</div>
                <div className="text-right font-semibold">{formatCurrency(entry.actualTotal)}</div>
              </div>
              {entry.notes && (
                <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                  {entry.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              {type === "change_order" && (
                <th className="px-4 py-2 font-medium">Action</th>
              )}
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Materials</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              // Check if this is a child item (comes after a parent and is not itself a parent)
              let parentIndex = -1;
              for (let i = idx - 1; i >= 0; i--) {
                if (items[i].isParent) {
                  parentIndex = i;
                  break;
                }
              }
              const isChild = parentIndex >= 0 && !item.isParent;
              const shouldShow = !isChild || expandedItems.has(parentIndex);

              if (!shouldShow) return null;

              return (
                <tr
                  key={idx}
                  className={`border-b ${item.isParent ? "bg-muted/30 font-medium" : ""} ${isChild ? "bg-muted/10" : ""}`}
                >
                  {type === "change_order" && (
                    <td className="px-4 py-2">
                      {item.action && (
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
                      )}
                    </td>
                  )}
                  <td className={`px-4 py-2 ${isChild ? "pl-8" : ""}`}>
                    <div className="flex items-center gap-2">
                      {item.isParent && (
                        <button
                          onClick={() => toggleExpand(idx)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {expandedItems.has(idx) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      )}
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
                        <div className="flex-1">
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => setEditingIndex(idx)}
                          >
                            {item.description}
                          </span>
                          {item.notes && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {!item.isParent && (
                      <div className="flex items-center gap-2 text-xs">
                        <input
                          type="number"
                          value={item.timeHours || ""}
                          onChange={(e) =>
                            updateItem(idx, {
                              timeHours: parseFloat(e.target.value) || null,
                            })
                          }
                          placeholder="hrs"
                          className="w-14 rounded border px-1.5 py-1 text-right"
                          step="0.5"
                        />
                        <span className="text-muted-foreground">×</span>
                        <input
                          type="number"
                          value={item.timeRate || ""}
                          onChange={(e) =>
                            updateItem(idx, {
                              timeRate: parseFloat(e.target.value) || null,
                            })
                          }
                          placeholder="$/hr"
                          className="w-16 rounded border px-1.5 py-1 text-right"
                          step="1"
                        />
                        {item.timeCost ? (
                          <span className="text-muted-foreground">
                            = {formatCurrency(item.timeCost)}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {!item.isParent && (
                      <input
                        type="number"
                        value={item.materialsCost || ""}
                        onChange={(e) =>
                          updateItem(idx, {
                            materialsCost: parseFloat(e.target.value) || null,
                          })
                        }
                        placeholder="$0.00"
                        className="w-24 rounded border px-2 py-1 text-right text-xs"
                        step="0.01"
                      />
                    )}
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
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              <td
                colSpan={type === "change_order" ? 4 : 3}
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
      )}

      <div className="p-4">
        {type !== "project" && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)..."
            rows={2}
            className="mb-3 w-full resize-none rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (type === "project") {
                // For projects, pass project data through the notes parameter as JSON
                const projectData = JSON.stringify({
                  projectName,
                  customerName,
                  address,
                  description,
                  customerEmail,
                  customerPhone,
                });
                onApprove([], "", projectData);
              } else {
                onApprove(items, title, notes);
              }
            }}
            disabled={
              type === "work_entry"
                ? workEntries.length === 0
                : type === "project"
                  ? !projectName || !customerName
                  : items.length === 0 || !title
            }
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {type === "work_entry" ? "Record Work" : type === "project" ? "Create Project" : "Approve & Create"}
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
