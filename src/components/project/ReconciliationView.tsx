"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ReconciliationLineItem {
  id: string;
  description: string;
  parentId: string | null;
  estimatedCost: number;
  changeOrders: {
    type: 'customer_requested' | 'unanticipated_issue';
    impact: number;
    changeOrderNumber: number;
    title: string;
  }[];
  adjustedCost: number;
  invoicedCost: number;
  invoices: {
    number: number;
    status: string;
    amount: number;
  }[];
  variance: number;
  variancePercent: number;
  children?: ReconciliationLineItem[];
}

interface ReconciliationData {
  projectName: string;
  customerName: string;
  originalEstimate: number;
  customerRequestedChanges: number;
  unanticipatedChanges: number;
  estimatedCost: number;
  maxBudget: number | null;
  invoicedTotal: number;
  paidTotal: number;
  unpaidTotal: number;
  remainingBudget: number;
  variance: number;
  variancePercent: number;
  lineItems: ReconciliationLineItem[];
}

interface ReconciliationViewProps {
  projectId: string;
}

export function ReconciliationView({ projectId }: ReconciliationViewProps) {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReconciliation();
  }, [projectId]);

  const fetchReconciliation = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/reconciliation`);
      if (res.ok) {
        const reconData = await res.json();
        setData(reconData);

        // Default: expand parents on desktop, collapsed on mobile
        const isMobile = window.innerWidth < 1024;
        if (!isMobile && reconData.lineItems) {
          const parentIds = new Set(
            reconData.lineItems.map((item: ReconciliationLineItem) => item.id)
          );
          setExpandedParents(parentIds);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No reconciliation data available. Approve an estimate to get started.
      </div>
    );
  }

  const nearingMaxBudget = data.maxBudget && data.invoicedTotal > data.maxBudget * 0.9;
  const overMaxBudget = data.maxBudget && data.invoicedTotal > data.maxBudget;

  return (
    <div className="space-y-6">
      {/* Project Summary */}
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Project Budget Overview</h2>
          <p className="text-sm text-muted-foreground">{data.customerName}</p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Original Estimate</p>
            <p className="text-2xl font-bold">{formatCurrency(data.originalEstimate)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Change Orders</p>
            <div className="space-y-1">
              {data.customerRequestedChanges !== 0 && (
                <p className="text-sm">
                  <span className="text-blue-600">Customer Requested:</span>{" "}
                  {formatCurrency(data.customerRequestedChanges)}
                </p>
              )}
              {data.unanticipatedChanges !== 0 && (
                <p className="text-sm">
                  <span className="text-orange-600">Unanticipated:</span>{" "}
                  {formatCurrency(data.unanticipatedChanges)}
                </p>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Adjusted Budget</p>
            <p className="text-2xl font-bold">{formatCurrency(data.estimatedCost)}</p>
          </div>
        </div>
        <div className="grid gap-4 border-t p-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Invoiced</p>
            <p className="text-xl font-semibold">{formatCurrency(data.invoicedTotal)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-xl font-semibold text-green-600">{formatCurrency(data.paidTotal)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Unpaid</p>
            <p className="text-xl font-semibold text-red-600">{formatCurrency(data.unpaidTotal)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Remaining Budget</p>
            <p className={`text-xl font-semibold ${data.remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(data.remainingBudget)}
            </p>
          </div>
        </div>
        {data.maxBudget && (
          <div className={`border-t p-4 ${overMaxBudget ? 'bg-red-50' : nearingMaxBudget ? 'bg-yellow-50' : ''}`}>
            <p className="text-sm">
              <span className="font-medium">Max Budget:</span> {formatCurrency(data.maxBudget)}
              {overMaxBudget && <span className="ml-2 text-red-600 font-semibold">⚠️ OVER BUDGET - Conversation Needed</span>}
              {nearingMaxBudget && !overMaxBudget && <span className="ml-2 text-yellow-600 font-semibold">⚠️ Approaching Limit</span>}
            </p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h3 className="font-semibold">Detailed Breakdown</h3>
        </div>
        {/* Desktop table */}
        <table className="hidden w-full text-sm lg:table">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Estimated</th>
              <th className="px-4 py-2 font-medium">Adjusted</th>
              <th className="px-4 py-2 font-medium">Invoiced</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Variance</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item) => {
              const isExpanded = expandedParents.has(item.id);
              const hasChildren = item.children && item.children.length > 0;

              return (
                <>
                  <tr key={item.id} className="border-b bg-muted/30 font-semibold">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {hasChildren && (
                          <button
                            onClick={() => toggleParent(item.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <span>{item.description}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">{formatCurrency(item.estimatedCost)}</td>
                    <td className="px-4 py-2">{formatCurrency(item.adjustedCost)}</td>
                    <td className="px-4 py-2">{formatCurrency(item.invoicedCost)}</td>
                    <td className="px-4 py-2">
                      {item.invoices.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.invoices.map((inv, idx) => (
                            <span
                              key={idx}
                              className={`rounded px-1.5 py-0.5 text-xs ${
                                inv.status === 'paid'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              #{inv.number}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={`px-4 py-2 text-right ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                    </td>
                  </tr>
                  {hasChildren && isExpanded && item.children!.map((child) => (
                    <tr key={child.id} className="border-b">
                      <td className="px-4 py-2 pl-12">{child.description}</td>
                      <td className="px-4 py-2 text-muted-foreground">{formatCurrency(child.estimatedCost)}</td>
                      <td className="px-4 py-2">
                        <div>
                          <div>{formatCurrency(child.adjustedCost)}</div>
                          {child.changeOrders.length > 0 && (
                            <div className="mt-1 space-y-0.5 text-xs">
                              {child.changeOrders.map((co, idx) => (
                                <div
                                  key={idx}
                                  className={co.type === 'customer_requested' ? 'text-blue-600' : 'text-orange-600'}
                                >
                                  CO #{co.changeOrderNumber}: {formatCurrency(co.impact)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{formatCurrency(child.invoicedCost)}</td>
                      <td className="px-4 py-2">
                        {child.invoices.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {child.invoices.map((inv, idx) => (
                              <span
                                key={idx}
                                className={`rounded px-1.5 py-0.5 text-xs ${
                                  inv.status === 'paid'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                #{inv.number}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-right ${child.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {child.variance >= 0 ? '+' : ''}{formatCurrency(child.variance)}
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
        {/* Mobile cards */}
        <div className="lg:hidden">
          {data.lineItems.map((item) => {
            const isExpanded = expandedParents.has(item.id);
            const hasChildren = item.children && item.children.length > 0;

            return (
              <div key={item.id} className="border-b last:border-b-0">
                <div className="bg-muted/30 p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    {hasChildren && (
                      <button
                        onClick={() => toggleParent(item.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <span>{item.description}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <div className="text-muted-foreground">Estimated:</div>
                    <div className="text-right">{formatCurrency(item.estimatedCost)}</div>
                    <div className="text-muted-foreground">Adjusted:</div>
                    <div className="text-right">{formatCurrency(item.adjustedCost)}</div>
                    <div className="text-muted-foreground">Invoiced:</div>
                    <div className="text-right">{formatCurrency(item.invoicedCost)}</div>
                    <div className="text-muted-foreground">Variance:</div>
                    <div className={`text-right font-semibold ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                    </div>
                  </div>
                  {item.invoices.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.invoices.map((inv, idx) => (
                        <span
                          key={idx}
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            inv.status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          Invoice #{inv.number}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {hasChildren && isExpanded && item.children!.map((child) => (
                  <div key={child.id} className="border-t p-4 pl-8">
                    <div className="mb-2 font-medium">{child.description}</div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                      <div className="text-muted-foreground">Estimated:</div>
                      <div className="text-right">{formatCurrency(child.estimatedCost)}</div>
                      <div className="text-muted-foreground">Adjusted:</div>
                      <div className="text-right">{formatCurrency(child.adjustedCost)}</div>
                      {child.changeOrders.length > 0 && (
                        <>
                          <div className="text-muted-foreground">Changes:</div>
                          <div className="text-right text-xs">
                            {child.changeOrders.map((co, idx) => (
                              <div
                                key={idx}
                                className={co.type === 'customer_requested' ? 'text-blue-600' : 'text-orange-600'}
                              >
                                CO #{co.changeOrderNumber}: {formatCurrency(co.impact)}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      <div className="text-muted-foreground">Invoiced:</div>
                      <div className="text-right">{formatCurrency(child.invoicedCost)}</div>
                      <div className="text-muted-foreground">Variance:</div>
                      <div className={`text-right font-semibold ${child.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {child.variance >= 0 ? '+' : ''}{formatCurrency(child.variance)}
                      </div>
                    </div>
                    {child.invoices.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {child.invoices.map((inv, idx) => (
                          <span
                            key={idx}
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              inv.status === 'paid'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            Invoice #{inv.number}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
