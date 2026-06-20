# Subtotal Column Fix & PRODUCT_DISCOUNT Line-Discount Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two related data-correctness bugs: (1) POS writes order subtotal under the wrong column name, causing P&L to lose order-level discount context; (2) historical PRODUCT_DISCOUNT promotions were wrongly prorated across all items in an order, distorting per-item revenue.

**Architecture:**
- **Code fix (write-path & read-path):** Rename the order-subtotal payload key from `subtotal_amount` to `subtotal` in `pos.ts` and `order-edit.ts`. Update report readers in `reports.ts` and `sales/page.tsx` to read `o.subtotal || o.subtotal_amount || 0` so old rows keep working until backfilled.
- **Data backfill script (`scripts/fix-subtotal-and-line-discounts.ts`):** Single script with two jobs. Job A: for every COMPLETED order whose `subtotal` column is blank/zero, compute `subtotal = total_amount + discount_amount + sum(line.line_discount)`. Job B: for every COMPLETED order whose `applied_promotion_snapshot_json.type === "PRODUCT_DISCOUNT"`, zero out `line_discount` on non-applicable variants and re-compute `line_discount` on applicable variants from the promotion formula. Jobs run per-order, line_discount recovery BEFORE subtotal backfill so the subtotal formula reads corrected lines.

**Tech Stack:** Next.js 14 (App Router), TypeScript 5, Google Sheets as DB via `lib/sheets_db.ts`, run scripts via `npx tsx`.

---

## File Structure

### Code changes (4 existing files)
- `app/actions/pos.ts:44` — new-order write path. Change payload key `subtotal_amount` → `subtotal`.
- `app/actions/order-edit.ts:186` — order-edit write path. Change `update()` payload key `subtotal_amount` → `subtotal`.
- `app/actions/reports.ts:161` — P&L reader. Defensive read `o.subtotal || o.subtotal_amount || 0`.
- `app/admin/reports/sales/page.tsx:54` — Sales report reader. Same defensive read.

### New script (1 file)
- `scripts/fix-subtotal-and-line-discounts.ts` — Self-contained migration. Imports `findAllNoCache` and `getSheetsClient` from `../lib/sheets_db`. Two phases per affected order: (B) recover line_discount, then (A) backfill subtotal. Supports `--dry-run` flag.

### Reference files (read-only, for understanding)
- `scripts/recover-product-discount.ts` — existing partial recovery; only updates applicable variants (does NOT zero non-applicable). Superseded by the new script.
- `scripts/fix-historical-discounts.ts` — original buggy prorating script. Do not re-run.
- `types/db.ts` — type definitions for `DBOrder`, `DBOrderLine`, `DBPromotion`.

---

## Task 1: Fix subtotal key in `app/actions/pos.ts`

**Files:**
- Modify: `app/actions/pos.ts:44`

- [ ] **Step 1: Read the current line to confirm context**

Run: `rtk read app/actions/pos.ts | head -60 | tail -25`
Expected: see line 44 inside the `insert("Orders", {...})` call:
```ts
      total_amount,
      subtotal_amount: subtotal_amount || total_amount,
      discount_amount: discount_amount || 0,
```

- [ ] **Step 2: Apply the rename**

Edit `app/actions/pos.ts` — change line 44 from:
```ts
      subtotal_amount: subtotal_amount || total_amount,
```
to:
```ts
      subtotal: subtotal_amount || total_amount,
```

Note: the local variable `subtotal_amount` (destructured on line 25) stays as-is. Only the payload key changes; the source value is still the same variable.

- [ ] **Step 3: Verify TypeScript still compiles for this file**

Run: `rtk tsc --noEmit 2>&1 | grep "app/actions/pos"`
Expected: no output (no errors for this file).

---

## Task 2: Fix subtotal key in `app/actions/order-edit.ts`

**Files:**
- Modify: `app/actions/order-edit.ts:186`

- [ ] **Step 1: Read the current block**

