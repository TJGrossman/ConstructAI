"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ChevronDown, ChevronRight, Pencil, Plus, Save, X, Trash2 } from "lucide-react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ReconciliationView } from "@/components/project/ReconciliationView";
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
  taxRate: string;
  taxAmount: string;
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
  taxRate: string;
  taxAmount: string;
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

type Tab = "status" | "chat" | "estimates" | "change-orders" | "invoices" | "history";
type HistoryFilter = "all" | "estimates" | "change-orders" | "invoices";

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("status");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
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
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<{ type: 'estimate' | 'invoice', id: string } | null>(null);
  const [editedLineItems, setEditedLineItems] = useState<LineItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);

        // Try to restore expanded state from localStorage
        const savedExpandedState = localStorage.getItem(`expandedParents_${projectId}`);

        if (savedExpandedState) {
          // Restore from localStorage
          setExpandedParents(new Set(JSON.parse(savedExpandedState)));
        } else {
          // Default: expand parent items on desktop only (collapsed on mobile)
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

        // Restore scroll position
        setTimeout(() => {
          const savedScrollPos = localStorage.getItem(`scrollPos_${projectId}`);
          if (savedScrollPos) {
            window.scrollTo(0, parseInt(savedScrollPos));
          }
        }, 100);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);

      // If switching to mobile and current tab isn't available, switch to history
      if (mobile && activeTab !== "status" && activeTab !== "chat" && activeTab !== "history") {
        setActiveTab("history");
        // Auto-select appropriate filter based on previous tab
        if (activeTab === "estimates") setHistoryFilter("estimates");
        else if (activeTab === "change-orders") setHistoryFilter("change-orders");
        else if (activeTab === "invoices") setHistoryFilter("invoices");
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [activeTab]);

  // Navigate to a specific item from timeline
  const handleNavigateToItem = (entityType: string, entityId: string) => {
    // Map entity types to tabs
    let targetTab: Tab = "history";
    if (entityType === "estimate") targetTab = "estimates";
    else if (entityType === "change_order") targetTab = "change-orders";
    else if (entityType === "invoice") targetTab = "invoices";

    // On mobile, desktop-only tabs (estimates, change-orders, invoices) redirect to history with filter
    if (isMobile && (targetTab === "estimates" || targetTab === "change-orders" || targetTab === "invoices")) {
      setActiveTab("history");
      if (targetTab === "estimates") setHistoryFilter("estimates");
      else if (targetTab === "change-orders") setHistoryFilter("change-orders");
      else if (targetTab === "invoices") setHistoryFilter("invoices");
    } else {
      setActiveTab(targetTab);
    }

    // Highlight the item
    setHighlightedItemId(entityId);

    // Scroll to the item after a short delay (to allow tab switch)
    setTimeout(() => {
      const element = document.getElementById(`item-${entityId}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });

      // Clear highlight after 3 seconds
      setTimeout(() => setHighlightedItemId(null), 3000);
    }, 100);
  };

  // Navigate to invoice by number
  const handleNavigateToInvoice = (invoiceNumber: number) => {
    if (!project) return;

    // Find the invoice by number
    const invoice = project.invoices.find((inv) => inv.number === invoiceNumber);
    if (!invoice) return;

    // Use the existing navigation handler
    handleNavigateToItem("invoice", invoice.id);
  };

  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      // Save to localStorage
      localStorage.setItem(`expandedParents_${projectId}`, JSON.stringify(Array.from(next)));
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

  const handleTouchEnd = async (type: 'estimate' | 'invoice', documentId: string, itemId: string) => {
    if (!swipeState.isDragging) return;

    const swipeDistance = swipeState.startX - swipeState.currentX;
    const screenWidth = window.innerWidth;
    const swipePercentage = swipeDistance / screenWidth;

    // Delete if swiped more than 50%
    if (swipePercentage > 0.5) {
      // Trigger delete animation
      setDeletingItemId(itemId);
      setSwipeState({
        itemId: null,
        startX: 0,
        currentX: 0,
        isDragging: false,
      });

      // Save scroll position to localStorage
      localStorage.setItem(`scrollPos_${projectId}`, window.scrollY.toString());

      // Call API to delete the specific line item
      try {
        const endpoint = type === 'estimate'
          ? `/api/estimates/${documentId}/line-items/${itemId}`
          : `/api/invoices/${documentId}/line-items/${itemId}`;
        await fetch(endpoint, {
          method: "DELETE",
        });

        // Refresh project data (expanded state will be preserved automatically since IDs don't change)
        fetchProject();
      } catch (error) {
        console.error("Failed to delete item:", error);
        setDeletingItemId(null);
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

  const enterEditMode = (document: Estimate | Invoice, type: 'estimate' | 'invoice') => {
    setEditingDocument({ type, id: document.id });
    setEditedLineItems(JSON.parse(JSON.stringify(document.lineItems))); // Deep copy
  };

  const cancelEdit = () => {
    setEditingDocument(null);
    setEditedLineItems([]);
  };

  const updateLineItem = (itemId: string, field: string, value: string | number) => {
    setEditedLineItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const addLineItem = (parentId: string | null = null) => {
    const newItem: LineItem = {
      id: `temp-${Date.now()}`,
      description: "",
      parentId: parentId,
      timeHours: null,
      timeRate: null,
      timeCost: null,
      materialsCost: null,
      total: "0",
      sortOrder: editedLineItems.length,
    };
    setEditedLineItems((prev) => [...prev, newItem]);
  };

  const removeLineItem = (itemId: string) => {
    setEditedLineItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const deleteDocument = async (type: 'estimate' | 'invoice', documentId: string) => {
    const typeName = type === 'estimate' ? 'estimate' : 'invoice';
    if (!confirm(`Are you sure you want to delete this ${typeName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const endpoint = type === 'estimate' ? `/api/estimates/${documentId}` : `/api/invoices/${documentId}`;
      await fetch(endpoint, {
        method: "DELETE",
      });
      fetchProject();
    } catch (error) {
      console.error(`Failed to delete ${typeName}:`, error);
      alert(`Failed to delete ${typeName}. Please try again.`);
    }
  };

  const saveDocument = async (type: 'estimate' | 'invoice', documentId: string) => {
    setIsSaving(true);
    try {
      // Sort items: parents first, then their children in order
      const sortedItems: LineItem[] = [];
      const parentItems = editedLineItems.filter(item => !item.parentId);

      parentItems.forEach(parent => {
        sortedItems.push(parent);
        const children = editedLineItems.filter(item => item.parentId === parent.id);
        sortedItems.push(...children);
      });

      // Calculate totals for each item
      const itemsWithTotals = sortedItems.map((item) => {
        const timeCost = item.timeHours && item.timeRate
          ? Number(item.timeHours) * Number(item.timeRate)
          : 0;
        const materialsCost = item.materialsCost ? Number(item.materialsCost) : 0;
        const total = timeCost + materialsCost;

        return {
          ...item,
          timeCost: timeCost > 0 ? timeCost.toString() : null,
          total: total.toString(),
        };
      });

      const endpoint = type === 'estimate' ? `/api/estimates/${documentId}` : `/api/invoices/${documentId}`;
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems: itemsWithTotals.map((item) => ({
            description: item.description,
            catalogItemId: item.category || undefined,
            category: item.category || undefined,
            isParent: !item.parentId,
            parentId: item.parentId || undefined,
            timeHours: item.timeHours ? Number(item.timeHours) : null,
            timeRate: item.timeRate ? Number(item.timeRate) : null,
            timeCost: item.timeCost ? Number(item.timeCost) : null,
            materialsCost: item.materialsCost ? Number(item.materialsCost) : null,
            total: Number(item.total),
          })),
        }),
      });

      setEditingDocument(null);
      setEditedLineItems([]);
      fetchProject();
    } catch (error) {
      console.error(`Failed to save ${type}:`, error);
    } finally {
      setIsSaving(false);
    }
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

  // Desktop: all 6 tabs
  const allTabs: { key: Tab; label: string; count?: number }[] = [
    { key: "status", label: "Status" },
    { key: "chat", label: "Chat" },
    { key: "estimates", label: "Estimates", count: project.estimates.length },
    { key: "change-orders", label: "Change Orders", count: project.changeOrders.length },
    { key: "invoices", label: "Invoices", count: project.invoices.length },
    { key: "history", label: "History" },
  ];

  // Mobile: simplified 3 tabs (estimates/change orders/invoices accessible via history filters)
  const mobileTabs: { key: Tab; label: string; count?: number }[] = [
    { key: "status", label: "Status" },
    { key: "chat", label: "Chat" },
    { key: "history", label: "History" },
  ];

  const tabs = isMobile ? mobileTabs : allTabs;

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
        {/* Mobile history filters - show above all content when on history tab */}
        {activeTab === "history" && isMobile && (
          <div className="mb-4 flex gap-2 overflow-x-auto rounded-lg border bg-muted p-1">
            {[
              { key: "all" as const, label: "Timeline" },
              { key: "estimates" as const, label: "Estimates" },
              { key: "change-orders" as const, label: "Change Orders" },
              { key: "invoices" as const, label: "Invoices" },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setHistoryFilter(filter.key)}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  historyFilter === filter.key
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === "status" && (
          <ReconciliationView projectId={projectId} onNavigateToInvoice={handleNavigateToInvoice} />
        )}

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

        {(activeTab === "estimates" || (activeTab === "history" && isMobile && historyFilter === "estimates")) && (
          <div className="space-y-4">
            {project.estimates.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                No estimates yet. Use the chat to create one.
              </div>
            ) : (
              project.estimates.map((est) => {
                const isEditing = editingDocument?.type === 'estimate' && editingDocument?.id === est.id;
                const displayItems = isEditing ? editedLineItems : est.lineItems;

                return (
                <div
                  key={est.id}
                  id={`item-${est.id}`}
                  className={`rounded-lg border bg-card transition-all ${
                    highlightedItemId === est.id ? "ring-2 ring-primary shadow-lg" : ""
                  }`}
                >
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
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveDocument('estimate', est.id)}
                            disabled={isSaving}
                            className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            <Save className="h-3 w-3" />
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="flex items-center gap-1 rounded border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[est.status] || ""}`}>
                            {est.status}
                          </span>
                          <button
                            onClick={() => enterEditMode(est, 'estimate')}
                            className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                            title="Edit estimate"
                          >
                            <Pencil className="h-3 w-3" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button
                            onClick={() => deleteDocument('estimate', est.id)}
                            className="flex items-center gap-1 rounded border border-red-600 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            title="Delete estimate"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
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
                        </>
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
                        {isEditing && <th className="px-4 py-2 w-20"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item) => {
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
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                                    className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                                    placeholder="Description"
                                  />
                                ) : (
                                  <span>{item.description}</span>
                                )}
                                {isEditing && isParent && (
                                  <button
                                    onClick={() => addLineItem(item.id)}
                                    className="text-muted-foreground hover:text-foreground"
                                    title="Add child item"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {isEditing && !isParent ? (
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    value={item.timeHours || ""}
                                    onChange={(e) => updateLineItem(item.id, "timeHours", e.target.value)}
                                    className="w-16 rounded border bg-background px-2 py-1 text-sm"
                                    placeholder="Hrs"
                                    step="0.5"
                                  />
                                  <input
                                    type="number"
                                    value={item.timeRate || ""}
                                    onChange={(e) => updateLineItem(item.id, "timeRate", e.target.value)}
                                    className="w-20 rounded border bg-background px-2 py-1 text-sm"
                                    placeholder="Rate"
                                    step="1"
                                  />
                                </div>
                              ) : (
                                item.timeHours && item.timeRate ? (
                                  <span>{item.timeHours} hrs @ {formatCurrency(item.timeRate)}/hr</span>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {isEditing && !isParent ? (
                                <input
                                  type="number"
                                  value={item.materialsCost || ""}
                                  onChange={(e) => updateLineItem(item.id, "materialsCost", e.target.value)}
                                  className="w-24 rounded border bg-background px-2 py-1 text-sm"
                                  placeholder="Cost"
                                  step="0.01"
                                />
                              ) : (
                                item.materialsCost ? (
                                  formatCurrency(item.materialsCost)
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              {formatCurrency(getItemTotal(item, displayItems))}
                            </td>
                            {isEditing && (
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => removeLineItem(item.id)}
                                  className="text-red-600 hover:text-red-700"
                                  title="Delete item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {isEditing && (
                        <tr>
                          <td colSpan={isEditing ? 5 : 4} className="px-4 py-3">
                            <button
                              onClick={() => addLineItem(null)}
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <Plus className="h-4 w-4" />
                              Add Section
                            </button>
                          </td>
                        </tr>
                      )}
                      <tr className="font-medium">
                        <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(est.total)}</td>
                        {isEditing && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                  {/* Mobile card view */}
                  <div className="lg:hidden">
                    {displayItems.map((item) => {
                      const isParent = !item.parentId;
                      const isChild = !!item.parentId;
                      const isExpanded = expandedParents.has(item.id);

                      // Hide child items if their parent is collapsed
                      if (isChild && !expandedParents.has(item.parentId || "")) {
                        return null;
                      }

                      // Calculate swipe offset
                      const isDeleting = deletingItemId === item.id;
                      const swipeOffset = isDeleting
                        ? window.innerWidth
                        : swipeState.isDragging && swipeState.itemId === item.id
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
                              transition: swipeState.isDragging
                                ? 'none'
                                : isDeleting
                                  ? 'transform 0.3s ease-in-out'
                                  : 'transform 0.2s ease-out',
                            }}
                            onTouchStart={isChild ? (e) => handleTouchStart(e, item.id) : undefined}
                            onTouchMove={isChild ? handleTouchMove : undefined}
                            onTouchEnd={isChild ? () => handleTouchEnd('estimate', est.id, item.id) : undefined}
                          >
                          <div className="flex items-center justify-between mb-2">
                            <div className={`flex-1 text-base ${isParent ? "font-semibold" : "font-medium"}`}>
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
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                                    className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                                    placeholder="Description"
                                  />
                                ) : (
                                  <span>{item.description}</span>
                                )}
                              </div>
                            </div>
                            {isEditing && (
                              <div className="flex items-center gap-2">
                                {isParent && (
                                  <button
                                    onClick={() => addLineItem(item.id)}
                                    className="text-primary hover:text-primary/80"
                                    title="Add child item"
                                  >
                                    <Plus className="h-5 w-5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => removeLineItem(item.id)}
                                  className="text-red-600 hover:text-red-700"
                                  title="Delete item"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                            {(isEditing || (item.timeHours && item.timeRate)) && !isParent && (
                              <>
                                <div className="text-muted-foreground">Time:</div>
                                {isEditing ? (
                                  <div className="flex gap-1 justify-end">
                                    <input
                                      type="number"
                                      value={item.timeHours || ""}
                                      onChange={(e) => updateLineItem(item.id, "timeHours", e.target.value)}
                                      className="w-16 rounded border bg-background px-2 py-1 text-sm text-right"
                                      placeholder="Hrs"
                                      step="0.5"
                                    />
                                    <span className="self-center text-xs">@</span>
                                    <input
                                      type="number"
                                      value={item.timeRate || ""}
                                      onChange={(e) => updateLineItem(item.id, "timeRate", e.target.value)}
                                      className="w-20 rounded border bg-background px-2 py-1 text-sm text-right"
                                      placeholder="Rate"
                                      step="1"
                                    />
                                  </div>
                                ) : (
                                  <div className="text-right">{item.timeHours} hrs @ {formatCurrency(item.timeRate || 0)}/hr</div>
                                )}
                              </>
                            )}
                            {(isEditing || item.materialsCost) && !isParent && (
                              <>
                                <div className="text-muted-foreground">Materials:</div>
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={item.materialsCost || ""}
                                    onChange={(e) => updateLineItem(item.id, "materialsCost", e.target.value)}
                                    className="rounded border bg-background px-2 py-1 text-sm text-right"
                                    placeholder="Cost"
                                    step="0.01"
                                  />
                                ) : (
                                  <div className="text-right">{formatCurrency(item.materialsCost || 0)}</div>
                                )}
                              </>
                            )}
                            <div className="text-muted-foreground">Total:</div>
                            <div className="text-right font-semibold">
                              {formatCurrency(getItemTotal(item, displayItems))}
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                    {isEditing && (
                      <div className="border-t p-4">
                        <button
                          onClick={() => addLineItem(null)}
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Plus className="h-4 w-4" />
                          Add Section
                        </button>
                      </div>
                    )}
                    <div className="border-t bg-muted/30 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(est.subtotal)}</span>
                      </div>
                      {Number(est.taxRate) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax ({est.taxRate}%)</span>
                          <span>{formatCurrency(est.taxAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-base border-t pt-2">
                        <span>Total</span>
                        <span>{formatCurrency(est.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })
            )}
          </div>
        )}

        {(activeTab === "change-orders" || (activeTab === "history" && isMobile && historyFilter === "change-orders")) && (
          <div className="space-y-4">
            {project.changeOrders.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                No change orders yet. Use the chat to create one.
              </div>
            ) : (
              project.changeOrders.map((co) => (
                <div
                  key={co.id}
                  id={`item-${co.id}`}
                  className={`rounded-lg border bg-card transition-all ${
                    highlightedItemId === co.id ? "ring-2 ring-primary shadow-lg" : ""
                  }`}
                >
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

        {(activeTab === "invoices" || (activeTab === "history" && isMobile && historyFilter === "invoices")) && (
          <div className="space-y-4">
            {project.invoices.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
                No invoices yet. Use the chat to create one.
              </div>
            ) : (
              project.invoices.map((inv) => {
                const isEditing = editingDocument?.type === 'invoice' && editingDocument?.id === inv.id;
                const displayItems = isEditing ? editedLineItems : inv.lineItems;

                return (
                <div
                  key={inv.id}
                  id={`item-${inv.id}`}
                  className={`rounded-lg border bg-card transition-all ${
                    highlightedItemId === inv.id ? "ring-2 ring-primary shadow-lg" : ""
                  }`}
                >
                  <div className="flex items-center justify-between border-b p-4">
                    <div>
                      <h3 className="font-semibold">Invoice #{inv.number}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(inv.createdAt)} — {formatCurrency(inv.total)}
                        {inv.dueDate && ` — Due: ${formatDate(inv.dueDate)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveDocument('invoice', inv.id)}
                            disabled={isSaving}
                            className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            <Save className="h-3 w-3" />
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="flex items-center gap-1 rounded border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
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
                          <button
                            onClick={() => enterEditMode(inv, 'invoice')}
                            className="flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent"
                            title="Edit invoice"
                          >
                            <Pencil className="h-3 w-3" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button
                            onClick={() => deleteDocument('invoice', inv.id)}
                            className="flex items-center gap-1 rounded border border-red-600 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            title="Delete invoice"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </>
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
                        {isEditing && <th className="px-4 py-2 w-20"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((item) => {
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
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                                    className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                                    placeholder="Description"
                                  />
                                ) : (
                                  <span>{item.description}</span>
                                )}
                                {isEditing && isParent && (
                                  <button
                                    onClick={() => addLineItem(item.id)}
                                    className="text-muted-foreground hover:text-foreground"
                                    title="Add child item"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {isEditing && !isParent ? (
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    value={item.timeHours || ""}
                                    onChange={(e) => updateLineItem(item.id, "timeHours", e.target.value)}
                                    className="w-16 rounded border bg-background px-2 py-1 text-sm"
                                    placeholder="Hrs"
                                    step="0.5"
                                  />
                                  <input
                                    type="number"
                                    value={item.timeRate || ""}
                                    onChange={(e) => updateLineItem(item.id, "timeRate", e.target.value)}
                                    className="w-20 rounded border bg-background px-2 py-1 text-sm"
                                    placeholder="Rate"
                                    step="1"
                                  />
                                </div>
                              ) : (
                                item.timeHours && item.timeRate ? (
                                  <span>{item.timeHours} hrs @ {formatCurrency(item.timeRate)}/hr</span>
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {isEditing && !isParent ? (
                                <input
                                  type="number"
                                  value={item.materialsCost || ""}
                                  onChange={(e) => updateLineItem(item.id, "materialsCost", e.target.value)}
                                  className="w-24 rounded border bg-background px-2 py-1 text-sm"
                                  placeholder="Cost"
                                  step="0.01"
                                />
                              ) : (
                                item.materialsCost ? (
                                  formatCurrency(item.materialsCost)
                                ) : (
                                  <span className="text-muted-foreground/50">—</span>
                                )
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              {formatCurrency(getItemTotal(item, displayItems))}
                            </td>
                            {isEditing && (
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => removeLineItem(item.id)}
                                  className="text-red-600 hover:text-red-700"
                                  title="Delete item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {isEditing && (
                        <tr>
                          <td colSpan={isEditing ? 5 : 4} className="px-4 py-3">
                            <button
                              onClick={() => addLineItem(null)}
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <Plus className="h-4 w-4" />
                              Add Section
                            </button>
                          </td>
                        </tr>
                      )}
                      <tr className="font-medium">
                        <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(inv.total)}</td>
                        {isEditing && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                  {/* Mobile card view */}
                  <div className="lg:hidden">
                    {displayItems.map((item) => {
                      const isParent = !item.parentId;
                      const isChild = !!item.parentId;
                      const isExpanded = expandedParents.has(item.id);

                      // Hide child items if their parent is collapsed
                      if (isChild && !expandedParents.has(item.parentId || "")) {
                        return null;
                      }

                      // Calculate swipe offset
                      const isDeleting = deletingItemId === item.id;
                      const swipeOffset = isDeleting
                        ? window.innerWidth
                        : swipeState.isDragging && swipeState.itemId === item.id
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
                              transition: swipeState.isDragging
                                ? 'none'
                                : isDeleting
                                  ? 'transform 0.3s ease-in-out'
                                  : 'transform 0.2s ease-out',
                            }}
                            onTouchStart={isChild ? (e) => handleTouchStart(e, item.id) : undefined}
                            onTouchMove={isChild ? handleTouchMove : undefined}
                            onTouchEnd={isChild ? () => handleTouchEnd('invoice', inv.id, item.id) : undefined}
                          >
                          <div className="flex items-center justify-between mb-2">
                            <div className={`flex-1 text-base ${isParent ? "font-semibold" : "font-medium"}`}>
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
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                                    className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                                    placeholder="Description"
                                  />
                                ) : (
                                  <span>{item.description}</span>
                                )}
                              </div>
                            </div>
                            {isEditing && (
                              <div className="flex items-center gap-2">
                                {isParent && (
                                  <button
                                    onClick={() => addLineItem(item.id)}
                                    className="text-primary hover:text-primary/80"
                                    title="Add child item"
                                  >
                                    <Plus className="h-5 w-5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => removeLineItem(item.id)}
                                  className="text-red-600 hover:text-red-700"
                                  title="Delete item"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                            {(isEditing || (item.timeHours && item.timeRate)) && !isParent && (
                              <>
                                <div className="text-muted-foreground">Time:</div>
                                {isEditing ? (
                                  <div className="flex gap-1 justify-end">
                                    <input
                                      type="number"
                                      value={item.timeHours || ""}
                                      onChange={(e) => updateLineItem(item.id, "timeHours", e.target.value)}
                                      className="w-16 rounded border bg-background px-2 py-1 text-sm text-right"
                                      placeholder="Hrs"
                                      step="0.5"
                                    />
                                    <span className="self-center text-xs">@</span>
                                    <input
                                      type="number"
                                      value={item.timeRate || ""}
                                      onChange={(e) => updateLineItem(item.id, "timeRate", e.target.value)}
                                      className="w-20 rounded border bg-background px-2 py-1 text-sm text-right"
                                      placeholder="Rate"
                                      step="1"
                                    />
                                  </div>
                                ) : (
                                  <div className="text-right">{item.timeHours} hrs @ {formatCurrency(item.timeRate || 0)}/hr</div>
                                )}
                              </>
                            )}
                            {(isEditing || item.materialsCost) && !isParent && (
                              <>
                                <div className="text-muted-foreground">Materials:</div>
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={item.materialsCost || ""}
                                    onChange={(e) => updateLineItem(item.id, "materialsCost", e.target.value)}
                                    className="rounded border bg-background px-2 py-1 text-sm text-right"
                                    placeholder="Cost"
                                    step="0.01"
                                  />
                                ) : (
                                  <div className="text-right">{formatCurrency(item.materialsCost || 0)}</div>
                                )}
                              </>
                            )}
                            <div className="text-muted-foreground">Total:</div>
                            <div className="text-right font-semibold">
                              {formatCurrency(getItemTotal(item, displayItems))}
                            </div>
                          </div>
                          </div>
                        </div>
                      );
                    })}
                    {isEditing && (
                      <div className="border-b p-4">
                        <button
                          onClick={() => addLineItem(null)}
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <Plus className="h-4 w-4" />
                          Add Section
                        </button>
                      </div>
                    )}
                    <div className="border-t bg-muted/30 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(inv.subtotal)}</span>
                      </div>
                      {Number(inv.taxRate) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax ({inv.taxRate}%)</span>
                          <span>{formatCurrency(inv.taxAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-base border-t pt-2">
                        <span>Total</span>
                        <span>{formatCurrency(inv.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
              })
            )}
          </div>
        )}

        {/* Timeline view - shown when history tab active and (desktop OR mobile with "all" filter) */}
        {activeTab === "history" && (!isMobile || historyFilter === "all") && (
          <HistoryTab projectId={projectId} filter="all" onNavigateToItem={handleNavigateToItem} />
        )}
      </div>
    </div>
  );
}

function HistoryTab({
  projectId,
  filter,
  onNavigateToItem
}: {
  projectId: string;
  filter: HistoryFilter;
  onNavigateToItem?: (entityType: string, entityId: string) => void;
}) {
  const [logs, setLogs] = useState<
    { id: string; action: string; entityType: string; entityId: string; createdAt: string; details: Record<string, unknown> | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/history`)
      .then((r) => r.json())
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Filter logs based on selected filter
  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    if (filter === "estimates") return log.entityType === "estimate";
    if (filter === "change-orders") return log.entityType === "change_order";
    if (filter === "invoices") return log.entityType === "invoice";
    return true;
  });

  // Format timeline event message
  const getEventMessage = (log: typeof logs[0]) => {
    const details = log.details || {};

    if (log.action === "estimate_created") {
      return `Estimate #${details.estimateNumber} created`;
    }

    if (log.action === "estimate_updated") {
      const changeOrderPart = details.changeOrderNumber
        ? ` by Change Order #${details.changeOrderNumber}`
        : "";
      return `Estimate #${details.estimateNumber} updated to v${details.versionNumber}${changeOrderPart}`;
    }

    // Default formatting for other actions
    return log.action.replace(/_/g, " ");
  };

  const getEventSubtext = (log: typeof logs[0]) => {
    const details = log.details || {};

    if (log.action === "estimate_updated" && details.changeOrderTitle) {
      return `${details.changeOrderTitle} — ${formatDate(log.createdAt)}`;
    }

    if (log.action === "estimate_created" || log.action === "estimate_updated") {
      return `${details.estimateTitle || ""} — ${formatDate(log.createdAt)}`;
    }

    return `${log.entityType} — ${formatDate(log.createdAt)}`;
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filteredLogs.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        {filter === "all" ? "No history yet." : `No ${filter.replace("-", " ")} found.`}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredLogs.map((log) => (
        <div
          key={log.id}
          onClick={() => onNavigateToItem?.(log.entityType, log.entityId)}
          className="flex items-start gap-3 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent transition-colors"
        >
          <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {getEventMessage(log)}
            </p>
            <p className="text-xs text-muted-foreground">
              {getEventSubtext(log)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
