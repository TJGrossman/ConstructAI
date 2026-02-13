# Database Migration Guide

## Schema Changes Summary

The Prisma schema has been updated with the following changes:

### 1. Hierarchical Line Items (Self-Referential)
All line item models now support parent-child relationships:
- `EstimateLineItem` - added `parentId`, `parent`, `children`
- `ChangeOrderLineItem` - added `parentId`, `parent`, `children`
- `InvoiceLineItem` - added `parentId`, `parent`, `children`

### 2. Dual Time + Materials Structure
Replaced `quantity`, `unit`, `unitPrice` with:
- `timeHours` (Decimal, nullable)
- `timeRate` (Decimal, nullable)
- `timeCost` (Decimal, nullable)
- `materialsCost` (Decimal, nullable)
- `total` (Decimal, required)

**Validation**: At least one of `timeCost` or `materialsCost` must be non-zero.

### 3. New Models

#### Receipt
```prisma
model Receipt {
  id          String   @id @default(cuid())
  projectId   String
  fileName    String
  filePath    String
  fileSize    Int
  mimeType    String
  description String?
  uploadedAt  DateTime @default(now())
}
```

#### WorkEntry
```prisma
model WorkEntry {
  id                 String @id @default(cuid())
  receiptId          String
  estimateLineItemId String
  actualTimeHours    Decimal?
  actualTimeRate     Decimal?
  actualTimeCost     Decimal?
  actualMaterialsCost Decimal?
  actualTotal        Decimal
  notes              String?
  status             String @default("pending")
}
```

#### EstimateVersion
```prisma
model EstimateVersion {
  id                String @id @default(cuid())
  estimateId        String
  versionNumber     Int
  changeOrderId     String?
  lineItemsSnapshot Json
  subtotal          Decimal
  taxRate           Decimal
  taxAmount         Decimal
  total             Decimal
  notes             String?
}
```

## Running the Migration

### Development Environment

```bash
# Generate and apply migration
npx prisma migrate dev --name add_hierarchy_dual_structure_work_tracking

# Generate Prisma Client
npx prisma generate
```

### Production Environment

```bash
# Apply migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

## Data Migration Script (Optional)

If you have existing data, create a migration script to convert old line items:

```typescript
// prisma/migrations/migrate-to-dual-structure.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all existing estimate line items
  const estimateItems = await prisma.estimateLineItem.findMany();

  for (const item of estimateItems) {
    // Heuristic: unit === "hour" → time, else materials
    const isTime = item.unit === 'hour' || item.unit === 'hr' || item.unit === 'hours';

    await prisma.estimateLineItem.update({
      where: { id: item.id },
      data: {
        timeHours: isTime ? item.quantity : null,
        timeRate: isTime ? item.unitPrice : null,
        timeCost: isTime ? item.total : null,
        materialsCost: !isTime ? item.total : null,
      }
    });
  }

  // Create initial version snapshots for all estimates
  const estimates = await prisma.estimate.findMany({
    include: { lineItems: true }
  });

  for (const estimate of estimates) {
    await prisma.estimateVersion.create({
      data: {
        estimateId: estimate.id,
        versionNumber: 1,
        lineItemsSnapshot: estimate.lineItems,
        subtotal: estimate.subtotal,
        taxRate: estimate.taxRate,
        taxAmount: estimate.taxAmount,
        total: estimate.total,
        notes: `Initial version (migrated)`
      }
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Verification

After migration, verify:

1. **Schema sync**: `npx prisma validate`
2. **Database connection**: `npx prisma db pull` (should show no changes)
3. **Client generation**: `npx prisma generate`
4. **Test queries**: Run sample queries to ensure relationships work

## Rollback Plan

If issues occur, rollback using:

```bash
# Undo last migration
npx prisma migrate resolve --rolled-back <migration-name>

# Restore from backup (recommended before migrating)
pg_restore -d database_name backup.dump
```

---
*Created: 2026-02-12*
