import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, existingItems } = await req.json();

    const systemPrompt = `You are a helpful assistant for contractors managing their service catalog.

Current catalog:
${existingItems.map((item: { name: string; category: string; unit: string; defaultRate: number }) =>
  `- ${item.name}: $${item.defaultRate}/${item.unit} (${item.category})`
).join('\n') || 'Empty catalog'}

Your job:
1. Help contractors add, update, or remove services
2. Extract service details from natural language
3. When you have enough information to modify the catalog, return structured data
4. Ask clarifying questions if needed (rate, unit, category)

Common units: hour, sqft, linear_ft, each, flat
Common categories: demolition, framing, electrical, plumbing, hvac, flooring, tile, painting, cabinets, countertops, roofing, siding, concrete, landscaping, general_labor, materials, other

When returning catalog items, use this JSON format:
{
  "message": "Your response",
  "catalogItems": [
    { "name": "Service Name", "category": "category", "unit": "hour", "defaultRate": 75, "description": "" }
  ]
}

Only include catalogItems when you have complete information to update the catalog.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Try to parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content.text);
    } catch {
      // If not JSON, return as plain message
      parsedResponse = { message: content.text };
    }

    return NextResponse.json(parsedResponse);
  } catch (error) {
    console.error("Catalog chat error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
