import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkEntryItem } from "@/lib/ai/processor";
import { validateWorkEntries } from "@/lib/ai/parsers/workEntry";

export const dynamic = 'force-dynamic';

/**
 * POST /api/work-entries
 * Create work entries from AI-suggested mappings
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { receiptId, workEntries } = await req.json();

  if (!receiptId || !workEntries?.length) {
    return NextResponse.json(
      { error: "receiptId and workEntries are required" },
      { status: 400 }
    );
  }

  // Validate work entries
  const validation = validateWorkEntries(workEntries as WorkEntryItem[]);
  if (!validation.isValid) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.errors },
      { status: 400 }
    );
  }

  // Verify receipt exists and user has access
  const receipt = await prisma.receipt.findFirst({
    where: {
      id: receiptId,
      project: { userId },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  // Create work entries
  const createdEntries = await Promise.all(
    (workEntries as WorkEntryItem[]).map((entry) =>
      prisma.workEntry.create({
        data: {
          receiptId,
          estimateLineItemId: entry.estimateLineItemId,
          actualTimeHours: entry.actualTimeHours ?? null,
          actualTimeRate: entry.actualTimeRate ?? null,
          actualTimeCost: entry.actualTimeCost ?? null,
          actualMaterialsCost: entry.actualMaterialsCost ?? null,
          actualTotal: entry.actualTotal,
          notes: entry.notes || null,
          status: "pending",
        },
        include: {
          estimateLineItem: {
            select: {
              id: true,
              description: true,
              estimateId: true,
            },
          },
        },
      })
    )
  );

  // Audit log
  await prisma.auditLog.create({
    data: {
      projectId: receipt.projectId,
      userId,
      action: "work_entries_created",
      entityType: "work_entry",
      entityId: receiptId,
      details: { count: createdEntries.length },
    },
  });

  return NextResponse.json({ workEntries: createdEntries }, { status: 201 });
}

/**
 * GET /api/work-entries?estimateId=xxx
 * List work entries for an estimate
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const estimateId = searchParams.get("estimateId");
  const status = searchParams.get("status");

  if (!estimateId) {
    return NextResponse.json(
      { error: "estimateId is required" },
      { status: 400 }
    );
  }

  // Verify estimate access
  const estimate = await prisma.estimate.findFirst({
    where: {
      id: estimateId,
      project: { userId },
    },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  // Get work entries
  const workEntries = await prisma.workEntry.findMany({
    where: {
      estimateLineItem: {
        estimateId,
      },
      ...(status ? { status } : {}),
    },
    include: {
      receipt: true,
      estimateLineItem: {
        select: {
          id: true,
          description: true,
          timeCost: true,
          materialsCost: true,
          total: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ workEntries }, { status: 200 });
}
