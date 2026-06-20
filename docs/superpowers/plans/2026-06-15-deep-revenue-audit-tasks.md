# Deep Revenue Audit & Historical Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit every historical order for revenue-calculation anomalies caused by manual order-level discounts overriding PRODUCT_DISCOUNT promotions, then write a fix script that realigns historical data so promo-covered items (e.g., Sữa Dâu) always report their promo price as revenue — verified by `73 × 25.000đ = 1.825.000đ`.

**Architecture:**
- **Audit phase (already done by Claude):** Two read-only scripts scan all orders and produce JSON reports. `scripts/audit-revenue-anomalies.ts` flags 4 anomaly types per order; `scripts/audit-revenue-summary.ts` aggregates per-variant expected-vs-actual revenue under promo windows and prints the Sữa Dâu headline number.
- **Diagnose phase (Gemini):** Run the audit scripts, read the JSON output, and classify which anomalies are real data bugs vs. legitimate edge cases.
- **Fix algorithm phase (Gemini + User approval):** Decide how to handle the UCK000094 pattern (`PRODUCT_DISCOUNT` + manual order-level discount). The recommended approach is to convert the order-level discount into per-line discounts on **non-applicable variants only**, preserving the promo price invariant on applicable variants.
- **Fix script phase (Gemini):** Write `scripts/fix-product-discount-overrides.ts` with `--dry-run` support. Dry-run first, review deltas, then run live.
- **POS logic phase (Gemini):** Update `components/POSScreen.tsx:442-493` so future PRODUCT_DISCOUNT promotions survive a cashier's manual order-level discount entry.
- **Verification phase (Gemini + Antigravity):** Reload P&L, confirm Sữa Dâu = 1.825.000đ, confirm no other products regressed.

**Tech Stack:** Next.js 14, TypeScript 5, Google Sheets via `lib/sheets_db.ts`, run scripts via `npx tsx`.

---

## Root Cause Summary (for context)

The UCK000094 anomaly has two intertwined causes:

**Cause 1 — POS logic (`components/POSScreen.tsx:442-452`):** When a cashier enters a value in the checkout-modal discount field, `userCustomDiscount != null` flips `isOrderLevelDiscountActive = true`. The block at line 452 then early-returns and **skips applying the PRODUCT_DISCOUNT promo to applicable variants' line_discount**. Worse, line 433-435 wipes `applied_promotion_id` and `applied_promotion_snapshot_json` to empty strings. So when both a PRODUCT_DISCOUNT promo and a manual order-level discount are present, the promo is completely discarded.

**Cause 2 — Reporting layer (`lib/report-utils.ts:71`):** `computeLineRevenue` applies `order_discount_ratio` **multiplicatively on top of** the post-line-discount revenue. For a line that has both `line_discount` (promo) AND lives in an order with `discount_amount > 0` (manual), the variant revenue gets reduced twice. This is the source of Sữa Dâu reporting below 25.000đ/ly.

Combined effect for UCK000094-like orders: the applicable variant's `line_discount` is either missing (Cause 1) or matches promo formula but then gets further reduced by `order_discount_ratio` (Cause 2). Either way, reported revenue ≠ promo price.

---

## File Structure

### Read-only inputs
- `audit-anomalies.json` — produced by `scripts/audit-revenue-anomalies.ts` (already written)
- `audit-summary.json` — produced by `scripts/audit-revenue-summary.ts` (already written)
- `scripts/audit-revenue-anomalies.ts` — anomaly detector (already written)
- `scripts/audit-revenue-summary.ts` — per-variant revenue summary (already written)

### Files Gemini will create
- `scripts/fix-product-discount-overrides.ts` — historical data fix script with `--dry-run`

### Files Gemini will modify
- `components/POSScreen.tsx` — preserve PRODUCT_DISCOUNT promo when cashier enters manual order-level discount

### Reference files (read-only, for understanding)
- `lib/report-utils.ts` — `computeLineRevenue` (no changes needed; the fix is in POS write-path + historical data)
- `scripts/recover-product-discount.ts` — existing partial recovery; superseded by new fix script
- `scripts/zero-out-prorated-line-discounts.ts` — existing partial zero-out; superseded by new fix script

---

## Task 1: Run the audit scripts and read the output

**Files:**
- Read: `audit-anomalies.json`, `audit-summary.json` (after generation)

