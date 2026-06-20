# WS-6 Polish + Decommission Implementation Plan

> **For Antigravity (implementer):** Final workstream. Cadence: batch execution. Lower risk than WS-5 (no live data migration). V1 backups exist; rollback safe.

**Goal:** Complete the V2 rebuild by (1) migrating the last V1 consumer — the admin dashboard — to V2, (2) archiving the final legacy module `lib/report-utils.ts`, (3) renaming V1 sheets to `_LEGACY` to signal they're frozen, (4) deleting the `_legacy/app-actions/` folder after final verification.

**Architecture:**
- **Dashboard reads V2 like other reports.** Drop `computeLineRevenue` import; use stored `net_total` directly. Reuse `breakdownRevenueByProduct` from WS-4 for per-product top-seller widget. Filter modes (today, 7d, 30d, this month, last month, this year, last year, all) preserved verbatim — they only filter by `created_at`.
- **`lib/report-utils.ts` archived** after dashboard migration confirms zero references.
- **V1 sheets renamed** via Google Sheets API `updateSheetProperties`. Names: `Orders_LEGACY`, `Order_Lines_LEGACY`, `Stock_Ledger_LEGACY`. Original sheet IDs preserved so existing references in legacy code (now in `_legacy/`) still resolve if needed for audit.
- **`_legacy/app-actions/` deleted.** Files were archived in WS-5 with explicit README stating "can be deleted after WS-6 verification". Verification = tests pass + UI smoke test + reports show data correctly post-migration.

**Tech Stack:** Same as WS-5. No new deps.

**Dependencies:** WS-1 through WS-5 merged. **Live migration has been executed** (751 orders migrated, 0đ drift verified).

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `scripts/rename-v1-sheets-to-legacy.ts` | Idempotent sheet rename. Skips if already renamed. |
| `scripts/delete-legacy-folder.sh` (or `.ts`) | Delete `_legacy/app-actions/` after final verification |

### Files to modify

| Path | Change |
|---|---|
| `app/admin/page.tsx` | Replace V1 reads with V2 reads. Drop `computeLineRevenue` import. Use stored values + `breakdownRevenueByProduct`. |

### Files to archive

| Path | Action |
|---|---|
| `lib/report-utils.ts` | `git mv` to `_legacy/lib/report-utils.ts` (after dashboard migration confirms zero references) |

### Files to delete (Task 5, after verification)

| Path | Why |
|---|---|
| `_legacy/app-actions/*.ts` (5 files) | WS-5 archived; V2 fully operational |
| `_legacy/README.md` | Updated README stays at `_legacy/README.md` (don't delete the folder itself) |
| `_legacy/lib/report-utils.ts` | Same as above |

### Files NOT touched

- V1 sheets (`Orders`, `Order_Lines`, `Stock_Ledger`) — Task 3 renames them to `_LEGACY`. Backup tabs (`*_BACKUP_PRE_WS5_*`) stay as-is for now; can be deleted by User after 30 days stable.

---

## Task 1: Dashboard migration to V2

**Files:**
- Modify: `app/admin/page.tsx`

Replace V1 reads + `computeLineRevenue` with V2 reads + stored values. Preserve all 8 filter modes and trend badge logic.

- [ ] **Step 1: Read full `app/admin/page.tsx`**

Run: `rtk read app/admin/page.tsx`
Note its structure: filter mode dispatch, current vs previous period functions, then aggregations using `orders` / `orderLines` / `computeLineRevenue`.

- [ ] **Step 2: Update imports + data load**

Open `app/admin/page.tsx`. Make these specific changes:

a) Replace imports at top:
```typescript
// Remove
import { computeLineRevenue } from "@/lib/report-utils";
// Add
import { findAllNoCache } from "@/lib/sheets_db";
import { ORDER_STATUS } from "@/lib/order-types";
import { breakdownRevenueByProduct } from "@/lib/report-v2-allocators";
```

