import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * GET /api/estimates/[estimateId]/versions
 * Retrieves version history for an estimate
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { estimateId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { estimateId } = params;

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

  // Get all versions ordered by version number
  const versions = await prisma.estimateVersion.findMany({
    where: { estimateId },
    orderBy: { versionNumber: "asc" },
    include: {
      changeOrder: {
        select: {
          id: true,
          number: true,
          title: true,
          description: true,
        },
      },
    },
  });

  return NextResponse.json({ versions }, { status: 200 });
}
