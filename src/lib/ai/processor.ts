import { gemini } from "./client";
import {
  buildProcessingSystemPrompt,
  buildCatalogGenerationPrompt,
} from "./prompts";
import { ServiceCatalogItem } from "@prisma/client";

export interface LineItem {
  description: string;
  catalogItemId?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category?: string;
  action?: "add" | "remove" | "modify";
  originalDesc?: string;
}

export interface AIProcessingResult {
  intent:
    | "new_estimate"
    | "change_order"
    | "invoice_entry"
    | "question"
    | "general";
  message: string;
  structured?: {
    type: "estimate" | "change_order" | "invoice";
    title?: string;
    lineItems: LineItem[];
    notes?: string;
  };
  followUpQuestion?: string;
}

export interface CatalogGenerationResult {
  name: string;
  description?: string;
  category: string;
  unit: string;
  defaultRate: number;
}

export async function processMessage(
  userMessage: string,
  catalogItems: ServiceCatalogItem[],
  projectContext: string,
  conversationHistory: { role: string; content: string }[]
): Promise<AIProcessingResult> {
  const systemPrompt = buildProcessingSystemPrompt(
    catalogItems,
    projectContext
  );

  const model = gemini.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    systemInstruction: {
      parts: [{ text: systemPrompt }],
      role: "user",
    },
  });

  // Build chat history for Gemini
  const history = conversationHistory.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history });

  const result = await chat.sendMessage(userMessage);
  const text = result.response.text();

  try {
    return JSON.parse(text) as AIProcessingResult;
  } catch {
    return {
      intent: "general",
      message: text,
    };
  }
}

export async function generateCatalog(
  description: string
): Promise<CatalogGenerationResult[]> {
  const prompt = buildCatalogGenerationPrompt(description);

  const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text) as CatalogGenerationResult[];
  } catch {
    return [];
  }
}