- [ ] **Step 1: Confirm `GOOGLE_SPREADSHEET_ID` is set in env**

Run: `echo $GOOGLE_SPREADSHEET_ID`
Expected: non-empty value. If empty, source `.env` first.

- [ ] **Step 2: Run the per-order anomaly audit**

Run: `npx tsx scripts/audit-revenue-anomalies.ts`
Expected: writes `audit-anomalies.json` to project root, prints breakdown by anomaly type + samples.

- [ ] **Step 3: Run the per-product summary audit**

Run: `npx tsx scripts/audit-revenue-summary.ts`
Expected: writes `audit-summary.json` to project root, prints per-variant table and a headline block for Sữa Dâu showing expected vs actual revenue.

- [ ] **Step 4: Capture the headline numbers**

From the Sữa Dâu headline block in the per-product output, record:
- `totalQtySoldDuringPromo` (expected: 73 per User's report)
- `expectedRevenueDuringPromo` (expected: 1.825.000đ)
- `actualRevenueDuringPromo` (current broken number)
- `delta`
- `anomalousOrderIds` (list of order IDs to fix)

If `totalQtySoldDuringPromo` is not 73, STOP and investigate — the promo window for Sữa Dâu might not be configured correctly in the `Promotions` sheet, or the variant ID is different. Check `applicable_products_json` on PRM-003 (or whichever promo ID covers Sữa Dâu).

- [ ] **Step 5: Confirm UCK000094 appears in the anomaly list**

Open `audit-anomalies.json`. Search for `UCK000094` (or the order ID matching order_no `UCK000094`). Confirm it appears with type `PRODUCT_DISCOUNT_WITH_MANUAL_ORDER_DISCOUNT`. If not, STOP — the anomaly detector's logic may need adjustment; ping Claude before proceeding.

---

## Task 2: Classify anomalies and decide fix scope

**Files:**
- Read: `audit-anomalies.json`

- [ ] **Step 1: Tally anomalies by type and order_id**

Use `jq` (or read the JSON manually) to group:
```bash
jq '[.anomalies[] | .type] | group_by(.) | map({type: .[0], count: length})' audit-anomalies.json
```
Record the counts for each of the 4 types:
- `PRODUCT_DISCOUNT_WITH_MANUAL_ORDER_DISCOUNT`: ____ orders
- `APPLICABLE_VARIANT_LINE_DISCOUNT_MISMATCH`: ____ lines
- `NON_APPLICABLE_VARIANT_HAS_LINE_DISCOUNT`: ____ lines
- `POTENTIAL_PROMO_NOT_APPLIED`: ____ lines

- [ ] **Step 2: Decide scope per anomaly type**

For each type, mark as **IN SCOPE** (will fix) or **OUT OF SCOPE** (will document and skip):

| Type | Recommended scope | Reason |
|---|---|---|
| `PRODUCT_DISCOUNT_WITH_MANUAL_ORDER_DISCOUNT` | **IN SCOPE** | This is the headline bug. Must fix to hit 1.825.000đ. |
| `APPLICABLE_VARIANT_LINE_DISCOUNT_MISMATCH` | **IN SCOPE** | Cheap to fix; directly affects promo price invariant. |
| `NON_APPLICABLE_VARIANT_HAS_LINE_DISCOUNT` | **IN SCOPE (with caveat)** | Zero out unless cashier item-level discount is plausible. See Task 3 for the caveat. |
| `POTENTIAL_PROMO_NOT_APPLIED` | **OUT OF SCOPE** | Ambiguous — could be a legitimate choice (cashier override). Flag for User review, do NOT auto-apply promo retroactively. |

- [ ] **Step 3: Write a one-paragraph scope decision into the task tracking**

Capture the in-scope counts and the rationale for `POTENTIAL_PROMO_NOT_APPLIED` being out of scope. This goes into the commit message of Task 6.

---

## Task 3: User-approval checkpoint on the fix algorithm

**Files:** None modified; this is a design-decision checkpoint.

- [ ] **Step 1: Prepare a decision doc for User review**

Draft a short markdown (in chat, not committed to repo) presenting the following:

**Question 1: How should the fix script handle `order.discount_amount` on orders that have `applied_promotion_snapshot_json.type === "PRODUCT_DISCOUNT"`?**

Three options:

| Option | Behavior | Pros | Cons |
|---|---|---|---|
| **A. Convert to non-applicable line discounts** | Distribute `discount_amount` proportionally onto non-applicable variants' `line_discount`. Set `order.discount_amount = 0`. | Preserves promo price invariant on applicable variants. Reports correctly without POS logic change for past orders. | Cashier's intent (whole-bill discount) is partially lost; non-applicable items get a bigger discount than originally intended. |
| **B. Drop entirely** | Set `order.discount_amount = 0`, do not redistribute. | Simplest. | Loses cashier's intent fully. Total revenue will be higher than what customer actually paid. |
| **C. Keep as-is** | Leave `order.discount_amount` unchanged. | No data loss. | Bug persists. Reports will still show Sữa Dâu below 25k. Not viable. |

**Recommended:** Option A.

**Question 2: For `NON_APPLICABLE_VARIANT_HAS_LINE_DISCOUNT` (lines that have `line_discount > 0` but are not in the promo's applicable list), should the fix script:**

| Option | Behavior |
|---|---|
| **A. Zero them all out** | Assume all were prorating artifacts from `fix-historical-discounts.ts`. |
| **B. Zero them out ONLY when the order also has an applicable variant with a line_discount** | Heuristic: if at least one applicable variant was correctly discounted, the non-applicable discounts are almost certainly prorating artifacts. If no applicable variant was discounted, leave them alone (might be legitimate cashier item-level discounts). |

**Recommended:** Option B (safer).

- [ ] **Step 2: Send to User, wait for approval**

Use the AskUserQuestion tool (or equivalent review channel) to get explicit sign-off on both questions. Do NOT proceed to Task 4 without answers.

- [ ] **Step 3: Record decisions**

Write the chosen options into the task tracking. They will inform the implementation in Task 4-5.

---

## Task 4: Write `scripts/fix-product-discount-overrides.ts` skeleton

**Files:**
- Create: `scripts/fix-product-discount-overrides.ts`

- [ ] **Step 1: Confirm `scripts/` exists and `npx tsx` is available**

Run: `ls scripts | head -3 && npx tsx --version`
Expected: shows existing scripts and a tsx version number.

- [ ] **Step 2: Create the skeleton with imports, types, helpers, and a `main()` shell**

Write `scripts/fix-product-discount-overrides.ts`:
```ts
/**
 * Fix Historical PRODUCT_DISCOUNT Overrides
 *
 * For every COMPLETED order whose applied_promotion_snapshot_json.type === "PRODUCT_DISCOUNT",
 * this script enforces the promo price invariant:
 *   - Applicable variants: line_discount reset to promo formula value
 *   - Non-applicable variants (per Question 2 heuristic): line_discount zeroed
 *   - Order.discount_amount (per Question 1 strategy A): redistributed onto
 *     non-applicable variants' line_discount, then zeroed out
 *
 * Usage:
 *   npx tsx scripts/fix-product-discount-overrides.ts --dry-run    # preview counts only
 *   npx tsx scripts/fix-product-discount-overrides.ts              # live run
 */

import { findAllNoCache, getSheetsClient } from "../lib/sheets_db";
import * as fs from "fs";
import * as path from "path";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const DRY_RUN = process.argv.includes("--dry-run");

// ===== Types =====

interface PromotionSnapshot {
  id?: string;
  name?: string;
  type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  discount_type: "PERCENT" | "FLAT_PRICE";
  discount_value: number | string;
  applicable_products_json?: string;
}

interface OrderRow {
  id: string;
  order_no: string;
  status: string;
  total_amount: string | number;
  subtotal?: string | number;
  subtotal_amount?: string | number;
  discount_amount: string | number;
  applied_promotion_snapshot_json?: string;
  created_at: string;
}

// ===== Helpers =====

function parseApplicableVariants(rawJson?: string): string[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed)) return parsed as string[];
    if (parsed && typeof parsed === "object") return Object.keys(parsed);
  } catch {}
  return [];
}

function computeExpectedLineDiscount(
  unitPrice: number,
  qty: number,
  discountType: string,
  discountValue: number
): number {
  if (discountType === "PERCENT") return unitPrice * qty * (discountValue / 100);
  if (discountType === "FLAT_PRICE") return Math.max(0, unitPrice - discountValue) * qty;
  return discountValue * qty; // flat VND per unit
}

// ===== Main =====

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SPREADSHEET_ID env var is required");
  console.log(`[fix-product-discount-overrides] mode=${DRY_RUN ? "DRY-RUN" : "LIVE"}`);

  const orders = (await findAllNoCache("Orders")) as any[];
  const sheets = getSheetsClient();

  // TODO Step 5: Read Order_Lines sheet directly to capture row indices for batchUpdate
  // TODO Step 6: Iterate orders, classify each line, build update batches
  // TODO Step 7: Apply batches (skip if DRY-RUN)
  // TODO Step 8: Re-fetch orders, redistribute discount_amount onto non-applicable lines, build second batch
  // TODO Step 9: Apply second batch (skip if DRY-RUN)
  // TODO Step 10: Write fix-report.json with per-order before/after

  console.log("[fix-product-discount-overrides] Skeleton ready — implement Steps 5-10.");
}

main().catch((err) => {
  console.error("[fix-product-discount-overrides] FATAL:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify the skeleton compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "fix-product-discount-overrides"`
Expected: no output.

---

## Task 5: Implement Step 5-6 — read Order_Lines and classify anomalies

**Files:**
- Modify: `scripts/fix-product-discount-overrides.ts`

This task implements the "classify and build line-update batch" portion. Pseudocode only — Gemini writes the actual TypeScript per the algorithm. Code blocks below are structural references, not literal code to copy.

- [ ] **Step 1: Replace `// TODO Step 5` with the sheet-read block**

Read Order_Lines sheet directly via `sheets.spreadsheets.values.get` (same pattern as `recover-product-discount.ts:29-41`). Capture:
- All rows + header indices for: `id`, `order_id`, `variant_id`, `unit_price`, `qty`, `line_discount`

- [ ] **Step 2: Replace `// TODO Step 6` with the classification loop**

For each COMPLETED order whose `applied_promotion_snapshot_json` parses to `type === "PRODUCT_DISCOUNT"`:
- Parse `applicableVariants` from `promoSnapshot.applicable_products_json`
- For each Order_Lines row matching this order:
  - **If variant in applicable list** (Anomaly 2 fix):
    - Compute `expected = computeExpectedLineDiscount(unitPrice, qty, promoSnapshot.discount_type, Number(promoSnapshot.discount_value))`
    - If `Math.abs(actualLineDiscount - expected) > 2` → push `{ rowIndex, newValue: Math.round(expected), reason: "applicable-resync" }` into `lineUpdates`
  - **If variant NOT in applicable list** (Anomaly 3 fix, per Question 2 Option B):
    - Only zero out if at least one applicable variant line in this order already has `line_discount > 0` OR is about to be set by this script
    - Otherwise leave alone (might be legitimate cashier discount)
    - Push `{ rowIndex, newValue: 0, reason: "non-applicable-zero-out" }` into `lineUpdates`

- [ ] **Step 3: Verify the script still compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "fix-product-discount-overrides"`
Expected: no output.

---

## Task 6: Implement Step 7-10 — apply line updates, redistribute order discount, write report

**Files:**
- Modify: `scripts/fix-product-discount-overrides.ts`

- [ ] **Step 1: Replace `// TODO Step 7` with the first batchUpdate call**

If `!DRY_RUN && lineUpdates.length > 0`, call `sheets.spreadsheets.values.batchUpdate` with the line_discount updates. Same pattern as `recover-product-discount.ts:93-101`.

- [ ] **Step 2: Replace `// TODO Step 8` with the discount redistribution logic**

Per Question 1 Option A (approved in Task 3):
- Re-fetch the Orders sheet directly to get current row indices.
- For each order that had `promoSnapshot.type === "PRODUCT_DISCOUNT"` AND `discount_amount > 0`:
  - Compute `applicableSubtotal` = sum of post-fix line totals on applicable variants
  - Compute `nonApplicableSubtotal` = sum of line totals on non-applicable variants (using line base total, not post-discount)
  - If `nonApplicableSubtotal > 0`:
    - For each non-applicable line: `additionalDiscount = orderDiscount * (lineBaseTotal / nonApplicableSubtotal)`
    - New `line_discount = existingLineDiscount + additionalDiscount` (capped at `lineBaseTotal`)
    - Push into `lineUpdatesPhase2`
  - Push `{ rowIndex, newValue: 0 }` into `orderUpdates` for the order's `discount_amount` cell
- Edge case: if all lines are applicable (no non-applicable items), then `nonApplicableSubtotal = 0`. In that case, simply zero out `order.discount_amount` (the cashier's discount was effectively on the promo items, which we don't want to discount further). Document this case in the report.

- [ ] **Step 3: Replace `// TODO Step 9` with the second batchUpdate call**

Apply `lineUpdatesPhase2` and `orderUpdates` in two separate `batchUpdate` calls. Same defensive guards as Step 1.

- [ ] **Step 4: Replace `// TODO Step 10` with the report writer**

Write `fix-report.json` containing:
```json
{
  "generatedAt": "...",
  "mode": "DRY-RUN" | "LIVE",
  "summary": {
    "ordersProcessed": N,
    "applicableLineDiscountResynced": N,
    "nonApplicableLineDiscountZeroed": N,
    "orderDiscountRedistributed": N,
    "orderDiscountZeroedWithoutRedistribution": N
  },
  "perOrder": [
    { "orderId": "...", "orderNo": "...", "before": {...}, "after": {...} }
  ]
}
```

This file is the audit trail User will review.

- [ ] **Step 5: Verify the script compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "fix-product-discount-overrides"`
Expected: no output.

---

## Task 7: Dry-run the fix script

**Files:**
- Read: `fix-report.json` (generated in dry-run)

- [ ] **Step 1: Make a manual backup of the Orders and Order_Lines tabs**

In Google Sheets: right-click each tab → Duplicate. Name the copies `Orders_BACKUP_<date>` and `Order_Lines_BACKUP_<date>`. This is mandatory before any live run; `batchUpdate` is not reversible.

- [ ] **Step 2: Run dry-run**

Run: `npx tsx scripts/fix-product-discount-overrides.ts --dry-run`
Expected: writes `fix-report.json` with `mode: "DRY-RUN"`, prints summary counts to console.

- [ ] **Step 3: Sanity-check the counts**

Compare dry-run counts against the anomaly counts from Task 2:
- `applicableLineDiscountResynced` should be ≥ `APPLICABLE_VARIANT_LINE_DISCOUNT_MISMATCH` count (anomaly count is a lower bound — the fix resyncs ALL applicable lines, even ones already correct, if they happen to be in an order with a manual discount)
- `nonApplicableLineDiscountZeroed` should be ≤ `NON_APPLICABLE_VARIANT_HAS_LINE_DISCOUNT` count (Question 2 Option B may leave some alone)
- `orderDiscountRedistributed + orderDiscountZeroedWithoutRedistribution` should equal `PRODUCT_DISCOUNT_WITH_MANUAL_ORDER_DISCOUNT` count

If any of these don't line up, STOP and investigate before live run.

- [ ] **Step 4: Inspect the per-order detail for UCK000094**

Open `fix-report.json`. Find the entry for `UCK000094`. Confirm:
- Applicable variant (Sữa Dâu) `line_discount` is being set to exactly 10.000đ (assuming unit_price = 35.000đ, FLAT_PRICE = 25.000đ → 10k discount per cup)
- If the order has a Hồng Trà line, its `line_discount` is either zeroed OR increased by a redistributed share of `order.discount_amount`
- `order.discount_amount` is being set to 0

If UCK000094 is missing from the report, STOP — it means the snapshot parsing failed or the order was filtered out. Debug before proceeding.

---

## Task 8: Live run and per-order verification

**Files:** None modified; live migration.

- [ ] **Step 1: Run live**

Run: `npx tsx scripts/fix-product-discount-overrides.ts`
Expected: same shape as dry-run but with `mode: "LIVE"`. Writes `fix-report.json`.

- [ ] **Step 2: Verify UCK000094 in the DB**

Run a one-off inspection:
```bash
npx tsx -e "
import { findAllNoCache } from './lib/sheets_db';
(async () => {
  const orders = await findAllNoCache('Orders');
  const lines = await findAllNoCache('Order_Lines');
  const o = orders.find((x:any) => x.order_no === 'UCK000094');
  if (!o) { console.log('order not found'); return; }
  console.log('order.discount_amount:', o.discount_amount);
  console.log('order.applied_promotion_snapshot_json:', o.applied_promotion_snapshot_json);
  const myLines = lines.filter((l:any) => l.order_id === o.id);
  for (const l of myLines) {
    console.log('  line', l.variant_id, '| qty', l.qty, '| unit_price', l.unit_price, '| line_discount', l.line_discount);
  }
})();
"
```
Expected:
- `order.discount_amount` is now 0 (or near-zero)
- Applicable variant line has `line_discount = 10000` (35k → 25k)
- Non-applicable variant line has either `line_discount = 0` or a higher value than before (redistributed share)

- [ ] **Step 3: Re-run the summary audit to confirm Sữa Dâu revenue**

Run: `npx tsx scripts/audit-revenue-summary.ts`
Expected: the Sữa Dâu headline block now shows:
- `actualRevenueDuringPromo` = 1.825.000đ (matches `expectedRevenueDuringPromo`)
- `delta` = 0 (or within ±2đ rounding tolerance)
- `anomalousOrderCount` = 0

If actual ≠ expected, STOP and investigate the residual anomaly list (`audit-anomalies.json` after re-running `audit-revenue-anomalies.ts`).

---

## Task 9: Update POS logic so future orders don't regress

**Files:**
- Modify: `components/POSScreen.tsx:442-493`

The current logic (lines 442-493) discards the PRODUCT_DISCOUNT promo whenever `userCustomDiscount != null`. After Task 8's historical fix, future orders placed with the same cashier flow would re-introduce the same bug. This task closes that hole.

- [ ] **Step 1: Read the current logic block**

Run: `rtk read components/POSScreen.tsx | head -500 | tail -100`
Expected: see lines 442-493 (the `isOrderLevelDiscountActive` check and the `finalCart` mapping).

- [ ] **Step 2: Apply the fix — preserve PRODUCT_DISCOUNT on applicable variants even when manual order discount is active**

Pseudocode for the new logic (Gemini writes actual TypeScript):

```
isManualOrderDiscount = userCustomDiscount !== null
isOrderLevelPromoActive = appliedPromo?.type === "ORDER_DISCOUNT"

finalCart = cart.map(item => {
  lineDiscount = Number(item.discount_amount || 0)

  // PRODUCT_DISCOUNT applies to applicable variants REGARDLESS of manual order discount
  if (appliedPromo?.type === "PRODUCT_DISCOUNT" && applicableVariantsList.includes(item.variant_id)) {
    promoDiscount = computePromoItemDiscount(...)
    lineDiscount = Math.min(itemBaseTotal, lineDiscount + promoDiscount)
  }

  return { ...item, discount_amount: lineDiscount, discount_type: "VND" }
})

// Manual order discount OR ORDER_DISCOUNT promo lives ONLY in order.discount_amount
finalDiscountAmountInVND = computeFromUserCustomOrOrderDiscountPromo(...)

// IMPORTANT: applied_promotion_id and applied_promotion_snapshot_json are preserved
// even when userCustomDiscount is set, so future audits can detect that the order
// had a PRODUCT_DISCOUNT context. (Today the snapshot is wiped — that's the bug.)
finalAppliedPromoId = appliedPromo?.id || ""
finalAppliedPromoSnapshot = appliedPromo ? JSON.stringify(appliedPromo) : ""
finalDiscountReason = userCustomDiscount !== null ? "MANUAL_DISCOUNT" : ""
```

Key behavior changes vs. current:
1. `PRODUCT_DISCOUNT` promo always lands in `line_discount` of applicable variants, even when `userCustomDiscount` is set
2. `applied_promotion_snapshot_json` is preserved (not wiped) when manual discount is active — so audits/reports can detect the combo
3. Manual order-level discount continues to live in `order.discount_amount`, and will be redistributed by the fix script if it ever happens again

- [ ] **Step 3: Verify TypeScript compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "POSScreen"`
Expected: no output.

- [ ] **Step 4: Smoke-test the POS in browser**

Start dev server: `npm run dev`. In browser:
1. Open POS, add Sữa Dâu (35k) + Hồng Trà (30k) to cart
2. Apply PRM-003 (or whichever active PRODUCT_DISCOUNT promo covers Sữa Dâu) — verify cart shows Sữa Dâu discounted to 25k
3. Open checkout modal, enter 5.000đ manual order discount
4. Pay (any method)
5. In `Orders` sheet, find the new order. Verify:
   - `discount_amount` = 5000 (the manual order discount)
   - `applied_promotion_id` = (PRM-003 id) — NOT empty
   - `applied_promotion_snapshot_json` contains the promo — NOT empty
   - Sữa Dâu line has `line_discount` = 10000 (35k - 25k promo)
   - Hồng Trà line has `line_discount` = 0

If any of these fail, revert the POS change and re-work.

- [ ] **Step 5: Commit the POS change**

Run:
```bash
rtk git add components/POSScreen.tsx
rtk git commit -m "$(cat <<'EOF'
fix(pos): preserve PRODUCT_DISCOUNT promo under manual order discount

When cashier enters a value in the checkout-modal discount field,
userCustomDiscount != null flipped isOrderLevelDiscountActive and the
PRODUCT_DISCOUNT block early-returned, dropping the promo entirely
(line_discount = 0 on applicable variants) and wiping the
applied_promotion_snapshot_json. Result: promo-covered items reported
full price, and the audit trail lost evidence that the promo was active.

New behavior:
- PRODUCT_DISCOUNT promo ALWAYS lands on applicable variants' line_discount
  regardless of userCustomDiscount.
- applied_promotion_snapshot_json is preserved when manual discount is active,
  so reports/audits can detect the combo and redistribute correctly.
- Manual order-level discount continues to live in order.discount_amount.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Cross-check P&L report

**Files:** None modified; verification only.

- [ ] **Step 1: Open P&L report in browser**

Navigate to `/admin/reports/pnl`. Set the date filter to cover the Sữa Dâu promo window (the dates printed in Task 1's summary).

- [ ] **Step 2: Verify Sữa Dâu revenue**

Find "Sữa Dâu sấy giòn" in the product profit table. Confirm `revenue` column shows 1.825.000đ (or within ±1đ rounding).

- [ ] **Step 3: Verify no other product regressed**

For each other product in the P&L table, eyeball the revenue vs the audit-summary.json expected-vs-actual numbers. None should have moved by more than a few đồng due to rounding.

- [ ] **Step 4: Verify Sales report**

Navigate to `/admin/reports/sales`. Verify total revenue is consistent with the P&L (within rounding). Verify the Sữa Dâu row shows the expected total revenue.

- [ ] **Step 5: Hand off to Antigravity for final cross-check**

Notify Antigravity that the fix is complete and ready for the cross-check described in the implementation plan's "Verification Plan" section.

---

## Self-Review Checklist

- [ ] Audit scripts written and compile clean? → ✓ scripts/audit-revenue-anomalies.ts, scripts/audit-revenue-summary.ts (already done by Claude)
- [ ] Task 1 runs both audits and captures headline? → ✓ Task 1
- [ ] Task 2 classifies anomalies and sets scope? → ✓ Task 2
- [ ] Task 3 sends algorithm decisions to User and waits for approval? → ✓ Task 3 (mandatory checkpoint)
- [ ] Task 4-6 build the fix script in bite-sized steps? → ✓ skeleton → classify → apply + report
- [ ] Task 7 dry-runs before live? → ✓ Task 7 (manual backup mandatory)
- [ ] Task 8 live-runs and verifies UCK000094 in DB? → ✓ Task 8
- [ ] Task 9 updates POS logic so the bug doesn't re-introduce? → ✓ Task 9
- [ ] Task 10 cross-checks P&L report? → ✓ Task 10
- [ ] No implementation code in the task list itself (only algorithm + structure)? → ✓ fix script body left for Gemini to write; pseudocode blocks are structural
- [ ] References to undefined functions? → ✓ `computePromoItemDiscount` is named only inside pseudocode, not as a real call

---

## Notes for the implementing agent (Gemini)

- **Antigravity's verification bar is strict**: Sữa Dâu must show **exactly** 1.825.000đ in P&L after the fix. Anything else (1.824.998đ, 1.825.002đ) is rounding noise and acceptable; anything off by more than 5đ is a bug.
- **Do NOT re-run `fix-historical-discounts.ts`, `recover-product-discount.ts`, or `zero-out-prorated-line-discounts.ts`.** All three are superseded by the new `fix-product-discount-overrides.ts`.
- **The `--dry-run` flag is mandatory before live run.** The script uses `batchUpdate` which is not reversible.
- **The manual Sheets backup in Task 7 Step 1 is mandatory.** No backup, no live run.
- **Anomaly type `POTENTIAL_PROMO_NOT_APPLIED` is intentionally out of scope.** Applying a promo retroactively to an order where the cashier chose not to use it would be a data-integrity violation. If User wants these reviewed individually, that's a follow-up task.
- **The POS logic change in Task 9 is critical.** Without it, any new order placed with the same cashier flow will reintroduce the bug. Ship the POS fix on the same release as the historical data fix.
