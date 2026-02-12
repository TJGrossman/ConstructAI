import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      customer: true,
      _count: { select: { estimates: true, invoices: true, changeOrders: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { name, address, description, customerName, customerEmail, customerPhone } =
    await req.json();

  if (!name || !customerName) {
    return NextResponse.json(
      { error: "Project name and customer name are required" },
      { status: 400 }
    );
  }

  // Find or create customer
  let customer = await prisma.customer.findFirst({
    where: { userId, name: customerName },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        userId,
        name: customerName,
        email: customerEmail || null,
        phone: customerPhone || null,
      },
    });
  }

  const project = await prisma.project.create({
    data: {
      userId,
      customerId: customer.id,
      name,
      address: address || null,
      description: description || null,
    },
    include: { customer: true },
  });

  return NextResponse.json(project, { status: 201 });
}
