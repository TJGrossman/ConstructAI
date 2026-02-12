import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      companyName: true,
      phone: true,
      licenseNumber: true,
      defaultMarkup: true,
      defaultTaxRate: true,
      paymentTerms: true,
    },
  });

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const data = await req.json();

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name || undefined,
      companyName: data.companyName || null,
      phone: data.phone || null,
      licenseNumber: data.licenseNumber || null,
      defaultMarkup: data.defaultMarkup ? parseFloat(data.defaultMarkup) : undefined,
      defaultTaxRate: data.defaultTaxRate ? parseFloat(data.defaultTaxRate) : undefined,
      paymentTerms: data.paymentTerms || undefined,
    },
  });

  return NextResponse.json({ success: true });
}
