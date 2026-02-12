import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
        include: { lineItems: true },
        orderBy: { number: "desc" },
      },
      changeOrders: {
        include: { lineItems: true },
        orderBy: { number: "desc" },
      },
      invoices: {
        include: { lineItems: true },
        orderBy: { number: "desc" },
      },
      conversations: {
        include: { messages: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const data = await req.json();

  const project = await prisma.project.updateMany({
    where: { id: params.projectId, userId },
    data: {
      name: data.name,
      address: data.address,
      description: data.description,
      status: data.status,
    },
  });

  if (project.count === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