Run: `rtk read app/actions/order-edit.ts | head -200 | tail -25`
Expected: lines 184-192 contain the `update("Orders", orderId, {...})` call:
```ts
    await update("Orders", orderId, {
      total_amount,
      subtotal_amount,
      discount_amount,
      discount_type: "VND", // Force VND since we calculate it on the frontend
      method: payment_method,
      applied_promotion_id: "", // Xóa khuyến mãi nếu có chỉnh sửa sau thanh toán
      discount_reason: "Chỉnh sửa sau khi thanh toán",
    });
```

- [ ] **Step 2: Apply the rename**

Edit `app/actions/order-edit.ts` — in the `update("Orders", orderId, {...})` call, change:
```ts
      subtotal_amount,
```
to:
```ts
      subtotal: subtotal_amount,
```

The destructured local variable on line 74 (`subtotal_amount`) stays as-is.

- [ ] **Step 3: Verify TypeScript still compiles for this file**

Run: `rtk tsc --noEmit 2>&1 | grep "app/actions/order-edit"`
Expected: no output.

---

## Task 3: Defensive subtotal read in `app/actions/reports.ts`

**Files:**
- Modify: `app/actions/reports.ts:161`

- [ ] **Step 1: Read the current block**

Run: `rtk read app/actions/reports.ts | head -170 | tail -15`
Expected: lines 158-164 contain the discount-ratio precompute loop:
```ts
  completedOrders.forEach((o: any) => {
    const subtotal = Number(o.subtotal_amount || 0);
    const orderDiscount = Number(o.discount_amount || 0);
    orderDiscountRatioById[o.id] = subtotal > 0 ? Math.min(1, orderDiscount / subtotal) : 0;
  });
```

- [ ] **Step 2: Apply the fallback read**

Edit `app/actions/reports.ts:161` — change:
```ts
    const subtotal = Number(o.subtotal_amount || 0);
```
to:
```ts
    const subtotal = Number(o.subtotal || o.subtotal_amount || 0);
```

