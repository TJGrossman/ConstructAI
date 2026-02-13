# ConstructAI: Hierarchical Estimates & Work Tracking - Quick Start Guide

## 🎯 What's New

Your ConstructAI platform now supports:

1. **Hierarchical Estimates** - Group work logically (e.g., "Kitchen Remodel" → "Countertops", "Cabinets")
2. **Dual Time + Materials** - Each line item can have labor hours AND materials on the same line
3. **Work Tracking** - Upload receipts, AI maps to estimate line items, track budget variance in real-time
4. **Estimate Versioning** - See what your estimate looked like at any point in history

---

## 🚀 Getting Started

### Step 1: Run Database Migration

```bash
cd /Users/theodoregrossman/Desktop/Claude\ Code\ Projects/ConstructAI

# Generate and apply migration
npx prisma migrate dev --name add_hierarchy_dual_structure_work_tracking

# Generate Prisma Client
npx prisma generate
```

### Step 2: Start Development Server

```bash
npm run dev
```

Visit: `http://localhost:3000`

---

## 📖 Usage Examples

### Creating a Hierarchical Estimate

**Voice Dictation Example:**

> "I need to estimate a kitchen renovation. The work includes installing granite countertops which will take 8 hours at $75 per hour plus $1200 in materials. We also need to install cabinets, that's 16 hours at $75 per hour and $3500 for the cabinet units."

**AI Response:**
```json
{
  "intent": "new_estimate",
  "structured": {
    "type": "estimate",
    "title": "Kitchen Renovation",
    "lineItems": [
      {
        "description": "Kitchen Renovation",
        "isParent": true,
        "total": 0
      },
      {
        "description": "Install granite countertops",
        "timeHours": 8,
        "timeRate": 75,
        "timeCost": 600,
        "materialsCost": 1200,
        "total": 1800
      },
      {
        "description": "Install cabinets",
        "timeHours": 16,
        "timeRate": 75,
        "timeCost": 1200,
        "materialsCost": 3500,
        "total": 4700
      }
    ]
  }
}
```

**In the UI:**
- Parent item "Kitchen Renovation" is shown with expand/collapse chevron
- Children are indented and show individual time+materials breakdown
- Parent total automatically calculates to $6,500 (sum of children)

---

### Uploading Receipts & Tracking Work

**Workflow:**

1. **Upload Receipt:**
   - Navigate to project → "Status" tab
   - Click "Upload Receipt"
   - Select receipt image (JPG/PNG) or PDF
   - Tap mic icon and say: "Installed the countertops today, worked 10 hours and spent $1250 on materials"
   - Submit

2. **AI Mapping:**
   - AI automatically suggests mapping to "Install granite countertops" line item
   - Shows variance: Actual $2000 vs. Estimated $1800 (+$200, +11.1%)
   - You can adjust hours, rate, or materials before approving

3. **Approve:**
   - Review mapping and costs
   - Click "Approve & Save"
   - Work entry is created with status "pending" → change to "approved"

4. **View Reconciliation:**
   - Status tab shows live budget tracking
   - Green = under budget, Red = over budget
   - Progress bar shows percentage complete

---

### Viewing Estimate History

**Workflow:**

1. Navigate to project → "History" tab
2. See timeline of all changes:
   - "Estimate #1 created" (Version 1)
   - "Change Order #1 applied: Add electrical work" (Version 2)
   - "Change Order #2 applied: Upgrade countertops" (Version 3)
3. Click on any version to see estimate state at that point in time
4. Compare versions to understand cost evolution

---

## 🎨 UI Components

### StructuredPreview (Updated)

**Desktop View:**
```
┌─────────────────────────────────────────────────────────┐
│ Estimate Preview                                        │
├─────────────────────────────────────────────────────────┤
│ Description       │ Time          │ Materials │ Total   │
├─────────────────────────────────────────────────────────┤
│ ▼ Kitchen Remodel │               │           │ $6,500  │
│   Countertops     │ 8h × $75/h    │ $1,200    │ $1,800  │
│   Cabinets        │ 16h × $75/h   │ $3,500    │ $4,700  │
└─────────────────────────────────────────────────────────┘
```

**Mobile View:**
- Stacks vertically with touch-friendly 44px buttons
- Time/materials inputs sized for thumbs
- Expand/collapse parents

### ReconciliationView (New)

**Budget Dashboard:**
```
┌───────────────────────────────────────────────┐
│ Budget Overview                               │
├───────────────────────────────────────────────┤
│ ████████████░░░░░░░░░░ 65% Progress           │
│                                               │
│ Estimated: $10,000 │ Actual: $6,500 │ -$3,500 │
└───────────────────────────────────────────────┘

Estimate #1: Kitchen Renovation
┌──────────────────────────────────────────────┐
│ Countertops     │ $1,800 │ $2,000 │ +$200 🔴 │
│ Cabinets        │ $4,700 │ $4,500 │ -$200 🟢 │
└──────────────────────────────────────────────┘
```

### ReceiptUpload (New)

**Interface:**
- Drag-and-drop file upload zone
- Voice dictation button (🎤)
- Real-time transcript display
- File type/size validation

### WorkEntryPreview (New)

**Interface:**
- AI-suggested line item mapping (dropdown to change)
- Editable time (hours × rate)
- Editable materials cost
- Variance indicator with warning if >20%
- Individual approve/reject per entry

---

## 🧪 Testing Checklist

### Basic Workflow Test

1. ✅ **Create Hierarchical Estimate:**
   - Say: "Kitchen remodel with countertops and cabinets"
   - Verify parent item shows with chevron
   - Verify children are indented
   - Verify parent total = sum of children

