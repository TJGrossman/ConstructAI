import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateVariance } from "@/lib/ai/parsers/workEntry";

export const dynamic = 'force-dynamic';

interface LineItemReconciliation {
  lineItemId: string;
  description: string;
  category: string | null;
  estimatedTimeCost: number;
  estimatedMaterialsCost: number;
  estimatedTotal: number;
  actualTimeCost: number;
  actualMaterialsCost: number;
  actualTotal: number;
  variance: number;
  variancePercent: number;
  isOverBudget: boolean;
  workEntryCount: number;
}

interface ProjectReconciliation {
  projectId: string;
  projectName: string;
  estimates: Array<{
    estimateId: string;
    estimateNumber: number;
    estimateTitle: string;
    lineItems: LineItemReconciliation[];
    totalEstimated: number;
    totalActual: number;
    totalVariance: number;
    totalVariancePercent: number;
  }>;
  grandTotalEstimated: number;
  grandTotalActual: number;
  grandTotalVariance: number;
  grandTotalVariancePercent: number;
}

/**
 * GET /api/projects/[projectId]/reconciliation
 * Calculate actual vs. estimated costs with variance
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { projectId } = params;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get all estimates for the project with line items and work entries
  const estimates = await prisma.estimate.findMany({
    where: { projectId },
    include: {
      lineItems: {
        include: {
          workEntries: {
            where: { status: "approved" }, // Only count approved work entries
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { number: "asc" },
  });

  const reconciliation: ProjectReconciliation = {
    projectId,
    projectName: project.name,
    estimates: [],
    grandTotalEstimated: 0,
    grandTotalActual: 0,
    grandTotalVariance: 0,
    grandTotalVariancePercent: 0,
  };

  // Process each estimate
  for (const estimate of estimates) {
    const lineItemReconciliations: LineItemReconciliation[] = [];
    let estimateTotalEstimated = 0;
    let estimateTotalActual = 0;

    // Process each line item (only root-level items to avoid double-counting hierarchy)
    const rootLineItems = estimate.lineItems.filter((item) => !item.parentId);

    for (const lineItem of rootLineItems) {
      const estimatedTimeCost = Number(lineItem.timeCost || 0);
      const estimatedMaterialsCost = Number(lineItem.materialsCost || 0);
      const estimatedTotal = Number(lineItem.total);

      // Sum actual costs from work entries
      const actualTimeCost = lineItem.workEntries.reduce(
        (sum, we) => sum + Number(we.actualTimeCost || 0),
        0
      );
      const actualMaterialsCost = lineItem.workEntries.reduce(
        (sum, we) => sum + Number(we.actualMaterialsCost || 0),
        0
      );
      const actualTotal = lineItem.workEntries.reduce(
        (sum, we) => sum + Number(we.actualTotal),
        0
      );

      const varianceData = calculateVariance(estimatedTotal, actualTotal);

      lineItemReconciliations.push({
        lineItemId: lineItem.id,
        description: lineItem.description,
        category: lineItem.category,
        estimatedTimeCost,
        estimatedMaterialsCost,
        estimatedTotal,
        actualTimeCost,
        actualMaterialsCost,
        actualTotal,
        variance: varianceData.variance,
        variancePercent: varianceData.variancePercent,
        isOverBudget: varianceData.isOverBudget,
        workEntryCount: lineItem.workEntries.length,
      });

      estimateTotalEstimated += estimatedTotal;
      estimateTotalActual += actualTotal;
    }

    const estimateVariance = calculateVariance(
      estimateTotalEstimated,
      estimateTotalActual
    );

    reconciliation.estimates.push({
      estimateId: estimate.id,
      estimateNumber: estimate.number,
      estimateTitle: estimate.title,
      lineItems: lineItemReconciliations,
      totalEstimated: estimateTotalEstimated,
      totalActual: estimateTotalActual,
      totalVariance: estimateVariance.variance,
      totalVariancePercent: estimateVariance.variancePercent,
    });

    reconciliation.grandTotalEstimated += estimateTotalEstimated;
    reconciliation.grandTotalActual += estimateTotalActual;
  }

  const grandVariance = calculateVariance(
    reconciliation.grandTotalEstimated,
    reconciliation.grandTotalActual
  );
  reconciliation.grandTotalVariance = grandVariance.variance;
  reconciliation.grandTotalVariancePercent = grandVariance.variancePercent;

  return NextResponse.json({ reconciliation }, { status: 200 });
}