The fallback to `o.subtotal_amount` covers any orders edited before the rename took effect (and any rows the backfill script hasn't touched yet).

- [ ] **Step 3: Verify TypeScript still compiles for this file**

Run: `rtk tsc --noEmit 2>&1 | grep "app/actions/reports"`
Expected: no output.

---

## Task 4: Defensive subtotal read in `app/admin/reports/sales/page.tsx`

**Files:**
- Modify: `app/admin/reports/sales/page.tsx:54`

- [ ] **Step 1: Read the current block**

Run: `rtk read app/admin/reports/sales/page.tsx | head -60 | tail -15`
Expected: lines 50-57 contain the same precompute loop:
```ts
  const orderDiscountRatioById: Record<string, number> = {};
  completedOrders.forEach((o: any) => {
    const subtotal = Number(o.subtotal_amount || 0);
    const orderDiscount = Number(o.discount_amount || 0);
    orderDiscountRatioById[o.id] = subtotal > 0 ? Math.min(1, orderDiscount / subtotal) : 0;
  });
```

- [ ] **Step 2: Apply the fallback read**

Edit `app/admin/reports/sales/page.tsx:54` — change:
```ts
    const subtotal = Number(o.subtotal_amount || 0);
```
to:
```ts
    const subtotal = Number(o.subtotal || o.subtotal_amount || 0);
```

- [ ] **Step 3: Verify TypeScript still compiles for this file**

Run: `rtk tsc --noEmit 2>&1 | grep "app/admin/reports/sales"`
Expected: no output.

---

## Task 5: Commit the 4 code changes

**Files:**
- Stage: `app/actions/pos.ts`, `app/actions/order-edit.ts`, `app/actions/reports.ts`, `app/admin/reports/sales/page.tsx`

- [ ] **Step 1: Review the combined diff**

Run: `rtk git diff app/actions/pos.ts app/actions/order-edit.ts app/actions/reports.ts app/admin/reports/sales/page.tsx`
Expected: 4 small hunks, each renaming or adding the `subtotal` fallback. No unrelated changes.

- [ ] **Step 2: Stage exactly these 4 files**

Run: `rtk git add app/actions/pos.ts app/actions/order-edit.ts app/actions/reports.ts app/admin/reports/sales/page.tsx`

- [ ] **Step 3: Commit**

Run:
```bash
rtk git commit -m "$(cat <<'EOF'
fix(orders): write order subtotal under correct column name

POS and order-edit were sending the key `subtotal_amount`, but the
Orders sheet column is named `subtotal`. Result: the column was blank
for every order, so reports.ts and sales/page.tsx computed
order_discount_ratio = 0 and silently dropped order-level discounts.

- pos.ts, order-edit.ts: send key `subtotal` (value source unchanged).
- reports.ts, sales/page.tsx: read `o.subtotal || o.subtotal_amount || 0`
  so historical rows keep working until the backfill script runs.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit created, working tree clean for these 4 files.

---

## Task 6: Create the migration script skeleton

**Files:**
- Create: `scripts/fix-subtotal-and-line-discounts.ts`

- [ ] **Step 1: Confirm scripts/ directory exists**

Run: `ls scripts | head -5`
Expected: shows existing script files (`fix-historical-discounts.ts`, `recover-product-discount.ts`, etc.).

- [ ] **Step 2: Create the file with imports, constants, and a `main()` shell**

Write `scripts/fix-subtotal-and-line-discounts.ts`:
```ts
import { findAllNoCache, getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const DRY_RUN = process.argv.includes("--dry-run");

// ===== Types =====

interface PromotionSnapshot {
  type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  discount_type: "PERCENT" | "FLAT_PRICE";
  discount_value: number | string;
  applicable_products_json?: string;
}

interface OrderRow {
  id: string;
  status: string;
  total_amount: string | number;
  subtotal?: string | number;
  subtotal_amount?: string | number;
  discount_amount: string | number;
  applied_promotion_snapshot_json?: string;
  created_at: string;
}

// ===== Helpers =====

/**
 * Compute the correct per-line discount for a PRODUCT_DISCOUNT promotion.
 * Mirrors the runtime formula used in app/pos/page.tsx and recover-product-discount.ts.
 */
function computeProductDiscountLineDiscount(
  unitPrice: number,
  qty: number,
  promo: PromotionSnapshot,
  variantValue: number | string
): number {
  const val = Number(variantValue);
  if (promo.discount_type === "PERCENT") {
    return Math.round(unitPrice * qty * (val / 100));
  }
  if (promo.discount_type === "FLAT_PRICE") {
    return Math.max(0, unitPrice - val) * qty;
  }
  // Default: flat VND per unit
  return val * qty;
}

/**
 * Parse `applicable_products_json`. It can be:
 *   - An array of variant IDs (use promo.discount_value for all)
 *   - An object map { variantId: perVariantValueOrOverride }
 * Returns { variantIds: Set, valueByVariant: Map }.
 */
function parseApplicableProducts(
  rawJson: string | undefined
): { variantIds: Set<string>; valueByVariant: Map<string, number | string> } {
  const variantIds = new Set<string>();
  const valueByVariant = new Map<string, number | string>();

  if (!rawJson) return { variantIds, valueByVariant };

  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed)) {
      parsed.forEach((id: string) => variantIds.add(id));
    } else if (parsed && typeof parsed === "object") {
      Object.entries(parsed).forEach(([id, val]) => {
        variantIds.add(id);
        valueByVariant.set(id, val as number | string);
      });
    }
  } catch (e) {
    // leave empty
  }
  return { variantIds, valueByVariant };
}

// ===== Main =====

async function main() {
  if (!SPREADSHEET_ID) {
    throw new Error("GOOGLE_SPREADSHEET_ID env var is required");
  }
  console.log(`[fix-subtotal-and-line-discounts] mode=${DRY_RUN ? "DRY-RUN" : "LIVE"}`);

  // TODO Job B: recover PRODUCT_DISCOUNT line_discounts
  // TODO Job A: backfill missing `subtotal` column
  console.log("[fix-subtotal-and-line-discounts] done.");
}

