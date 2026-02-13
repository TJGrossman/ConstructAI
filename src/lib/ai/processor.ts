import { openai } from "./client";
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

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  });

  const text = response.choices[0]?.message?.content || "";

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

  const response = await openai.chat.completions.create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 4096,
  });

  const text = response.choices[0]?.message?.content || "";

  try {
    return JSON.parse(text) as CatalogGenerationResult[];
  } catch {
    return [];
  }
}
