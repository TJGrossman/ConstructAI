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
  const { projectId, message, conversationId } = await req.json();

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

  // Build project context
  const estimatesSummary = project.estimates
    .map(
      (e) =>
        `Estimate #${e.number} "${e.title}" (${e.status}): $${e.total} - ${e.lineItems.length} items`
    )
    .join("\n");

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
${invoicesSummary || "None"}`;

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
    history
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