main().catch((err) => {
  console.error("[fix-subtotal-and-line-discounts] FATAL:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify the skeleton compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "fix-subtotal-and-line-discounts"`
Expected: no output.

---

## Task 7: Implement Job B — recover PRODUCT_DISCOUNT line_discounts

**Files:**
- Modify: `scripts/fix-subtotal-and-line-discounts.ts` (replace the `// TODO Job B` block inside `main()`)

- [ ] **Step 1: Read the script before editing**

Run: `rtk read scripts/fix-subtotal-and-line-discounts.ts | tail -40`
Expected: see the `main()` body with the two TODO markers and the final log line.

- [ ] **Step 2: Insert Job B implementation**

Edit `scripts/fix-subtotal-and-line-discounts.ts` — replace the line:
```ts
  // TODO Job B: recover PRODUCT_DISCOUNT line_discounts
```
with:
```ts
  // ===== Job B: recover PRODUCT_DISCOUNT line_discounts =====
  // For every COMPLETED order whose promotion snapshot is PRODUCT_DISCOUNT:
  //   - Lines on applicable variants: re-set line_discount from promo formula.
  //   - Lines on non-applicable variants: zero out (undo wrong prorating).
  console.log("[Job B] Fetching Orders and Order_Lines ...");

  const orders = await findAllNoCache("Orders");
  const sheets = getSheetsClient();

  const resLines = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!A1:Z`,
  });
  const rowsLines = resLines.data.values || [];
  const headersL = rowsLines[0] as string[];
  const idIdxL = headersL.indexOf("id");
  const orderIdIdxL = headersL.indexOf("order_id");
  const variantIdIdxL = headersL.indexOf("variant_id");
  const unitPriceIdxL = headersL.indexOf("unit_price");
  const qtyIdxL = headersL.indexOf("qty");
  const lineDiscountIdxL = headersL.indexOf("line_discount");

  if ([idIdxL, orderIdIdxL, variantIdIdxL, unitPriceIdxL, qtyIdxL, lineDiscountIdxL].some((i) => i < 0)) {
    throw new Error("Order_Lines is missing one of required columns: id, order_id, variant_id, unit_price, qty, line_discount");
  }

  const productDiscountOrders = orders.filter((o: OrderRow) => {
    if (o.status !== "COMPLETED") return false;
    if (!o.applied_promotion_snapshot_json) return false;
    try {
      const promo = JSON.parse(o.applied_promotion_snapshot_json) as PromotionSnapshot;
      return promo.type === "PRODUCT_DISCOUNT";
    } catch {
      return false;
    }
  });

  console.log(`[Job B] ${productDiscountOrders.length} orders with PRODUCT_DISCOUNT promotion snapshot.`);

  const lineUpdates: { range: string; values: number[][] }[] = [];
  let applicableFixed = 0;
  let nonApplicableZeroed = 0;

  for (const order of productDiscountOrders) {
    let promo: PromotionSnapshot;
    try {
      promo = JSON.parse(order.applied_promotion_snapshot_json!) as PromotionSnapshot;
    } catch {
      continue;
    }

    const { variantIds, valueByVariant } = parseApplicableProducts(promo.applicable_products_json);
    if (variantIds.size === 0) continue; // nothing to do; can't tell which line was the promo target

    for (let i = 1; i < rowsLines.length; i++) {
      const row = rowsLines[i];
      if (!row || row[orderIdIdxL] !== order.id) continue;

      const variantId = row[variantIdIdxL];
      const qty = Number(row[qtyIdxL] || 1);
      const unitPrice = Number(row[unitPriceIdxL] || 0);
      const lineDiscountCol = String.fromCharCode(65 + lineDiscountIdxL);

      let newLineDiscount: number;
      if (variantIds.has(variantId)) {
        const val = valueByVariant.has(variantId) ? valueByVariant.get(variantId)! : promo.discount_value;
        newLineDiscount = computeProductDiscountLineDiscount(unitPrice, qty, promo, val);
        applicableFixed++;
      } else {
        newLineDiscount = 0;
        nonApplicableZeroed++;
      }

      lineUpdates.push({
        range: `Order_Lines!${lineDiscountCol}${i + 1}`,
        values: [[newLineDiscount]],
      });
    }
  }

  console.log(`[Job B] Prepared ${lineUpdates.length} line updates (applicable fixed: ${applicableFixed}, non-applicable zeroed: ${nonApplicableZeroed}).`);

  if (!DRY_RUN && lineUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID!,
      requestBody: { valueInputOption: "USER_ENTERED", data: lineUpdates },
    });
    console.log("[Job B] Line updates written.");
  } else if (DRY_RUN) {
    console.log("[Job B] DRY-RUN: no writes performed.");
  }