b) In the `Promise.all` block (around line 23), replace `findAll("Orders")` and `findAll("Order_Lines")` with V2 equivalents:
```typescript
const [brands, users, suppliers, v2Orders, v2Lines, products, variants, categories] = await Promise.all([
  findAll("Brands"),
  findAll("Users"),
  findAll("Suppliers"),
  findAllNoCache("Orders_V2"),
  findAllNoCache("Order_Lines_V2"),
  findAll("Products"),
  findAll("Product_Variants"),
  findAll("Product_Categories"),
]);
```

c) Add a normalize helper and replace `validOrders` / `currOrders` / `prevOrders` logic:
```typescript
// Coerce raw V2 row strings to typed shape with numeric fields
function normalizeV2Order(row: any) {
  return {
    ...row,
    id: row.id,
    status: row.status,
    version: Number(row.version) || 1,
    created_at: row.created_at,
    staff_name: row.created_by_name || "",
    brand_id: row.brand_id,
    // For backward-compat with downstream dashboard logic
    total_amount: Number(row.net_total) || 0,
    net_total: Number(row.net_total) || 0,
    gross_total: Number(row.gross_total) || 0,
  };
}

const v2OrderIds = new Set(v2Orders.map((o: any) => o.id));
const v2LinesForOrders = (v2Lines as any[])
  .filter((l: any) => v2OrderIds.has(l.order_id))
  .map((l: any) => ({
    ...l,
    qty: Number(l.qty) || 0,
    unit_price: Number(l.unit_price) || 0,
    gross_line_total: Number(l.gross_line_total) || 0,
    promo_discount: Number(l.promo_discount) || 0,
    manual_item_discount: Number(l.manual_item_discount) || 0,
    order_discount_allocation: Number(l.order_discount_allocation) || 0,
    net_line_total: Number(l.net_line_total) || 0,
  }));

const validOrders = (v2Orders as any[])
  .filter((o: any) =>
    o.status === ORDER_STATUS.COMPLETED &&
    !(o.superseded_by && o.superseded_by !== "") &&
    o.created_at,
  )
  .map(normalizeV2Order);

const currOrders = validOrders.filter((o: any) => isCurrent(new Date(o.created_at)));
const prevOrders = validOrders.filter((o: any) => isPrev(new Date(o.created_at)));
```

d) Replace every usage of `computeLineRevenue(...)` with the simpler stored-value approach. Find pattern:
```typescript
const lineRevenue = computeLineRevenue({
  qty, unit_price, line_discount, modifiers_json, order_discount_ratio
});
```
And replace with:
```typescript
// V2: use stored net_line_total directly
const lineTotal = Number(line.net_line_total || 0);
const variantRevenue = lineTotal; // approximation; full breakdown via allocateLineRevenue
```

For trend + best-seller aggregations, replace the `orderLines.forEach(...)` block with calls to `breakdownRevenueByProduct`:
```typescript
// Total revenue = sum of order.net_total
const currRevenue = currOrders.reduce((s: number, o: any) => s + o.net_total, 0);
const prevRevenue = prevOrders.reduce((s: number, o: any) => s + o.net_total, 0);

// Top products via Task 1 allocator
const currOrderIds = new Set(currOrders.map((o: any) => o.id));
const currLines = v2LinesForOrders.filter((l: any) => currOrderIds.has(l.order_id));
const currProducts = breakdownRevenueByProduct(currOrders, currLines);
const topProducts = currProducts
  .filter(p => !p.product_id.startsWith("MOD:"))
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 5);
```

- [ ] **Step 3: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "admin/page"`
Expected: no errors. The pre-existing `app/admin/page.tsx` errors should disappear after this migration.

- [ ] **Step 4: Smoke test in browser**

Start dev server. Open `/admin`. Verify:
- Dashboard loads without errors
- Filter buttons work (today, 7d, 30d, this month, last month, this year, last year, all)
- Numbers update when filter changes
- Top products list populated
- Trend badges show direction (up/down/same)
- Numbers match what PnL report shows for same period

- [ ] **Step 5: Commit**

```bash
rtk git add app/admin/page.tsx
rtk git commit -m "feat(orders-v2): migrate admin dashboard to V2

