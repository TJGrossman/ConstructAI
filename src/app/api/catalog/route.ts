import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { items } = await req.json();

  if (!items?.length) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }

  await prisma.$transaction(
    items.map(
      (item: {
        name: string;
        description?: string;
        category: string;
        unit: string;
        defaultRate: number;
      }) =>
        prisma.serviceCatalogItem.create({
          data: {
            userId,
            name: item.name,
            description: item.description || null,
            category: item.category,
            unit: item.unit,
            defaultRate: item.defaultRate,
          },
        })
    )
  );

  // Mark onboarding as done
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingDone: true },
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const items = await prisma.serviceCatalogItem.findMany({
    where: { userId },
    orderBy: { category: "asc" },
  });

  return NextResponse.json(items);
}