```

- [ ] **Step 3: Verify the script still compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "fix-subtotal-and-line-discounts"`
Expected: no output.

---

## Task 8: Implement Job A — backfill missing `subtotal`

**Files:**
- Modify: `scripts/fix-subtotal-and-line-discounts.ts` (replace the `// TODO Job A` block inside `main()`)

- [ ] **Step 1: Read the current state of the file**

Run: `rtk read scripts/fix-subtotal-and-line-discounts.ts | tail -20`
Expected: see `// TODO Job A: backfill missing subtotal column` as the only remaining TODO.

- [ ] **Step 2: Insert Job A implementation**

Edit `scripts/fix-subtotal-and-line-discounts.ts` — replace the line:
```ts
  // TODO Job A: backfill missing `subtotal` column
```
with:
```ts
  // ===== Job A: backfill missing `subtotal` column =====
  // For every COMPLETED order whose `subtotal` column is blank/zero:
  //   subtotal = total_amount + discount_amount + sum(line.line_discount)
  // (Job B has already corrected line_discounts above, so this formula reads the right values.)
  console.log("[Job A] Re-fetching Orders and Order_Lines for current state ...");

  const ordersAfterB = await findAllNoCache("Orders");
  const resLinesA = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Order_Lines!A1:Z`,
  });
  const rowsLinesA = resLinesA.data.values || [];
  const headersLA = rowsLinesA[0] as string[];
  const orderIdIdxLA = headersLA.indexOf("order_id");
  const lineDiscountIdxLA = headersLA.indexOf("line_discount");

  const resOrdersA = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Orders!A1:Z`,
  });
  const rowsOrdersA = resOrdersA.data.values || [];
  const headersOA = rowsOrdersA[0] as string[];
  const idIdxOA = headersOA.indexOf("id");
  const totalAmountIdxOA = headersOA.indexOf("total_amount");
  const discountAmountIdxOA = headersOA.indexOf("discount_amount");
  let subtotalIdxOA = headersOA.indexOf("subtotal");

  if (subtotalIdxOA < 0) {
    throw new Error("Orders sheet is missing the `subtotal` column. Add the column in Google Sheets before running this script.");
  }

  // Build a map: orderId -> sum(line.line_discount) using current Order_Lines state
  const lineDiscountSumByOrderId = new Map<string, number>();
  for (let i = 1; i < rowsLinesA.length; i++) {
    const row = rowsLinesA[i];
    if (!row) continue;
    const oid = row[orderIdIdxLA];
    const ld = Number(row[lineDiscountIdxLA] || 0);
    lineDiscountSumByOrderId.set(oid, (lineDiscountSumByOrderId.get(oid) || 0) + ld);
  }

  const orderUpdates: { range: string; values: number[][] }[] = [];
  let backfilled = 0;

  for (let i = 1; i < rowsOrdersA.length; i++) {
    const row = rowsOrdersA[i];
    if (!row) continue;
    if (row[idIdxOA] === undefined) continue;

    // Find the corresponding order object to check status
    const orderObj = ordersAfterB.find((o: OrderRow) => o.id === row[idIdxOA]);
    if (!orderObj || orderObj.status !== "COMPLETED") continue;

    const existingSubtotal = Number(row[subtotalIdxOA] || 0);
    if (existingSubtotal > 0) continue; // already populated, leave alone

    const totalAmount = Number(row[totalAmountIdxOA] || 0);
    const discountAmount = Number(row[discountAmountIdxOA] || 0);
    const lineDiscountSum = lineDiscountSumByOrderId.get(row[idIdxOA]) || 0;
    const newSubtotal = Math.round(totalAmount + discountAmount + lineDiscountSum);

    const subtotalCol = String.fromCharCode(65 + subtotalIdxOA);
    orderUpdates.push({
      range: `Orders!${subtotalCol}${i + 1}`,
      values: [[newSubtotal]],
    });
    backfilled++;
  }

  console.log(`[Job A] Prepared ${orderUpdates.length} order subtotal updates (backfilled: ${backfilled}).`);

  if (!DRY_RUN && orderUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID!,
      requestBody: { valueInputOption: "USER_ENTERED", data: orderUpdates },
    });
    console.log("[Job A] Order subtotal updates written.");
  } else if (DRY_RUN) {
    console.log("[Job A] DRY-RUN: no writes performed.");
  }
```