WS-6 step 1: dashboard reads Orders_V2 + Order_Lines_V2. Drops
computeLineRevenue import (will archive report-utils.ts in Task 2).
Reuses breakdownRevenueByProduct from WS-4 for top-sellers widget.
All 8 filter modes preserved verbatim.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Archive `lib/report-utils.ts`

**Files:**
- Move: `lib/report-utils.ts` → `_legacy/lib/report-utils.ts`

After Task 1, no production code imports from `report-utils.ts`. Safe to archive.

- [ ] **Step 1: Verify zero production imports**

Run:
```bash
rtk grep -l "from ['\"]@/lib/report-utils['\"]" app components 2>&1 || echo "none"
```
Expected: "none" (no matches in production code). If any file outside `_legacy/` still imports it, **STOP** and fix the import first.

- [ ] **Step 2: Move file**

```bash
mkdir -p _legacy/lib
git mv lib/report-utils.ts _legacy/lib/report-utils.ts
```

- [ ] **Step 3: Update `_legacy/README.md`**

Append:
```markdown
## lib/report-utils.ts (added WS-6)

The legacy `computeLineRevenue` function. Used by pre-WS-6 admin dashboard.
Replaced by `lib/report-v2-allocators.ts` (breakdownRevenueByProduct, breakdownCOGSByIngredient).
```

- [ ] **Step 4: Verify TS + tests**

Run: `rtk tsc --noEmit && rtk npm test`
Expected: 0 new errors. All 107 tests still pass.

- [ ] **Step 5: Commit**

