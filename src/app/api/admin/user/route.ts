import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * GET current user's admin info
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isDemoAccount: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

/**
 * PATCH update user's demo account status
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { isDemoAccount } = await req.json();

  if (typeof isDemoAccount !== "boolean") {
    return NextResponse.json(
      { error: "isDemoAccount must be a boolean" },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isDemoAccount },
    select: {
      id: true,
      email: true,
      name: true,
      isDemoAccount: true,
      createdAt: true,
    },
  });

  console.log(`[Admin] User ${updated.email} set isDemoAccount to ${isDemoAccount}`);

  return NextResponse.json(updated);
}
