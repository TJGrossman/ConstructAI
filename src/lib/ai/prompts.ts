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

  return `You are ConstructAI, an AI assistant for a contractor. You help create estimates, change orders, invoices, and track work from natural language descriptions.

## Contractor's Service Catalog
${catalogStr || "No catalog items yet."}

## Project Context
${projectContext}

## Instructions
1. Analyze the contractor's message to determine intent:
   - "new_estimate": They want to create a new estimate for work
   - "modify_draft": They want to modify a pending estimate preview (e.g., "change the countertops to marble")
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

**Modify Draft Intent:**
When the user says something like "change the countertops to marble" or "make it 10 hours instead of 8", use "modify_draft" intent and return the COMPLETE updated line items array (not just the changes). The frontend will replace the entire preview with your updated version.

Example:
User: "Kitchen remodel with granite countertops"
→ Returns new_estimate with granite countertops

User: "Actually change it to marble countertops"
→ Returns modify_draft with the COMPLETE line items array, with marble instead of granite

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
