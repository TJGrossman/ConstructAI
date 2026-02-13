"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { formatCurrency, formatDate } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  parentId?: string | null;
  timeHours?: string | null;
  timeRate?: string | null;
  timeCost?: string | null;
  materialsCost?: string | null;
  total: string;
  category?: string;
  action?: string;
  sortOrder?: number;
}

interface Estimate {
  id: string;
  number: number;
  title: string;
  status: string;
  subtotal: string;
  total: string;
  createdAt: string;
  lineItems: LineItem[];
}

interface ChangeOrder {
  id: string;
  number: number;
  title: string;
  description: string;
  status: string;
  costImpact: string;
  createdAt: string;
  lineItems: (LineItem & { action: string; originalDesc?: string })[];
}

interface Invoice {
  id: string;
  number: number;
  status: string;
  subtotal: string;
  total: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  lineItems: LineItem[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface Project {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  status: string;
  customer: { name: string; email: string | null; phone: string | null };
  estimates: Estimate[];
  changeOrders: ChangeOrder[];
  invoices: Invoice[];
  conversations: { id: string; messages: Message[] }[];
}

const statusColors: Record<string, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  active: "bg-green-100 text-green-700",
};

type Tab = "chat" | "estimates" | "change-orders" | "invoices" | "history";

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [swipeState, setSwipeState] = useState<{
    itemId: string | null;
    startX: number;
    currentX: number;
    isDragging: boolean;
  }>({
    itemId: null,
    startX: 0,
    currentX: 0,
    isDragging: false,
  });

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        // Expand parent items by default on desktop only (collapsed on mobile)
        const isMobile = window.innerWidth < 1024; // lg breakpoint
        const parentIds = new Set<string>();

        if (!isMobile) {
          data.estimates?.forEach((est: Estimate) => {
            est.lineItems?.forEach((item: LineItem) => {
              if (!item.parentId) parentIds.add(item.id);
            });
          });
          data.changeOrders?.forEach((co: ChangeOrder) => {
            co.lineItems?.forEach((item: LineItem) => {
              if (!item.parentId) parentIds.add(item.id);
            });
          });
          data.invoices?.forEach((inv: Invoice) => {
            inv.lineItems?.forEach((item: LineItem) => {
              if (!item.parentId) parentIds.add(item.id);
            });
          });
        }

        setExpandedParents(parentIds);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

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

  // Calculate rolled-up total for parent items (sum of children)
  const getItemTotal = (item: LineItem, allItems: LineItem[]): string => {
    const isParent = !item.parentId;
    if (!isParent) {
      return item.total;
    }

    // Sum children's totals
    const children = allItems.filter((i) => i.parentId === item.id);
    const childrenTotal = children.reduce((sum, child) => {
      return sum + parseFloat(child.total);
    }, 0);

    return childrenTotal.toFixed(2);
  };