Note: the script reads the live `Order_Lines` sheet AFTER Job B's writes have been applied (when not in dry-run). This is intentional — Job A's `lineDiscountSumByOrderId` must reflect corrected line_discounts.

- [ ] **Step 3: Verify the script compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "fix-subtotal-and-line-discounts"`
Expected: no output.

---

## Task 9: Dry-run verification

**Files:**
- None modified; runs the script in read-only mode against production data.

- [ ] **Step 1: Confirm environment is set**

Run: `echo $GOOGLE_SPREADSHEET_ID`
Expected: non-empty value. If empty, source the project's `.env` (the script reads `process.env.GOOGLE_SPREADSHEET_ID`).

- [ ] **Step 2: Run the script in dry-run mode**

Run: `npx tsx scripts/fix-subtotal-and-line-discounts.ts --dry-run`
Expected output (approximate counts will vary):
```
[fix-subtotal-and-line-discounts] mode=DRY-RUN
[Job B] Fetching Orders and Order_Lines ...
[Job B] N orders with PRODUCT_DISCOUNT promotion snapshot.
[Job B] Prepared M line updates (applicable fixed: X, non-applicable zeroed: Y).
[Job B] DRY-RUN: no writes performed.
[Job A] Re-fetching Orders and Order_Lines for current state ...
[Job A] Prepared K order subtotal updates (backfilled: K).
[Job A] DRY-RUN: no writes performed.
[fix-subtotal-and-line-discounts] done.
```

- [ ] **Step 3: Sanity-check the counts**

Verify in the output:
- `X` (applicable fixed) > 0 — there's at least one PRODUCT_DISCOUNT order with an applicable variant line.
- `Y` (non-applicable zeroed) > 0 — there's at least one prorated line that needs zeroing.
- `K` (subtotal backfilled) is roughly the count of COMPLETED orders that lack a `subtotal` value.

If any count looks off (especially 0), STOP and investigate before running live. Use `scripts/inspect.ts` or `scripts/inspect-lines.ts` as a reference for inspecting raw sheet data.

---

## Task 10: Live run and per-order verification

**Files:**
- None modified; runs the script for real and verifies a known sample order.

- [ ] **Step 1: Identify a known sample order before running**

Pick one PRODUCT_DISCOUNT order from the dry-run output. As an example, the assignment mentions order `UCK000132` (Sữa dâu + Hồng trà with PRM-003). Confirm the expected outcome:

| Line | Before | After |
|---|---|---|
| Sữa dâu (applicable variant) | line_discount = ~6.140đ (wrong prorate) | line_discount = 10.000đ (full promo) |
| Hồng trà (non-applicable variant) | line_discount = ~3.860đ (wrong prorate) | line_discount = 0 |

Write down the order ID and the two variant IDs so we can verify after the run.

- [ ] **Step 2: Run the script for real**

Run: `npx tsx scripts/fix-subtotal-and-line-discounts.ts`
Expected: same shape as dry-run, but with `mode=LIVE` and the lines `[Job B] Line updates written.` and `[Job A] Order subtotal updates written.` instead of the DRY-RUN lines.

- [ ] **Step 3: Verify Order_Lines changes via inspect script**

Run a one-off inspect (or extend `scripts/inspect-lines.ts`) to fetch the lines for the sample order:
```bash
npx tsx -e "
import { findAllNoCache } from './lib/sheets_db';
(async () => {
  const lines = await findAllNoCache('Order_Lines');
  const sample = lines.filter((l: any) => l.order_id === '<SAMPLE_ORDER_ID>');
  console.log(JSON.stringify(sample, null, 2));
})();
"
```
Expected: the applicable-variant line now has the full promo discount (~10.000đ), and the non-applicable-variant line has `line_discount: 0`.

- [ ] **Step 4: Verify Orders.subtotal via inspect**

Run:
```bash
npx tsx -e "
import { findAllNoCache } from './lib/sheets_db';
(async () => {
  const orders = await findAllNoCache('Orders');
  const sample = orders.find((o: any) => o.id === '<SAMPLE_ORDER_ID>');
  console.log('subtotal:', sample.subtotal, '| total_amount:', sample.total_amount, '| discount_amount:', sample.discount_amount);
})();
"
```
Expected: `subtotal` is now populated and equals roughly `total_amount + discount_amount + sum(line.line_discount)`.

- [ ] **Step 5: Verify in the UI**

- Open `/admin/orders` → click the sample order → confirm the modal shows correct line totals (Sữa dâu shows original 35k struck through, 25k post-discount; Hồng trà shows no discount row).
- Open `/admin/reports/pnl` → filter to the order's date → find "Sữa dâu sấy giòn" → revenue should match the corrected math.
- Open `/admin/reports/sales` → confirm total revenue matches.

---

## Task 11: Commit the new script

**Files:**
- Stage: `scripts/fix-subtotal-and-line-discounts.ts`

- [ ] **Step 1: Confirm the file exists and is tracked**

Run: `rtk git status scripts/fix-subtotal-and-line-discounts.ts`
Expected: file is listed under "Untracked files" or "Changes to be committed".

- [ ] **Step 2: Stage and commit**

Run:
```bash
rtk git add scripts/fix-subtotal-and-line-discounts.ts
rtk git commit -m "$(cat <<'EOF'
feat(scripts): backfill subtotal + recover PRODUCT_DISCOUNT line_discounts