2. ✅ **Edit Dual Structure:**
   - Change timeHours for a child item
   - Verify timeCost recalculates
   - Verify total updates
   - Verify parent total updates

3. ✅ **Upload Receipt:**
   - Upload test image
   - Use voice to describe work
   - Verify transcript appears
   - Verify AI suggests correct line item

4. ✅ **Approve Work Entry:**
   - Review mapping
   - Adjust hours if needed
   - Approve entry
   - Navigate to Status tab
   - Verify variance shows correctly

5. ✅ **View Reconciliation:**
   - Check progress bar accuracy
   - Verify variance indicators (red/green)
   - Check totals match estimate

6. ✅ **Create Change Order:**
   - Add new line item via voice
   - Approve change order
   - Navigate to History tab
   - Verify new version created
   - Click version link, view snapshot

---

## 🐛 Common Issues & Solutions

### Issue: "Line item validation failed"
**Solution:** Ensure each line item has either `timeCost` OR `materialsCost` (or both). Parent items are exempt.

### Issue: "Parent total is zero"
**Solution:** Parent totals calculate from children. Expand the parent and add child items.

### Issue: "Receipt upload fails"
**Solution:**
- Check file size (<10MB)
- Check file type (JPG, PNG, or PDF only)
- Verify `uploads/` directory exists

### Issue: "Work entry not showing in reconciliation"
**Solution:** Change work entry status to "approved". Only approved entries count toward budget.

### Issue: "Hierarchy too deep"
**Solution:** Maximum 2 levels (parent → children). Flatten structure or group differently.

---

## 📱 Mobile Testing

**iOS Safari Voice Input:**
1. Navigate to project on iPhone
2. Tap estimate creation
3. Tap microphone icon
4. Grant microphone permission
5. Speak estimate details
6. Verify transcript appears
7. Verify structured preview shows

**Receipt Camera Upload:**
1. Tap "Upload Receipt"
2. Tap file input
3. Choose "Take Photo"
4. Capture receipt
5. Add voice description
6. Upload and verify

---

## 🔗 API Endpoints Reference

### Estimates & Versioning
```
POST   /api/estimates
GET    /api/estimates/[estimateId]/versions
GET    /api/estimates/versions/[versionId]
```

### Work Tracking
```
POST   /api/receipts
GET    /api/receipts?projectId=xxx
POST   /api/work-entries
GET    /api/work-entries?estimateId=xxx
PATCH  /api/work-entries/[id]
GET    /api/projects/[projectId]/reconciliation
```

### Example: Create Hierarchical Estimate

```javascript
const response = await fetch('/api/estimates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'proj_123',
    title: 'Kitchen Renovation',
    lineItems: [
      {
        description: 'Kitchen Renovation',
        isParent: true,
        category: 'general_labor',
        total: 0,
      },
      {
        description: 'Install countertops',
        timeHours: 8,
        timeRate: 75,
        timeCost: 600,
        materialsCost: 1200,
        total: 1800,
        category: 'countertops',
      },
    ],
  }),
});
```

---

## 📊 Sample Data for Testing

Create a test project and use this voice script:

> "I need an estimate for a bathroom renovation project. The work includes demolition of existing tile, which will take 4 hours at $60 per hour. Then installing new tile, that's 12 hours at $75 per hour plus $800 in tile materials. We also need to install new plumbing fixtures, 6 hours at $90 per hour and $450 for the fixtures."

**Expected Result:**
- Parent: "Bathroom Renovation" ($2,950 total)
  - Child: "Demolition of existing tile" ($240 time only)
  - Child: "Install new tile" ($900 time + $800 materials = $1,700)
  - Child: "Install plumbing fixtures" ($540 time + $450 materials = $990)

Then upload a test receipt and map to "Install new tile" with actual costs.

---

## 🎓 Video Tutorial Script (for future recording)

1. **Intro** (30s)
   - "Today I'll show you the new hierarchical estimates and work tracking features"

2. **Create Estimate** (2 min)
   - Open project → "Estimates" tab
   - Click "New Estimate"
   - Tap mic → speak kitchen remodel example
   - Show StructuredPreview with hierarchy
   - Edit time/materials inline
   - Approve

3. **Track Work** (2 min)
   - Navigate to "Status" tab
   - Click "Upload Receipt"
   - Take photo of sample receipt
   - Use voice to describe work
   - Show AI mapping preview
   - Adjust if needed → Approve
   - Show reconciliation dashboard

4. **Version History** (1 min)
   - Create change order
   - Navigate to "History" tab
   - Click version link
   - Show snapshot comparison

5. **Outro** (30s)
   - "Now you can track budget in real-time with zero friction"

---

## 💡 Pro Tips

1. **Use Natural Language:** AI understands "8 hours at $75" and "eight hours at seventy-five dollars" equally well
2. **Group Logically:** Organize by room (Kitchen, Bathroom) or phase (Demo, Installation, Finishing)
3. **Maximum 2 Levels:** Keep hierarchy simple (Parent → Children only)
4. **Voice First:** Tap mic button before typing - much faster on mobile
5. **Approve Work Daily:** Upload receipts and approve work entries at the end of each day
6. **Watch Variance:** If >20% over budget, create a change order to keep client informed
7. **Check Status Tab:** Review before client meetings to know exact budget status

---

## 📞 Support

Questions? Issues? Feedback?
- GitHub: https://github.com/anthropics/claude-code/issues
- Documentation: `/IMPLEMENTATION_SUMMARY.md`
- Migration Guide: `/MIGRATION_GUIDE.md`

---

**Last Updated:** 2026-02-12
**Version:** 1.0.0
