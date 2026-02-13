import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export const dynamic = 'force-dynamic';

/**
 * POST /api/receipts
 * Upload receipt file and create receipt record
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string;
    const description = formData.get("description") as string | null;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "file and projectId are required" },
        { status: 400 }
      );
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "uploads", "receipts", projectId);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}_${originalName}`;
    const filePath = join(uploadsDir, fileName);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create receipt record
    const receipt = await prisma.receipt.create({
      data: {
        projectId,
        fileName: file.name,
        filePath: `/uploads/receipts/${projectId}/${fileName}`,
        fileSize: file.size,
        mimeType: file.type,
        description: description || null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        projectId,
        userId,
        action: "receipt_uploaded",
        entityType: "receipt",
        entityId: receipt.id,
        details: { fileName: file.name, fileSize: file.size },
      },
    });

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    console.error("Receipt upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload receipt" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/receipts?projectId=xxx
 * List receipts for a project
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const receipts = await prisma.receipt.findMany({
    where: { projectId },
    orderBy: { uploadedAt: "desc" },
    include: {
      workEntries: {
        include: {
          estimateLineItem: {
            select: {
              id: true,
              description: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ receipts }, { status: 200 });
}