Two-job migration that runs once against the Orders and Order_Lines sheets.

Job B (line_discount recovery): for every COMPLETED order whose
applied_promotion_snapshot_json.type === "PRODUCT_DISCOUNT", recompute
line_discount on applicable variants from the promo formula and zero
out the wrongly-prorated line_discount on non-applicable variants.

Job A (subtotal backfill): for every COMPLETED order whose `subtotal`
column is blank/zero, compute
  subtotal = total_amount + discount_amount + sum(line.line_discount)
using the corrected line_discounts from Job B.

Run with `--dry-run` first to preview counts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit created.

---

## Self-Review Checklist

- [ ] All 4 code-change files renamed/fallback applied per Antigravity plan?
  - pos.ts → ✓ Task 1
  - order-edit.ts → ✓ Task 2
  - reports.ts → ✓ Task 3
  - sales/page.tsx → ✓ Task 4
- [ ] New script handles BOTH jobs in the Antigravity plan?
  - Job 1 (subtotal backfill) → ✓ Task 8
  - Job 2 (line_discount recovery) → ✓ Task 7
- [ ] Order of operations correct? Job B (line_discount) runs BEFORE Job A (subtotal) so the subtotal formula reads corrected values → ✓ verified in Task 8 step 2 comment.
- [ ] Non-applicable variants are zeroed (not just applicable ones fixed)? → ✓ Task 7 step 2 covers both branches.
- [ ] PRODUCT_DISCOUNT formula matches runtime POS formula (PERCENT / FLAT_PRICE / flat VND)? → ✓ Task 6 step 2 `computeProductDiscountLineDiscount`.
- [ ] Script supports `--dry-run` and refuses to run without `GOOGLE_SPREADSHEET_ID`? → ✓ Task 6 step 2 and Task 9.
- [ ] No placeholders, every code step shows actual code? → ✓ all steps contain concrete code blocks.

---

## Notes for the implementing agent

- **Do NOT re-run `scripts/fix-historical-discounts.ts`.** It's the original buggy prorate script — the new script supersedes it.
- **Do NOT re-run `scripts/recover-product-discount.ts`.** It only fixes applicable variants without zeroing non-applicable ones — partial fix that the new script supersedes.
- **Make a manual backup of the Orders and Order_Lines tabs in Google Sheets before the live run.** Right-click tab → Duplicate. The script uses `batchUpdate` which is not reversible.
- **If the dry-run reports 0 PRODUCT_DISCOUNT orders**, double-check that `applied_promotion_snapshot_json` is actually populated on historical orders. Orders created before that column existed cannot be auto-recovered by this script; they need manual classification.
