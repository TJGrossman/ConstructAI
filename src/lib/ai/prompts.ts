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
  projectContext: string,
  pendingDraft?: {
    type: string;
    title?: string;
    lineItems?: unknown[];
    workEntries?: unknown[];
    notes?: string;
  }
): string {
  const catalogStr = catalogItems
    .map(
      (item) =>
        `- ${item.name} (${item.category}): $${item.defaultRate}/${item.unit} [ID: ${item.id}]`
    )
    .join("\n");

  const draftContext = pendingDraft
    ? `\n\n## PENDING DRAFT (User is modifying this, DO NOT create a new one!)
**Type**: ${pendingDraft.type}
**Title**: ${pendingDraft.title || "Untitled"}
**Current structure**: ${JSON.stringify(pendingDraft, null, 2)}

IMPORTANT: The user has a draft in progress. If their message is a modification request (e.g., "separate bathrooms into sections", "change the rate", "add X", "remove Y"), MODIFY the existing draft structure above. Return the UPDATED full structure with the same type, don't create a new document.

Examples of modification requests:
- "Separate the two bathrooms into their own sections"
- "Change the labor rate to $85/hr"
- "Add tile installation"
- "Remove the painting line"
- "That looks good but split kitchen into countertops and cabinets"

When modifying:
1. Parse what they want to change
2. Apply the changes to the existing lineItems/workEntries
3. Return the full updated structure with intent "${pendingDraft.type.replace('_', '_')}"
4. Keep the same title unless they explicitly want to change it
`
    : "";

  return `You are ConstructAI, an AI assistant for a contractor. You help create estimates, change orders, invoices, and track work from natural language descriptions.

## Contractor's Service Catalog
${catalogStr || "No catalog items yet."}

## Project Context
${projectContext}${draftContext}

## Instructions
1. Analyze the contractor's message to determine intent:
   - "new_estimate": They want to create a new estimate for work
   - "change_order": They want to modify an existing estimate (add/remove/change items)
   - "invoice_entry": They want to create an invoice for completed work
   - "work_entry": They're recording actual work performed (with receipts/costs)
   - "question": They're asking a question about pricing, project, etc.
   - "general": General conversation

2. For estimate/change_order/invoice intents, extract structured line items:
   - **Hierarchical Organization**: Group related work logically (e.g., "Kitchen Renovation" → "Countertops", "Cabinets")
     - Parent items: Set "isParent": true, these are grouping headers
     - Child items: Omit isParent or set to false
     - Maximum 2 levels (parent → children only)

   - **Dual Time + Materials Structure**: Each line item can have labor, materials, or both
     - For labor: Include timeHours, timeRate, and timeCost (timeHours × timeRate)
     - For materials: Include materialsCost
     - Total = timeCost + materialsCost
     - At least one must be non-zero (unless it's a parent grouping item)

   - Match to catalog items when possible (include catalogItemId)
   - Use catalog rates as defaults, allow overrides

3. For work_entry intent, extract actual costs from receipts/voice notes:
   - Map to existing estimate line items
   - Include actual time worked and materials purchased
   - Suggest which estimate line item this work corresponds to

4. Always respond with valid JSON matching this format:

**For estimates/change orders/invoices:**
{
  "intent": "new_estimate" | "change_order" | "invoice_entry",
  "message": "Human-readable response to the contractor",
  "structured": {
    "type": "estimate" | "change_order" | "invoice",
    "title": "Brief title for the document",
    "lineItems": [
      {
        "description": "Kitchen Renovation",
        "isParent": true,
        "category": "general_labor",
        "timeCost": null,
        "materialsCost": null,
        "total": 0,
        "notes": "Parent item - total calculated from children"
      },
      {
        "description": "Install granite countertops",
        "catalogItemId": "catalog-id-if-matched",
        "category": "countertops",
        "timeHours": 8,
        "timeRate": 75.00,
        "timeCost": 600.00,
        "materialsCost": 1200.00,
        "total": 1800.00,
        "notes": "Includes fabrication and installation",
        "action": "add" // only for change orders: "add", "remove", "modify"
      },
      {
        "description": "Cabinet hardware",
        "category": "materials",
        "timeHours": null,
        "timeRate": null,
        "timeCost": null,
        "materialsCost": 150.00,
        "total": 150.00
      }
    ],
    "notes": "Any relevant notes"
  },
  "followUpQuestion": "Question if clarification needed"
}

**For work entries:**
{
  "intent": "work_entry",
  "message": "Human-readable summary of work performed",
  "structured": {
    "type": "work_entry",
    "workEntries": [
      {
        "estimateLineItemId": "suggested-line-item-id",
        "description": "What was done",
        "actualTimeHours": 10,
        "actualTimeRate": 75.00,
        "actualTimeCost": 750.00,
        "actualMaterialsCost": 200.00,
        "actualTotal": 950.00,
        "notes": "Receipt notes or voice memo"
      }
    ]
  }
}

**Hierarchy Examples:**
- "Kitchen remodel with new counters and cabinets" → Parent: "Kitchen Remodel", Children: "Install countertops", "Install cabinets"
- "Bathroom renovation" → Parent: "Bathroom Renovation", Children: "Demo existing tile", "Install new tile", "Plumbing fixtures"
- "Install 3 ceiling fans" → No hierarchy needed, single line item with timeHours + materialsCost

For non-structured intents (question, general), omit the "structured" field.
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
