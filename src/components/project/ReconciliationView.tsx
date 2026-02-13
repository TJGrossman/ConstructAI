"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from "lucide-react";

interface ReconciliationData {
  reconciliation: {
    projectId: string;
    projectName: string;
    estimates: Array<{
      estimateId: string;
      estimateNumber: number;
      estimateTitle: string;
      lineItems: Array<{
        lineItemId: string;
        description: string;
        category: string | null;
        estimatedTotal: number;
        actualTotal: number;
        variance: number;
        variancePercent: number;
        isOverBudget: boolean;
        workEntryCount: number;
      }>;
      totalEstimated: number;
      totalActual: number;
      totalVariance: number;
      totalVariancePercent: number;
    }>;
    grandTotalEstimated: number;
    grandTotalActual: number;
    grandTotalVariance: number;
    grandTotalVariancePercent: number;
  };
}

interface ReconciliationViewProps {
  projectId: string;
}

export function ReconciliationView({ projectId }: ReconciliationViewProps) {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReconciliation();
  }, [projectId]);

  const fetchReconciliation = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/reconciliation`);
      if (!response.ok) throw new Error("Failed to fetch reconciliation data");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading budget status...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error || "No data available"}
      </div>
    );
  }

  const { reconciliation } = data;
  const progressPercent = reconciliation.grandTotalEstimated > 0
    ? (reconciliation.grandTotalActual / reconciliation.grandTotalEstimated) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Overall Summary Card */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Budget Overview</h2>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Project Progress</span>
            <span className="font-medium">{progressPercent.toFixed(1)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${
                progressPercent > 100
                  ? "bg-red-500"
                  : progressPercent > 90
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Totals Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground">Estimated Total</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatCurrency(reconciliation.grandTotalEstimated)}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground">Actual Total</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatCurrency(reconciliation.grandTotalActual)}
            </div>
          </div>
          <div
            className={`rounded-lg p-4 ${
              reconciliation.grandTotalVariance > 0
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              {reconciliation.grandTotalVariance > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4" />
                  Over Budget
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4" />
                  Under Budget
                </>
              )}
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {reconciliation.grandTotalVariance > 0 ? "+" : ""}
              {formatCurrency(Math.abs(reconciliation.grandTotalVariance))}
            </div>
            <div className="text-sm">
              {reconciliation.grandTotalVariance > 0 ? "+" : ""}
              {reconciliation.grandTotalVariancePercent.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Estimates Breakdown */}
      {reconciliation.estimates.map((estimate) => (
        <div key={estimate.estimateId} className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Estimate #{estimate.estimateNumber}: {estimate.estimateTitle}
              </h3>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  Est: {formatCurrency(estimate.totalEstimated)} | Act:{" "}
                  {formatCurrency(estimate.totalActual)}
                </div>
                <div
                  className={`text-sm font-medium ${
                    estimate.totalVariance > 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {estimate.totalVariance > 0 ? "+" : ""}
                  {formatCurrency(estimate.totalVariance)} (
                  {estimate.totalVariance > 0 ? "+" : ""}
                  {estimate.totalVariancePercent.toFixed(1)}%)
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="px-4 py-2 font-medium">Line Item</th>
                  <th className="px-4 py-2 font-medium text-right">Estimated</th>
                  <th className="px-4 py-2 font-medium text-right">Actual</th>
                  <th className="px-4 py-2 font-medium text-right">Variance</th>
                  <th className="px-4 py-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {estimate.lineItems.map((item) => (
                  <tr key={item.lineItemId} className="border-b">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium">{item.description}</div>
                        {item.category && (
                          <div className="text-xs text-muted-foreground">
                            {item.category}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(item.estimatedTotal)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(item.actualTotal)}
                      {item.workEntryCount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {item.workEntryCount} entries
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        item.isOverBudget ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {item.variance > 0 ? "+" : ""}
                      {formatCurrency(item.variance)}
                      <div className="text-xs">
                        ({item.variance > 0 ? "+" : ""}
                        {item.variancePercent.toFixed(1)}%)
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.workEntryCount === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                          <AlertCircle className="h-3 w-3" />
                          No work logged
                        </span>
                      ) : item.isOverBudget ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          <TrendingUp className="h-3 w-3" />
                          Over budget
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          On track
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {reconciliation.estimates.length === 0 && (
        <div className="rounded-lg border bg-muted/30 p-12 text-center">
          <p className="text-muted-foreground">
            No estimates found. Create an estimate to start tracking budget.
          </p>
        </div>
      )}
    </div>
  );
}
