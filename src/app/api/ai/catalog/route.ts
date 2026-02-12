import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateCatalog } from "@/lib/ai/processor";
import { validateCatalogItems } from "@/lib/ai/parsers/catalog";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { description } = await req.json();
  if (!description || typeof description !== "string") {
    return NextResponse.json(
      { error: "Description is required" },
      { status: 400 }
    );
  }

  const rawItems = await generateCatalog(description);
  const items = validateCatalogItems(rawItems);

  return NextResponse.json({ items });
}
