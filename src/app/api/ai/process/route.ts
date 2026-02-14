import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { processMessage } from "@/lib/ai/processor";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { projectId, message, conversationId, pendingDraft } = await req.json();

  if (!projectId || !message) {
    return NextResponse.json(
      { error: "projectId and message are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      customer: true,
      estimates: { include: { lineItems: true }, orderBy: { number: "desc" } },
      changeOrders: { include: { lineItems: true } },
      invoices: { include: { lineItems: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const catalogItems = await prisma.serviceCatalogItem.findMany({
    where: { userId, isActive: true },
  });

  // Build project context with detailed line items for work entry matching
  const estimatesSummary = project.estimates
    .map((e) => {
      // Show all items in hierarchy so AI can match work to specific child items
      const parents = (e.lineItems || []).filter((item) => !item.parentId);
      const itemsList = parents.map((parent) => {
        const children = (e.lineItems || []).filter((item) => item.parentId === parent.id);
        if (children.length > 0) {
          const childrenStr = children
            .map((child) => `    - [${child.id}] ${child.description}`)
            .join("\n");
          return `  - [${parent.id}] ${parent.description}\n${childrenStr}`;
        }
        return `  - [${parent.id}] ${parent.description}`;
      }).join("\n");
      return `Estimate #${e.number} "${e.title}" (${e.status}): $${e.total}
Line Items:
${itemsList || "  None"}`;
    })
    .join("\n\n");

  const changeOrdersSummary = project.changeOrders
    .map(
      (co) =>
        `CO #${co.number} "${co.title}" (${co.status}): impact $${co.costImpact}`
    )
    .join("\n");

  const invoicesSummary = project.invoices
    .map((inv) => `Invoice #${inv.number} (${inv.status}): $${inv.total}`)
    .join("\n");

  const projectContext = `Project: ${project.name}
Customer: ${project.customer.name}
Address: ${project.address || "N/A"}
Description: ${project.description || "N/A"}
Status: ${project.status}

Existing Estimates:
${estimatesSummary || "None"}

Change Orders:
${changeOrdersSummary || "None"}

Invoices:
${invoicesSummary || "None"}

IMPORTANT: When recording work entries, match the work to existing estimate line items by ID shown in [brackets].`;

  // Get or create conversation
  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, projectId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
    });
  }

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { projectId, channel: "web" },
      include: { messages: true },
    });
  }

  // Save user message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: message,
      channel: "web",
    },
  });

  const history = conversation.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const result = await processMessage(
    message,
    catalogItems,
    projectContext,
    history,
    pendingDraft
  );

  // Save assistant message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: result.message,
      metadata: result.structured ? (result as object) : undefined,
      channel: "web",
    },
  });

  return NextResponse.json({
    ...result,
    conversationId: conversation.id,
  });
}