  // Swipe handlers for mobile delete
  const handleTouchStart = (e: React.TouchEvent, itemId: string) => {
    setSwipeState({
      itemId,
      startX: e.touches[0].clientX,
      currentX: e.touches[0].clientX,
      isDragging: true,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeState.isDragging) return;
    setSwipeState((prev) => ({
      ...prev,
      currentX: e.touches[0].clientX,
    }));
  };

  const handleTouchEnd = async (estimateId: string, itemId: string, estimate: Estimate) => {
    if (!swipeState.isDragging) return;

    const swipeDistance = swipeState.startX - swipeState.currentX;
    const screenWidth = window.innerWidth;
    const swipePercentage = swipeDistance / screenWidth;

    // Delete if swiped more than 50% (lowered from 70%)
    if (swipePercentage > 0.5) {
      // Keep swipe state briefly to show animation
      setTimeout(() => {
        setSwipeState({
          itemId: null,
          startX: 0,
          currentX: 0,
          isDragging: false,
        });
      }, 300);
      // Optimistically remove from UI
      const updatedLineItems = estimate.lineItems.filter((item) => item.id !== itemId);

      // Call API to update estimate
      try {
        await fetch(`/api/estimates/${estimateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineItems: updatedLineItems.map((item) => ({
              description: item.description,
              catalogItemId: item.category || undefined,
              category: item.category || undefined,
              parentId: item.parentId || undefined,
              timeHours: item.timeHours ? Number(item.timeHours) : null,
              timeRate: item.timeRate ? Number(item.timeRate) : null,
              timeCost: item.timeCost ? Number(item.timeCost) : null,
              materialsCost: item.materialsCost ? Number(item.materialsCost) : null,
              total: Number(item.total),
            })),
          }),
        });

        // Refresh project data
        fetchProject();
      } catch (error) {
        console.error("Failed to delete item:", error);
        // Refresh to revert optimistic update
        fetchProject();
      }
    } else {
      // Swipe not far enough, snap back
      setSwipeState({
        itemId: null,
        startX: 0,
        currentX: 0,
        isDragging: false,
      });
    }
  };

  const updateStatus = async (
    type: "estimates" | "invoices",
    id: string,
    status: string
  ) => {
    const endpoint =
      type === "estimates" ? `/api/estimates/${id}` : "/api/invoices";
    const body =
      type === "estimates" ? { status } : { invoiceId: id, status };
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    fetchProject();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return <div className="py-10 text-center text-muted-foreground">Project not found.</div>;
  }

  const conversation = project.conversations[0];
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "chat", label: "Chat" },
    { key: "estimates", label: "Estimates", count: project.estimates.length },
    { key: "change-orders", label: "Change Orders", count: project.changeOrders.length },
    { key: "invoices", label: "Invoices", count: project.invoices.length },
    { key: "history", label: "History" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 shrink-0">
        <Link
          href="/dashboard/projects"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground">
              {project.customer.name}
              {project.address && ` — ${project.address}`}
            </p>
          </div>
          <span className={`rounded px-2 py-1 text-xs font-medium ${statusColors[project.status] || ""}`}>
            {project.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex shrink-0 gap-1 overflow-x-auto rounded-lg border bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        {activeTab === "chat" && (
          <div className="h-full rounded-lg border">
            <ChatPanel
              projectId={projectId}
              initialMessages={conversation?.messages || []}
              initialConversationId={conversation?.id}
              onDocumentCreated={fetchProject}
            />
          </div>
        )}

        {activeTab === "estimates" && (
          <div className="space-y-4">
            {project.estimates.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                No estimates yet. Use the chat to create one.
              </div>
            ) : (
              project.estimates.map((est) => (
                <div key={est.id} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b p-4">
                    <div>
                      <h3 className="font-semibold">
                        Estimate #{est.number}: {est.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(est.createdAt)} — {formatCurrency(est.total)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[est.status] || ""}`}>
                        {est.status}
                      </span>
                      {est.status === "draft" && (
                        <button
                          onClick={() => updateStatus("estimates", est.id, "sent")}
                          className="rounded border px-2 py-1 text-xs hover:bg-accent"
                        >
                          Mark Sent
                        </button>
                      )}
                      {est.status === "sent" && (
                        <button
                          onClick={() => updateStatus("estimates", est.id, "approved")}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Desktop table view */}
                  <table className="hidden w-full text-sm lg:table">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-2 font-medium">Description</th>
                        <th className="px-4 py-2 font-medium">Time</th>
                        <th className="px-4 py-2 font-medium">Materials</th>
                        <th className="px-4 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {est.lineItems.map((item) => {
                        const isParent = !item.parentId;
                        const isChild = !!item.parentId;
                        const isExpanded = expandedParents.has(item.id);

                        // Hide child items if their parent is collapsed
                        if (isChild && !expandedParents.has(item.parentId || "")) {
                          return null;
                        }

                        return (
                          <tr
                            key={item.id}
                            className={`border-b ${isParent ? "bg-muted/30 font-semibold" : ""}`}
                          >
                            <td className={`px-4 py-2 ${isChild ? "pl-8" : ""}`}>
                              <div className="flex items-center gap-2">
                                {isParent && (
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
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {item.timeHours && item.timeRate ? (
                                <span>{item.timeHours} hrs @ {formatCurrency(item.timeRate)}/hr</span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {item.materialsCost ? (
                                formatCurrency(item.materialsCost)
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              {formatCurrency(getItemTotal(item, est.lineItems))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-medium">
                        <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(est.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  {/* Mobile card view */}
                  <div className="lg:hidden">
                    {est.lineItems.map((item) => {
                      const isParent = !item.parentId;
                      const isChild = !!item.parentId;
                      const isExpanded = expandedParents.has(item.id);

                      // Hide child items if their parent is collapsed
                      if (isChild && !expandedParents.has(item.parentId || "")) {
                        return null;
                      }

                      // Calculate swipe offset
                      const swipeOffset =
                        swipeState.isDragging && swipeState.itemId === item.id
                          ? Math.max(0, swipeState.startX - swipeState.currentX)
                          : 0;
                      const swipePercentage = swipeOffset / window.innerWidth;

                      return (
                        <div key={item.id} className="relative overflow-hidden">
                          {/* Delete button background (always rendered, controlled by opacity) */}
                          {isChild && (
                            <div
                              className="absolute inset-0 flex items-center justify-end bg-red-600 px-6 transition-opacity"
                              style={{
                                opacity: swipePercentage > 0.15 ? 1 : 0,
                              }}
                            >
                              <span className="text-white font-medium">Delete</span>
                            </div>
                          )}

                          {/* Main card content */}
                          <div
                            className={`border-b p-4 last:border-b-0 ${isParent ? "bg-muted/30" : "bg-background"} ${isChild ? "pl-8" : ""}`}
                            style={{
                              transform: isChild ? `translateX(-${swipeOffset}px)` : undefined,
                              transition: swipeState.isDragging ? 'none' : 'transform 0.2s ease-out',
                            }}
                            onTouchStart={isChild ? (e) => handleTouchStart(e, item.id) : undefined}
                            onTouchMove={isChild ? handleTouchMove : undefined}
                            onTouchEnd={isChild ? () => handleTouchEnd(est.id, item.id, est) : undefined}
                          >
                          <div className={`mb-2 text-base ${isParent ? "font-semibold" : "font-medium"}`}>
                            <div className="flex items-center gap-2">
                              {isParent && (
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
                          </div>
                          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                            {item.timeHours && item.timeRate && (
                              <>
                                <div className="text-muted-foreground">Time:</div>
                                <div className="text-right">{item.timeHours} hrs @ {formatCurrency(item.timeRate)}/hr</div>
                              </>
                            )}
                            {item.materialsCost && (
                              <>
                                <div className="text-muted-foreground">Materials:</div>
                                <div className="text-right">{formatCurrency(item.materialsCost)}</div>
                              </>
                            )}
                            <div className="text-muted-foreground">Total:</div>
                            <div className="text-right font-semibold">
                              {formatCurrency(getItemTotal(item, est.lineItems))}
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                    <div className="border-t bg-muted/30 p-4">
                      <div className="flex justify-between font-semibold text-base">
                        <span>Total</span>
                        <span>{formatCurrency(est.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "change-orders" && (
          <div className="space-y-4">
            {project.changeOrders.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                No change orders yet. Use the chat to create one.
              </div>
            ) : (
              project.changeOrders.map((co) => (
                <div key={co.id} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b p-4">
                    <div>
                      <h3 className="font-semibold">
                        CO #{co.number}: {co.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(co.createdAt)} — Impact:{" "}
                        <span className={Number(co.costImpact) >= 0 ? "text-green-600" : "text-red-600"}>
                          {Number(co.costImpact) >= 0 ? "+" : ""}
                          {formatCurrency(co.costImpact)}
                        </span>
                      </p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[co.status] || ""}`}>
                      {co.status}
                    </span>
                  </div>
                  {/* Desktop table view */}
                  <table className="hidden w-full text-sm lg:table">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-2 font-medium">Action</th>
                        <th className="px-4 py-2 font-medium">Description</th>
                        <th className="px-4 py-2 font-medium">Time</th>
                        <th className="px-4 py-2 font-medium">Materials</th>
                        <th className="px-4 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {co.lineItems.map((item) => {
                        const isParent = !item.parentId;
                        const isChild = !!item.parentId;
                        return (
                          <tr
                            key={item.id}
                            className={`border-b ${isParent ? "bg-muted/30 font-semibold" : ""}`}
                          >
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
                            <td className={`px-4 py-2 ${isChild ? "pl-8" : ""}`}>
                              {item.description}
                              {item.originalDesc && (
                                <span className="ml-2 text-xs text-muted-foreground line-through">
                                  {item.originalDesc}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {item.timeHours && item.timeRate ? (
                                <span>{item.timeHours} hrs @ {formatCurrency(item.timeRate)}/hr</span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {item.materialsCost ? (
                                formatCurrency(item.materialsCost)
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* Mobile card view */}
                  <div className="lg:hidden">
                    {co.lineItems.map((item) => {
                      const isParent = !item.parentId;
                      const isChild = !!item.parentId;
                      return (
                        <div
                          key={item.id}
                          className={`border-b p-4 last:border-b-0 ${isParent ? "bg-muted/30" : ""} ${isChild ? "pl-8" : ""}`}
                        >
                          <div className="mb-2 flex items-start gap-2">
                            <span
                              className={`rounded px-2 py-1 text-xs font-medium ${
                                item.action === "add"
                                  ? "bg-green-100 text-green-700"
                                  : item.action === "remove"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {item.action}
                            </span>
                          </div>
                          <div className={`mb-2 text-base ${isParent ? "font-semibold" : "font-medium"}`}>
                            {item.description}
                            {item.originalDesc && (
                              <div className="mt-1 text-sm text-muted-foreground line-through">
                                {item.originalDesc}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                            {item.timeHours && item.timeRate && (
                              <>
                                <div className="text-muted-foreground">Time:</div>
                                <div className="text-right">{item.timeHours} hrs @ {formatCurrency(item.timeRate)}/hr</div>
                              </>
                            )}
                            {item.materialsCost && (
                              <>
                                <div className="text-muted-foreground">Materials:</div>
                                <div className="text-right">{formatCurrency(item.materialsCost)}</div>
                              </>
                            )}
                            <div className="text-muted-foreground">Total:</div>
                            <div className="text-right font-semibold">{formatCurrency(item.total)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="space-y-4">
            {project.invoices.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                No invoices yet. Use the chat to create one.
              </div>
            ) : (
              project.invoices.map((inv) => (
                <div key={inv.id} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b p-4">
                    <div>
                      <h3 className="font-semibold">Invoice #{inv.number}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(inv.createdAt)} — {formatCurrency(inv.total)}
                        {inv.dueDate && ` — Due: ${formatDate(inv.dueDate)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[inv.status] || ""}`}>
                        {inv.status}
                      </span>
                      {inv.status === "draft" && (
                        <button
                          onClick={() => updateStatus("invoices", inv.id, "sent")}
                          className="rounded border px-2 py-1 text-xs hover:bg-accent"
                        >
                          Mark Sent
                        </button>
                      )}
                      {inv.status === "sent" && (
                        <button
                          onClick={() => updateStatus("invoices", inv.id, "paid")}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Desktop table view */}
                  <table className="hidden w-full text-sm lg:table">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-4 py-2 font-medium">Description</th>
                        <th className="px-4 py-2 font-medium">Time</th>
                        <th className="px-4 py-2 font-medium">Materials</th>
                        <th className="px-4 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.lineItems.map((item) => {
                        const isParent = !item.parentId;
                        const isChild = !!item.parentId;
                        return (
                          <tr
                            key={item.id}
                            className={`border-b ${isParent ? "bg-muted/30 font-semibold" : ""}`}
                          >
                            <td className={`px-4 py-2 ${isChild ? "pl-8" : ""}`}>
                              {item.description}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {item.timeHours && item.timeRate ? (
                                <span>{item.timeHours} hrs @ {formatCurrency(item.timeRate)}/hr</span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {item.materialsCost ? (
                                formatCurrency(item.materialsCost)
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-medium">
                        <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(inv.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  {/* Mobile card view */}
                  <div className="lg:hidden">
                    {inv.lineItems.map((item) => {
                      const isParent = !item.parentId;
                      const isChild = !!item.parentId;
                      return (
                        <div
                          key={item.id}
                          className={`border-b p-4 last:border-b-0 ${isParent ? "bg-muted/30" : ""} ${isChild ? "pl-8" : ""}`}
                        >
                          <div className={`mb-2 text-base ${isParent ? "font-semibold" : "font-medium"}`}>
                            {item.description}
                          </div>
                          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                            {item.timeHours && item.timeRate && (
                              <>
                                <div className="text-muted-foreground">Time:</div>
                                <div className="text-right">{item.timeHours} hrs @ {formatCurrency(item.timeRate)}/hr</div>
                              </>
                            )}
                            {item.materialsCost && (
                              <>
                                <div className="text-muted-foreground">Materials:</div>
                                <div className="text-right">{formatCurrency(item.materialsCost)}</div>
                              </>
                            )}
                            <div className="text-muted-foreground">Total:</div>
                            <div className="text-right font-semibold">{formatCurrency(item.total)}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="border-t bg-muted/30 p-4">
                      <div className="flex justify-between font-semibold text-base">
                        <span>Total</span>
                        <span>{formatCurrency(inv.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "history" && (
          <HistoryTab projectId={projectId} />
        )}
      </div>
    </div>
  );
}

function HistoryTab({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<
    { id: string; action: string; entityType: string; createdAt: string; details: Record<string, unknown> | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/history`)
      .then((r) => r.json())
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        No history yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {log.action.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-muted-foreground">
              {log.entityType} — {formatDate(log.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
