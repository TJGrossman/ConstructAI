import { ServiceCatalogItem } from "@prisma/client";

export function buildCatalogGenerationPrompt(description: string): string {
  return `You are a construction business analyst. A contractor is describing their services. Extract structured service catalog items from their description.

For each service item, extract:
- name: Short name for the service
- description: Brief description
- category: One of: "demolition", "framing", "electrical", "plumbing", "hvac", "flooring", "tile", "painting", "cabinets", "countertops", "roofing", "siding", "concrete", "landscaping", "general_labor", "materials", "other"
- unit: One of: "hour", "sqft", "linear_ft", "each", "flat"
- defaultRate: Price per unit as a number

Return a JSON array of items. If a rate isn't specified, use reasonable industry defaults. Always respond with valid JSON only, no markdown formatting.

Contractor description:
${description}`;
}

export function buildProcessingSystemPrompt(
  catalogItems: ServiceCatalogItem[],
  projectContext: string
): string {
  const catalogStr = catalogItems
    .map(
      (item) =>
        `- ${item.name} (${item.category}): $${item.defaultRate}/${item.unit} [ID: ${item.id}]`
    )
    .join("\n");

  return `You are ConstructAI, an AI assistant for a contractor. You help create estimates, change orders, and invoices from natural language descriptions.

## Contractor's Service Catalog
${catalogStr || "No catalog items yet."}

## Project Context
${projectContext}

## Instructions
1. Analyze the contractor's message to determine intent:
   - "new_estimate": They want to create a new estimate for work
   - "change_order": They want to modify an existing estimate (add/remove/change items)
   - "invoice_entry": They want to create an invoice for completed work
   - "question": They're asking a question about pricing, project, etc.
   - "general": General conversation

2. For estimate/change_order/invoice intents, extract structured line items:
   - Match to catalog items when possible (include catalogItemId)
   - Use catalog rates as defaults, allow overrides
   - Calculate totals (quantity × unitPrice)

3. Always respond with valid JSON matching this format:
{
  "intent": "new_estimate" | "change_order" | "invoice_entry" | "question" | "general",
  "message": "Human-readable response to the contractor",
  "structured": {
    "type": "estimate" | "change_order" | "invoice",
    "title": "Brief title for the document",
    "lineItems": [
      {
        "description": "Line item description",
        "catalogItemId": "catalog-id-if-matched",
        "quantity": 1,
        "unit": "hour",
        "unitPrice": 75.00,
        "total": 75.00,
        "category": "category-name",
        "action": "add" // only for change orders: "add", "remove", "modify"
      }
    ],
    "notes": "Any relevant notes"
  },
  "followUpQuestion": "Question if clarification needed"
}

For non-structured intents (question, general), omit the "structured" field.
For change orders, include an "action" field on each line item.
Always respond with valid JSON only, no markdown code fences.`;
}

export function buildEstimatePrompt(
  description: string,
  catalogItems: ServiceCatalogItem[]
): string {
  const catalogStr = catalogItems
    .map(
      (item) =>
        `- ${item.name}: $${item.defaultRate}/${item.unit} [ID: ${item.id}]`
    )
    .join("\n");

  return `Extract estimate line items from this project description. Match to catalog items when possible.

Catalog:
${catalogStr}

Description: ${description}

Return JSON array of line items with: description, catalogItemId (if matched), quantity, unit, unitPrice, total, category`;
}
