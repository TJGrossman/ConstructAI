import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * Admin endpoint to clear all test data
 * Preserves: User accounts, ServiceCatalogItems
 * Clears: Projects, Estimates, Invoices, Messages, etc.
 */
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  // SAFETY: Only allow demo accounts to reset data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isDemoAccount: true, email: true }
  });

  if (!user?.isDemoAccount) {
    console.log('[Reset Data] Blocked - user is not a demo account:', user?.email);
    return NextResponse.json(
      { error: "This feature is only available for demo accounts" },
      { status: 403 }
    );
  }

  try {
    console.log('[Reset Data] Starting data wipe for demo account:', user.email);

    // Delete in correct order (respecting foreign key constraints)
    const projectIds = await getProjectIds(userId);

    // 1. Delete messages and conversations
    await prisma.message.deleteMany({
      where: { conversation: { projectId: { in: projectIds } } }
    });
    console.log('[Reset Data] Deleted messages');

    await prisma.conversation.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    console.log('[Reset Data] Deleted conversations');

    // 2. Delete audit logs
    await prisma.auditLog.deleteMany({
      where: { userId }
    });
    console.log('[Reset Data] Deleted audit logs');

    // 3. Delete estimate versions (references both estimates and change orders)
    const estimateIds = await prisma.estimate.findMany({
      where: { project: { userId } },
      select: { id: true }
    });
    await prisma.estimateVersion.deleteMany({
      where: { estimateId: { in: estimateIds.map(e => e.id) } }
    });
    console.log('[Reset Data] Deleted estimate versions');

    // 4. Delete work entries (references receipts and estimate line items)
    await prisma.workEntry.deleteMany({
      where: { receipt: { projectId: { in: projectIds } } }
    });
    console.log('[Reset Data] Deleted work entries');

    // 5. Delete receipts
    await prisma.receipt.deleteMany({
      where: { projectId: { in: projectIds } }
    });
    console.log('[Reset Data] Deleted receipts');

    // 6. Delete line items (must delete before their parent documents)
    await prisma.changeOrderLineItem.deleteMany({
      where: { changeOrder: { project: { userId } } }
    });
    console.log('[Reset Data] Deleted change order line items');

    await prisma.invoiceLineItem.deleteMany({
      where: { invoice: { project: { userId } } }
    });
    console.log('[Reset Data] Deleted invoice line items');

    await prisma.estimateLineItem.deleteMany({
      where: { estimate: { project: { userId } } }
    });
    console.log('[Reset Data] Deleted estimate line items');

    // 7. Delete change orders (must delete before estimates due to estimateId FK)
    await prisma.changeOrder.deleteMany({
      where: { project: { userId } }
    });
    console.log('[Reset Data] Deleted change orders');

    // 8. Delete invoices
    await prisma.invoice.deleteMany({
      where: { project: { userId } }
    });
    console.log('[Reset Data] Deleted invoices');

    // 9. Delete estimates
    await prisma.estimate.deleteMany({
      where: { project: { userId } }
    });
    console.log('[Reset Data] Deleted estimates');

    // 10. Delete projects
    await prisma.project.deleteMany({
      where: { userId }
    });
    console.log('[Reset Data] Deleted projects');

    // 11. Delete customers
    await prisma.customer.deleteMany({
      where: { userId }
    });
    console.log('[Reset Data] Deleted customers');

    console.log('[Reset Data] Data wipe complete!');

    return NextResponse.json({
      success: true,
      message: "All test data cleared successfully",
      preserved: ["User account", "Service catalog items"]
    });
  } catch (error) {
    console.error('[Reset Data] Error:', error);
    return NextResponse.json(
      {
        error: "Failed to reset data",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

async function getProjectIds(userId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true }
  });
  return projects.map(p => p.id);
}
