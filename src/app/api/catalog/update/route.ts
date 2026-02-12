import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { items } = await req.json();

  // Delete existing items for this user and recreate
  await prisma.serviceCatalogItem.deleteMany({ where: { userId } });

  if (items?.length) {
    await prisma.$transaction(
      items.map(
        (item: {
          name: string;
          description?: string;
          category: string;
          unit: string;
          defaultRate: string | number;
        }) =>
          prisma.serviceCatalogItem.create({
            data: {
              userId,
              name: item.name,
              description: item.description || null,
              category: item.category || "other",
              unit: item.unit || "hour",
              defaultRate: parseFloat(String(item.defaultRate)) || 0,
            },
          })
      )
    );
  }

  return NextResponse.json({ success: true });
}
