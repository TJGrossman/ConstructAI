import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gemini } from "@/lib/ai/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
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

    const model = gemini.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: {
        parts: [{ text: systemPrompt }],
        role: "user",
      },
    });

    const result = await model.generateContent(message);
    const text = result.response.text();

    // Try to parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(text);
    } catch {
      // If not JSON, return as plain message
      parsedResponse = { message: text };
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
