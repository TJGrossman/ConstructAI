import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * GET /api/estimates/versions/[versionId]
 * Retrieves a specific version snapshot
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { versionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { versionId } = params;

  // Get version with estimate to verify access
  const version = await prisma.estimateVersion.findUnique({
    where: { id: versionId },
    include: {
      estimate: {
        include: {
          project: {
            select: { userId: true },
          },
        },
      },
      changeOrder: {
        select: {
          id: true,
          number: true,
          title: true,
          description: true,
          createdAt: true,
        },
      },
    },
  });

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Verify access
  if (version.estimate.project.userId !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json({ version }, { status: 200 });
}
