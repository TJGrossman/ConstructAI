import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

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

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const project = await prisma.project.findFirst({
    where: { id: params.projectId, userId },
    include: {
      customer: true,
      estimates: {
        where: { status: "approved" },
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { approvedAt: "asc" },
        take: 1,
      },
      changeOrders: {
        where: { status: "approved" },
        include: { lineItems: true },
        orderBy: { approvedAt: "asc" },
      },
      invoices: {
        include: { lineItems: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const originalEstimate = project.estimates[0];
  if (!originalEstimate) {
    return NextResponse.json({ error: "No approved estimate found" }, { status: 404 });
  }

  console.log('[Reconciliation] Original estimate:', {
    id: originalEstimate.id,
    total: originalEstimate.total,
    lineItemsCount: originalEstimate.lineItems.length
  });

  const lineItemMap = new Map<string, ReconciliationLineItem>();

  originalEstimate.lineItems.forEach((item) => {
    const estimatedCost = Number(item.total);
    lineItemMap.set(item.id, {
      id: item.id,
      description: item.description,
      parentId: item.parentId,
      estimatedCost,
      changeOrders: [],
      adjustedCost: estimatedCost,
      invoicedCost: 0,
      invoices: [],
      variance: 0,
      variancePercent: 0,
    });
  });

  project.changeOrders.forEach((co) => {
    co.lineItems.forEach((item) => {
      const matchingEstimateItem = originalEstimate.lineItems.find(
        (ei) => ei.description === item.description
      );
      if (matchingEstimateItem) {
        const reconItem = lineItemMap.get(matchingEstimateItem.id);
        if (reconItem) {
          const impact = Number(item.total);
          reconItem.changeOrders.push({
            type: co.type as 'customer_requested' | 'unanticipated_issue',
            impact,
            changeOrderNumber: co.number,
            title: co.title,
          });
          reconItem.adjustedCost += impact;
        }
      }
    });
  });

  project.invoices.forEach((invoice) => {
    // Calculate proportional tax factor for this invoice
    // (invoice total includes tax, line items don't)
    const invoiceSubtotal = Number(invoice.subtotal);
    const invoiceTotal = Number(invoice.total);
    const taxFactor = invoiceSubtotal > 0 ? invoiceTotal / invoiceSubtotal : 1;

    invoice.lineItems.forEach((item) => {
      if (item.estimateLineItemId) {
        const reconItem = lineItemMap.get(item.estimateLineItemId);
        if (reconItem) {
          // Apply proportional tax to line item amount
          const lineItemAmount = Number(item.total);
          const amountWithTax = Math.round(lineItemAmount * taxFactor * 100) / 100;

          reconItem.invoicedCost += amountWithTax;
          reconItem.invoices.push({
            number: invoice.number,
            status: invoice.status,
            amount: amountWithTax,
          });
        }
      }
    });
  });

  lineItemMap.forEach((item) => {
    // Variance = Actual - Budget (negative = under budget = good)
    item.variance = item.invoicedCost - item.adjustedCost;
    item.variancePercent = item.adjustedCost > 0 ? (item.variance / item.adjustedCost) * 100 : 0;
  });

  const topLevelItems: ReconciliationLineItem[] = [];
  const itemsArray = Array.from(lineItemMap.values());

  itemsArray.forEach((item) => {
    if (!item.parentId) {
      const children = itemsArray.filter((i) => i.parentId === item.id);
      if (children.length > 0) {
        item.estimatedCost = children.reduce((sum, c) => sum + c.estimatedCost, 0);
        item.adjustedCost = children.reduce((sum, c) => sum + c.adjustedCost, 0);
        item.invoicedCost = children.reduce((sum, c) => sum + c.invoicedCost, 0);
        // Variance = Actual - Budget (negative = under budget = good)
        item.variance = item.invoicedCost - item.adjustedCost;
        item.variancePercent = item.adjustedCost > 0 ? (item.variance / item.adjustedCost) * 100 : 0;
        item.changeOrders = children.flatMap((c) => c.changeOrders);
        item.invoices = children.flatMap((c) => c.invoices);
        item.children = children;
      }
      topLevelItems.push(item);
    }
  });

  const originalEstimateTotal = Number(originalEstimate.total);
  const customerRequestedChanges = project.changeOrders
    .filter((co) => co.type === 'customer_requested')
    .reduce((sum, co) => sum + Number(co.costImpact), 0);
  const unanticipatedChanges = project.changeOrders
    .filter((co) => co.type === 'unanticipated_issue')
    .reduce((sum, co) => sum + Number(co.costImpact), 0);
  const estimatedCost = originalEstimateTotal + customerRequestedChanges + unanticipatedChanges;
  const invoicedTotal = project.invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const paidTotal = project.invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + Number(inv.total), 0);
  const unpaidTotal = invoicedTotal - paidTotal;
  const remainingBudget = estimatedCost - invoicedTotal;
  // Variance = Actual - Budget (negative = under budget = good)
  const variance = invoicedTotal - estimatedCost;
  const variancePercent = estimatedCost > 0 ? (variance / estimatedCost) * 100 : 0;

  console.log('[Reconciliation] Calculated totals:', {
    originalEstimateTotal,
    customerRequestedChanges,
    unanticipatedChanges,
    estimatedCost,
    invoicesCount: project.invoices.length,
    invoicedTotal,
    paidTotal,
    unpaidTotal
  });

  const data: ReconciliationData = {
    projectName: project.name,
    customerName: project.customer.name,
    originalEstimate: originalEstimateTotal,
    customerRequestedChanges,
    unanticipatedChanges,
    estimatedCost,
    maxBudget: project.maxBudget ? Number(project.maxBudget) : null,
    invoicedTotal,
    paidTotal,
    unpaidTotal,
    remainingBudget,
    variance,
    variancePercent,
    lineItems: topLevelItems,
  };

  return NextResponse.json(data);
}