```bash
rtk git add _legacy/lib/report-utils.ts _legacy/README.md
rtk git commit -m "chore(orders-v2): archive lib/report-utils.ts

WS-6 step 2: computeLineRevenue (legacy additive+multiplicative
algorithm) archived. Replaced by report-v2-allocators.ts in WS-4 +
dashboard migrated to V2 in WS-6 step 1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Rename V1 sheets to `_LEGACY`

**Files:**
- Create: `scripts/rename-v1-sheets-to-legacy.ts`

Idempotent script using Google Sheets API `updateSheetProperties` to rename `Orders` → `Orders_LEGACY`, etc. Skips if already renamed.

- [ ] **Step 1: Create the script**

Create `scripts/rename-v1-sheets-to-legacy.ts`:

```typescript
/**
 * Rename V1 sheets to _LEGACY suffix.
 *
 * Idempotent: skips sheets already renamed. Preserves sheet IDs so
 * existing references still resolve.
 *
 * Run: npx tsx scripts/rename-v1-sheets-to-legacy.ts --live
 * (default is dry-run)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { getSheetsClient } = require("../lib/sheets_db");

const RENAMES: Array<{ from: string; to: string }> = [
  { from: "Orders", to: "Orders_LEGACY" },
  { from: "Order_Lines", to: "Order_Lines_LEGACY" },
  { from: "Stock_Ledger", to: "Stock_Ledger_LEGACY" },
];

async function main() {
  const isLive = process.argv.includes("--live");
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("GOOGLE_SPREADSHEET_ID env var required");

  console.log(`\n=== Rename V1 sheets to _LEGACY (${isLive ? "LIVE" : "DRY-RUN"}) ===\n`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(
    (meta.data.sheets || []).map((s: any) => s.properties?.title),
  );

  const requests: any[] = [];
  for (const { from, to } of RENAMES) {
    if (existingTitles.has(to)) {
      console.log(`[SKIP] '${to}' already exists`);
      continue;
    }
    // Case-insensitive search for source sheet
    const sourceSheet = (meta.data.sheets || []).find(
      (s: any) => (s.properties?.title || "").toLowerCase() === from.toLowerCase(),
    );
    if (!sourceSheet) {
      console.log(`[SKIP] Source '${from}' not found`);
      continue;
    }
    const sheetId = sourceSheet.properties?.sheetId;
    if (sheetId === undefined) {
      console.log(`[SKIP] '${from}' has no sheetId`);
      continue;
    }
    console.log(`[WILL RENAME] '${sourceSheet.properties.title}' → '${to}' (sheetId=${sheetId})`);
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, title: to },
        fields: "title",
      },
    });
  }

  if (requests.length === 0) {
    console.log("\nNothing to rename.");
    return;
  }

  if (!isLive) {
    console.log(`\nDry-run complete. ${requests.length} rename(s) pending. Use --live to apply.`);
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  console.log(`\nApplied ${requests.length} rename(s).`);

  // Verify
  const metaAfter = await sheets.spreadsheets.get({ spreadsheetId });
  const titlesAfter = (metaAfter.data.sheets || []).map((s: any) => s.properties?.title);
  for (const { to } of RENAMES) {
    if (titlesAfter.includes(to)) {
      console.log(`  ✓ '${to}' exists`);
    } else {
      console.log(`  ✗ '${to}' MISSING`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
```

- [ ] **Step 2: Dry-run**

Run: `npx tsx scripts/rename-v1-sheets-to-legacy.ts`
Expected: Lists 3 rename operations pending. No changes made.

- [ ] **Step 3: Live run**

**Stop and ask User to confirm** before this step. The rename is reversible (rename back), but it's a production state change.

If User approves:
Run: `npx tsx scripts/rename-v1-sheets-to-legacy.ts --live`
Expected: 3 sheets renamed. Verify output shows ✓ for each.

- [ ] **Step 4: Verify V2 reports still work after rename**

Run: `npx tsx scripts/test-pnl-v2.ts 2>&1 | tail -10`
Expected: PASSED. V2 reports don't read V1, so rename shouldn't affect them.

Also: open browser `/admin/reports/pnl`, verify data still loads.

- [ ] **Step 5: Commit**

```bash
rtk git add scripts/rename-v1-sheets-to-legacy.ts
rtk git commit -m "feat(orders-v2): rename V1 sheets to _LEGACY

WS-6 step 3: idempotent script to rename Orders/Order_Lines/Stock_Ledger
to _LEGACY suffix. Preserves sheet IDs so existing references resolve.
Dry-run default; --live to apply.

Run AFTER V2 fully verified (WS-6 Tasks 1-2 done + reports working).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Final verification

- [ ] **Step 1: Full test suite**

Run: `rtk npm test`
Expected: All tests pass. Count remains 107 (no test changes in WS-6).

- [ ] **Step 2: TypeScript check**

Run: `rtk tsc --noEmit`
Expected: 0 errors. (Previously pre-existing errors in admin/page.tsx + report-utils.ts now resolved.)

- [ ] **Step 3: Browser smoke test all key paths**

Start dev server. Open each in browser, verify no errors:
- `/admin` (dashboard) — top products, trend badges, filter modes
- `/admin/orders` — list shows migrated orders
- `/admin/orders` → click any order → detail modal shows timeline
- `/admin/orders` → click edit → modal works
- `/admin/reports/pnl` — shows real data
- `/admin/reports/sales` — shows real data
- `/admin/reports/stock` — shows real stock levels
- `/pos` — POS screen loads, can add to cart

For each, verify numbers look reasonable (not zero, not garbage).

- [ ] **Step 4: Re-run reconciliation**

Run: `npx tsx scripts/reconcile-v1-v2.ts`
Expected: Still drift 0đ (V2 unchanged since migration). If V1 sheets renamed, reconciliation reads `Orders_LEGACY` etc — script may need update or skip.

If rename happened and reconciliation script can't find V1, just skip this step (V2 reports are source of truth now).

- [ ] **Step 5: Update DEVELOPMENT-TRACKING.md**

Append WS-6 section:

```markdown
## 2026-06-XX — WS-6 Polish + Decommission Complete

### What landed
- Dashboard migrated to V2 (app/admin/page.tsx): reads Orders_V2, uses breakdownRevenueByProduct, drops computeLineRevenue
- lib/report-utils.ts archived to _legacy/lib/
- scripts/rename-v1-sheets-to-legacy.ts: idempotent V1 sheet rename

### Verification gates (all passed)
- rtk npm test: 107/107 tests pass
- rtk tsc --noEmit: 0 errors (admin/page.tsx + report-utils.ts pre-existing errors resolved)
- Browser smoke test: all 8 paths load correctly
- Reconciliation: V1→V2 drift 0đ (or skipped if V1 renamed)

### Final state
- V2 system fully operational
- V1 sheets renamed to _LEGACY (if Task 3 ran)
- _legacy/ folder contains 5 action files + report-utils.ts (kept for reference, can be deleted by User after 30 days stable)

### Project Status: V2 REBUILD COMPLETE
```

Use actual hashes from `git log`. Do NOT fabricate.

- [ ] **Step 6: Final commit**

```bash
rtk git add DEVELOPMENT-TRACKING.md
rtk git commit -m "docs(tracking): WS-6 polish + decommission complete; V2 rebuild DONE

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5 (User-discretionary): Delete `_legacy/` folder

**Only if User confirms 7+ days stable post-WS-6.**

- [ ] **Step 1: Verify stable**

Wait at least 7 days after WS-6 cutover. Confirm:
- No reports errors
- No POS issues
- No admin dashboard problems
- Reconciliation still drift 0đ (if V1 still readable)

- [ ] **Step 2: Delete _legacy/**

```bash
rm -rf _legacy/
```

- [ ] **Step 3: Commit**

```bash
rtk git commit -am "chore(orders-v2): delete _legacy folder after 7+ days stable

WS-6 step 5 (discretionary): V2 system stable for 7+ days. _legacy/
folder deleted. V1 backups in Google Sheets can be deleted separately
by User if desired.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage check:**
- ✓ Dashboard migrated to V2 → Task 1
- ✓ `lib/report-utils.ts` archived → Task 2
- ✓ V1 sheets renamed to `_LEGACY` → Task 3
- ✓ Final verification → Task 4
- ✓ `_legacy/` deletion (discretionary) → Task 5

**Placeholder scan:** No placeholders. Code blocks complete.

**Type consistency:**
- Reuses: `breakdownRevenueByProduct` from WS-4
- Reuses: `ORDER_STATUS` from WS-1
- Reuses: `findAllNoCache` from sheets_db

**Known risks:**
- R1: Dashboard migration could miss a `computeLineRevenue` call site → mitigated by TS error after archive (Task 2 catches remaining imports)
- R2: Sheet rename could break legacy scripts reading `Orders` → mitigated by `Orders_LEGACY` still exists, just different name; if legacy scripts run, they'll fail clearly with "sheet not found"
- R3: `_legacy/` deletion loses reference code → acceptable; User has 7+ days to retrieve anything needed

---

## Handoff

**WS-6 is the final workstream. After Task 4, the V2 rebuild is COMPLETE.**

**Operational state at completion:**
- V2 fully operational: POS, admin orders, edit/void, reports, dashboard all read V2
- V1 frozen: sheets renamed to `_LEGACY`, code in `_legacy/`
- Backups exist: `*_BACKUP_PRE_WS5_2026-06-19` tabs in Google Sheets
- Rollback path: documented in `docs/runbooks/orders-v2-cutover.md`

**User follow-up (next 30 days):**
- Monitor for any V2 issues
- After 7 days stable: delete `_legacy/` folder (Task 5)
- After 30 days stable: delete `*_BACKUP_PRE_WS5_*` sheet tabs from Google Sheets
