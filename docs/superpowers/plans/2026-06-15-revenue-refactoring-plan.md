# Revenue Double-Counting Fix - Refactoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Untangle the discount double-counting bug by establishing a clean separation between Order-Level discounts (`order.discount_amount`) and Item-Level discounts (`order_line.line_discount`), then teach the Reports to combine both correctly.

**Architecture:** POS stops prorating Order-Level discounts into `line_discount` and stops overwriting cashier-entered per-item discounts. The shared utility `computeLineRevenue` gains an `order_discount_ratio` parameter so every caller (Sales report, P&L action) can apply the order-level discount proportionally on top of line-level revenue. `submitOrder` and `editOrder` actions are unchanged because they only persist what POS sends.

**Tech Stack:** Next.js 14 server actions, Google Sheets DB (`lib/sheets_db.ts`), TypeScript strict. No test framework - verification via `npx tsc --noEmit`, `next lint`, and dev-server smoke tests.

---

## Part A: Architectural Audit Findings

### A.1 The Two Discount Fields in the Data Model

The `Orders` and `Order_Lines` sheets carry two independent discount fields (see `types/db.ts`):

| Field | Sheet | Semantic | Owner |
|---|---|---|---|
| `Orders.discount_amount` | Orders | Order-Level discount in VND | Whole-cart discount: manual cashier entry OR `Promotion.type === "ORDER_DISCOUNT"` |
| `Order_Lines.line_discount` | Order_Lines | Item-Level discount in VND | Per-item discount: cashier popup entry OR `Promotion.type === "PRODUCT_DISCOUNT"` |

`Order_Lines.discount_type` is informational only - POS already converts PERCENT to VND before persisting (`POSScreen.tsx:482-484`).

### A.2 Root Cause #1 - POS corrupts Item-Level discounts (POSScreen.tsx)

In `handleConfirmCheckout` the `finalCart` mapping (lines 435-485) **overwrites** every cart item's `discount_amount` based on which promotion is currently active:

```ts
// Current broken logic, POSScreen.tsx:436-485
const finalCart = cart.map(item => {
  let lineDiscount = 0;
  // ...
  if (userCustomDiscount !== null || (appliedPromo?.type === "ORDER_DISCOUNT")) {
    // PRORATES order-level discount into line_discount
    lineDiscount = finalDiscountAmountInVND * (itemBaseTotal / subtotal);
  } else if (appliedPromo?.type === "PRODUCT_DISCOUNT") {
    // REPLACES any existing cashier item discount with promo discount
    lineDiscount = Math.min(itemBaseTotal, itemSpecificDiscount);
  }
  return { ...item, discount_amount: lineDiscount, discount_type: "VND" };
});
```

Three concrete failure modes:

1. **Cashier enters 5.000d item discount in popup, then applies ORDER_DISCOUNT promo.** The 5.000d is silently replaced by the prorated promo amount. Cashier data loss.
2. **Cashier enters 5.000d item discount in popup, then applies PRODUCT_DISCOUNT promo on the same variant.** The 5.000d is silently replaced by the promo discount. Cashier data loss.
3. **Cashier enters manual Order Discount in the checkout modal.** Same as case 1 - the order-level manual discount is prorated into every `line_discount`, double-stored in both `order.discount_amount` AND `order_line.line_discount`.

### A.3 Root Cause #2 - Reports ignore Order-Level discount (report-utils.ts, sales/page.tsx, actions/reports.ts)

`computeLineRevenue` (lib/report-utils.ts:7-60) only subtracts `line_discount`:

```ts
const variantRaw = qty * price;
let remainingDiscount = lineDiscount; // only line-level
// ... variantRevenue = variantRaw - remainingDiscount
```

Sales page (`sales/page.tsx:76-81`, `151-159`, `191-197`) and P&L action (`reports.ts:213-218`) both call `computeLineRevenue` without any order-level input. So when an order has `discount_amount = 50.000` but `line_discount = 0` on every line (which is exactly what the **fixed** POS will produce), the Reports will report the **full subtotal as revenue**, ignoring the 50.000d discount. Conversely, while the bug in A.2 is still live, the proration lets Reports accidentally compute the right number **only for the order-level discount path** - masking the underlying inconsistency.

### A.4 Submit/Update Actions Are Already Correct

`app/actions/pos.ts:107-110` and `app/actions/order-edit.ts:103-106` persist `item.discount_amount` straight into `Order_Lines.line_discount` without transformation. Neither action has the proration bug; they only store what POS sends. **No change required to these two files.**

`OrderEditModal.tsx` already treats Order-Level and Item-Level as separate fields (`orderDiscount` vs `item.discount_amount`) and submits them independently (lines 87-88, 226-249). **No change required.**

`OrderTable.tsx` and `OrderDetailModal.tsx` use `line.line_discount` and `order.discount_amount` for **display only** - they render both fields as separate rows in the order summary without combining them. **No change required.**

### A.4.1 Out-of-Scope Consumers (Known Gap)

The assignment names four files. The dashboard at `app/admin/page.tsx:172` also calls `computeLineRevenue` for its best-seller widget, and is NOT in scope per the assignment. Because Task 2 makes `order_discount_ratio` optional with default 0, the dashboard continues to compile and run, but it will report slightly higher revenue than Sales/P&L for orders that have `discount_amount > 0`. This is a pre-existing inconsistency that this fix does NOT introduce. If the human wants the dashboard aligned, add it as a follow-up task outside this plan.

### A.5 Discount Source Matrix (Post-Fix Target)

| Cashier Action | UI Source | Writes to | Does NOT write to |
|---|---|---|---|
| Per-item discount in product popup | `itemDiscount` state, popup at `POSScreen.tsx:851-858` | `item.discount_amount` (cart) | `orderData.discount_amount` |
| Manual Order Discount in checkout modal | `userCustomDiscount` state | `orderData.discount_amount` | every `item.discount_amount` |
| Auto/Code `ORDER_DISCOUNT` promo | `appliedPromo` with type `ORDER_DISCOUNT` | `orderData.discount_amount` | every `item.discount_amount` |
| Auto/Code `PRODUCT_DISCOUNT` promo | `appliedPromo` with type `PRODUCT_DISCOUNT` | `item.discount_amount` of applicable items (additive) | `orderData.discount_amount` |

The fix is to make POS honour this matrix and to make Reports apply BOTH fields multiplicatively: `lineRevenue = (lineRaw - line_discount) * (1 - order_discount_ratio)`.

### A.6 Historical Data Risk

Existing rows in the `Orders` + `Order_Lines` sheets were written by the current buggy POS, so some orders have `line_discount` values that are prorated from the order-level discount. Once Reports apply `(1 - order_discount_ratio)` on top of those rows, the discount will be **double-applied** for those historical orders.

This plan does NOT migrate historical data. Task 1 (Pre-flight) asks the human to choose: (a) accept historical inaccuracy for orders already in the sheet, or (b) provide a migration script. The code-level fix is correct for all new orders either way.

---

## Part B: File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/report-utils.ts` | MODIFY | Add `order_discount_ratio` parameter to `computeLineRevenue`. Apply ratio to variant and modifier revenue. |
| `app/admin/reports/sales/page.tsx` | MODIFY | Compute `orderDiscountRatio` per order, pass into all 3 `computeLineRevenue` call sites. |
| `app/actions/reports.ts` | MODIFY | Compute `orderDiscountRatio` per order, pass into `computeLineRevenue` inside the `orderLines.forEach` loop. |
| `components/POSScreen.tsx` | MODIFY | Stop prorating order-level discount into `line_discount`. Stop overwriting cashier item discounts. Accumulate `PRODUCT_DISCOUNT` onto existing item discounts. |
| `app/actions/pos.ts` | NO CHANGE | Already persists `item.discount_amount` directly into `line_discount`. |
| `app/actions/order-edit.ts` | NO CHANGE | Already persists discounts correctly. |
| `app/admin/orders/OrderEditModal.tsx` | NO CHANGE | Already separates Order vs Item discounts. |

---

## Part C: Pre-flight Decision

### Task 1: Confirm historical-data policy with human operator

**Files:** none (decision only)

- [ ] **Step 1: Surface the trade-off to the human operator**

Read the current state of the `Orders` and `Order_Lines` sheets via dev server (`/admin/reports/sales`). Pick 3 completed orders that have a non-zero `discount_amount` and inspect their `Order_Lines.line_discount` values:

- If `line_discount > 0` AND `sum(line_discount) ≈ order.discount_amount` → those rows were written by the buggy proration. Reports will double-apply the discount after this fix ships.
- If `line_discount = 0` on every line → those rows were written before commit `4319f83` (the original proration commit). Reports will compute correctly after the fix.

- [ ] **Step 2: Pick a policy and document it inline in this plan**

Choose one and edit this section to record the choice:

> **Policy chosen:** provide-migration-script

If the human picks `provide-migration-script`, add a Task 8 to this plan that writes a one-off `scripts/zero-out-prorated-line-discounts.ts` script. The script's contract: for every completed order where `sum(Order_Lines.line_discount for that order) ≈ order.discount_amount`, zero out `line_discount` on those lines and leave `order.discount_amount` intact.

---

## Part D: Reports Layer (Lowest Risk - Do First)

This layer is a pure refactor of read-only aggregation. By landing Reports first, we ensure that the moment POS stops prorating, Reports will already be ready to consume the new data shape.

### Task 2: Extend `computeLineRevenue` signature

**Files:**
- Modify: `lib/report-utils.ts:1-60`

- [ ] **Step 1: Read the current file to confirm the starting state**

Run: `Read lib/report-utils.ts`
Expected: file is 60 lines, exports `LineRevenueResult` interface and `computeLineRevenue` function with 4-field input.

- [ ] **Step 2: Replace the file with the extended version**

Replace the entire contents of `lib/report-utils.ts` with:

```typescript
export interface LineRevenueResult {
  variantRevenue: number;
  modRevenues: { id: string; name: string; revenue: number; raw: number }[];
  lineTotal: number;
}

export interface ComputeLineRevenueInput {
  qty: number;
  unit_price: number;
  line_discount: number;
  modifiers_json: string;
  /**
   * Order-level discount ratio in [0, 1].
   * Computed by the caller as order.discount_amount / order.subtotal_amount.
   * Applied multiplicatively on top of the per-line revenue so an order-wide
   * discount reduces every line proportionally without corrupting line_discount.
   * Defaults to 0 when the caller does not supply it (e.g. legacy callers).
   */
  order_discount_ratio?: number;
}

export function computeLineRevenue(line: ComputeLineRevenueInput): LineRevenueResult {
  const qty = Number(line.qty || 0);
  const price = Number(line.unit_price || 0);
  const lineDiscount = Number(line.line_discount || 0);
  const orderDiscountRatio = Math.min(1, Math.max(0, Number(line.order_discount_ratio || 0)));

  const variantRaw = qty * price;
  let remainingDiscount = lineDiscount;

  // PRIORITY 1: Apply item-level discount to the base variant first
  let variantRevenue: number;
  if (remainingDiscount >= variantRaw) {
    variantRevenue = 0;
    remainingDiscount -= variantRaw;
  } else {
    variantRevenue = variantRaw - remainingDiscount;
    remainingDiscount = 0;
  }

  // PRIORITY 2: Apply remaining item-level discount to modifiers
  let mods: { id: string; name: string; price: number }[] = [];
  let modsRawTotal = 0;
  if (line.modifiers_json) {
    try {
      const parsed = JSON.parse(line.modifiers_json);
      if (Array.isArray(parsed)) {
        mods = parsed;
        mods.forEach((m: any) => { modsRawTotal += Number(m.price || 0) * qty; });
      }
    } catch {}
  }

  const modRevenues = mods.map((mod: any) => {
    const modRaw = Number(mod.price || 0) * qty;
    const modRatio = modsRawTotal > 0 ? modRaw / modsRawTotal : 0;
    const itemLevelModDiscount = remainingDiscount * modRatio;
    const modRevenueAfterLineDiscount = Math.max(0, modRaw - itemLevelModDiscount);
    // Apply order-level discount multiplicatively on top of the line-level result
    const modRevenue = modRevenueAfterLineDiscount * (1 - orderDiscountRatio);

    return {
      id: mod.id || mod.name || "",
      name: mod.name || "",
      revenue: modRevenue,
      raw: modRaw,
    };
  });

  // Apply order-level discount multiplicatively on top of variant revenue
  variantRevenue = variantRevenue * (1 - orderDiscountRatio);

  const lineTotal = variantRevenue + modRevenues.reduce((s, m) => s + m.revenue, 0);
  return { variantRevenue, modRevenues, lineTotal };
}
```

Key changes vs original:
1. Adds optional `order_discount_ratio` field on the input.
2. Clamps the ratio to `[0, 1]` to defend against bad data (subtotal = 0, discount > subtotal, negative discount).
3. Multiplies `variantRevenue` by `(1 - ratio)` after item-level discount has been applied.
4. Same multiplicative factor on each modifier revenue.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: `Found 0 errors`. The new field is optional, so all existing callers still type-check.

- [ ] **Step 4: Commit**

```bash
rtk git add lib/report-utils.ts
rtk git commit -m "feat(reports): add order_discount_ratio to computeLineRevenue

Order-level discount is now applied multiplicatively on top of the
per-line revenue. Ratio is clamped to [0,1] so bad historical data
(subtotal=0, discount>subtotal) cannot produce negative revenue."
```

---

### Task 3: Sales report computes and passes `orderDiscountRatio`

**Files:**
- Modify: `app/admin/reports/sales/page.tsx:64-203`

The Sales page calls `computeLineRevenue` three times inside the `orderLines.forEach` (once at line 76 for product/aggregation, once at line 152 for KPI totals, once at line 191 for chart bucketing). Each call needs the `order_discount_ratio` derived from the parent order of the line.

- [ ] **Step 1: Build an order-id → ratio lookup before the loop**

Locate the block right after `completedOrders` is computed (`sales/page.tsx:40-48`). Insert a new lookup map right after that block (before `const validLines: any[] = []` at line 52):

```typescript
// Pre-compute order-level discount ratio for each completed order.
// Orders with no subtotal get ratio 0 (defensive - new orders always have subtotal).
const orderDiscountRatioById: Record<string, number> = {};
completedOrders.forEach((o: any) => {
  const subtotal = Number(o.subtotal_amount || 0);
  const orderDiscount = Number(o.discount_amount || 0);
  orderDiscountRatioById[o.id] = subtotal > 0 ? Math.min(1, orderDiscount / subtotal) : 0;
});
```

- [ ] **Step 2: Update the first call site (product aggregation, lines 76-81)**

Replace the `computeLineRevenue({...})` call inside `orderLines.forEach` at line 76 with:

```typescript
const lineRevenue = computeLineRevenue({
  qty,
  unit_price: Number(line.unit_price || 0),
  line_discount: Number(line.line_discount || 0),
  modifiers_json: line.modifiers_json || "",
  order_discount_ratio: orderDiscountRatioById[order.id] || 0,
});
```

- [ ] **Step 3: Update the second call site (KPI totals, lines 152-157)**

Replace the `computeLineRevenue({...})` call inside the `validLines.forEach` at line 151 with:

```typescript
const lineRevenue = computeLineRevenue({
  qty: Number(line.qty || 0),
  unit_price: Number(line.unit_price || 0),
  line_discount: Number(line.line_discount || 0),
  modifiers_json: line.modifiers_json || "",
  order_discount_ratio: orderDiscountRatioById[line.order_id] || 0,
});
```

- [ ] **Step 4: Update the third call site (chart bucketing, lines 191-196)**

Replace the `computeLineRevenue({...})` call inside the chart-bucketing `validLines.forEach` at line 185 with:

```typescript
const lineRevenue = computeLineRevenue({
  qty: Number(line.qty || 0),
  unit_price: Number(line.unit_price || 0),
  line_discount: Number(line.line_discount || 0),
  modifiers_json: line.modifiers_json || "",
  order_discount_ratio: orderDiscountRatioById[line.order_id] || 0,
});
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 6: Verify lint passes**

Run: `npx next lint --file app/admin/reports/sales/page.tsx`
Expected: no errors related to the changed file.

- [ ] **Step 7: Smoke test the Sales report**

Start dev server: `npx next dev`
Open `http://localhost:3000/admin/reports/sales`.
Expected: page renders, total revenue matches the KPI computed previously for orders that have `discount_amount = 0`. For orders that have `discount_amount > 0`, total revenue should be **lower** than before (because the order-level discount is now subtracted).

- [ ] **Step 8: Commit**

```bash
rtk git add app/admin/reports/sales/page.tsx
rtk git commit -m "feat(sales-report): apply order-level discount via order_discount_ratio"
```

---

### Task 4: P&L action computes and passes `orderDiscountRatio`

**Files:**
- Modify: `app/actions/reports.ts:155-271`

`getPnLData` already has a `completedOrders` array and a `validOrderIds` Set. The `orderLines.forEach` (line 187) finds the parent order per line via `completedOrders.find((o:any) => o.id === line.order_id)` (line 222). The most efficient change is to pre-compute a ratio lookup map once, mirroring the Sales page approach.

- [ ] **Step 1: Build the ratio lookup after `validOrderIds` is computed**

Locate `app/actions/reports.ts:156` (`const validOrderIds = new Set(completedOrders.map((o:any) => o.id));`). Insert immediately after that line:

```typescript
// Pre-compute order-level discount ratio for each completed order.
const orderDiscountRatioById: Record<string, number> = {};
completedOrders.forEach((o: any) => {
  const subtotal = Number(o.subtotal_amount || 0);
  const orderDiscount = Number(o.discount_amount || 0);
  orderDiscountRatioById[o.id] = subtotal > 0 ? Math.min(1, orderDiscount / subtotal) : 0;
});
```

- [ ] **Step 2: Update the `computeLineRevenue` call inside `orderLines.forEach`**

Locate `app/actions/reports.ts:213-218`. Replace the call with:

```typescript
const lineRevenue = computeLineRevenue({
  qty,
  unit_price: Number(line.unit_price || 0),
  line_discount: Number(line.line_discount || 0),
  modifiers_json: line.modifiers_json || "",
  order_discount_ratio: orderDiscountRatioById[line.order_id] || 0,
});
```

Note: `line.order_id` is available because we are iterating over `orderLines` (which carries the FK).

- [ ] **Step 3: Verify the existing `order` lookup at line 222 is still needed**

The `const order = completedOrders.find(...)` line at 222 is used to fetch `order.created_at` for the MAC lookup. **Keep it as-is** - removing it is out of scope for this fix.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 5: Smoke test the P&L report**

Start dev server: `npx next dev`
Open `http://localhost:3000/admin/reports/pnl`.
Expected: `totalRevenue` decreases for any date range that contains discounted orders. `grossProfit = totalRevenue - totalCOGS` decreases accordingly. COGS values are unchanged (discounts do not affect COGS).

- [ ] **Step 6: Commit**

```bash
rtk git add app/actions/reports.ts
rtk git commit -m "feat(pnl-action): apply order-level discount via order_discount_ratio"
```

---

## Part E: POS Layer (Higher Risk - Do After Reports)

### Task 5: Remove Order-Level proration from `handleConfirmCheckout`

**Files:**
- Modify: `components/POSScreen.tsx:407-498`

The fix has two coupled parts:
1. **Stop touching `item.discount_amount`** when the active discount is Order-Level. The cart's existing `item.discount_amount` (cashier popup entry) survives untouched.
2. **Zero out `orderData.discount_amount`** when the active discount is purely Item-Level (`PRODUCT_DISCOUNT` promo with no manual override and no `ORDER_DISCOUNT` promo). Otherwise Reports will double-apply: once via `line.line_discount` (the per-item promo) AND once via `order_discount_ratio = order.discount_amount / subtotal` (the same promo total).

- [ ] **Step 1: Read the current `handleConfirmCheckout` block**

Run: `Read components/POSScreen.tsx` lines 407-516.
Confirm the structure matches the audit (a single `finalCart = cart.map(...)` block with two if-branches inside, followed by an `orderData` object literal).

- [ ] **Step 2: Replace the `finalCart` construction with an Order-Level-safe version**

Locate `components/POSScreen.tsx:435-485`. Replace the entire `finalCart = cart.map(...)` block with:

```typescript
// Item-Level discounts only:
//   - Cashier-entered per-item discount from the product popup (preserved verbatim)
//   - PRODUCT_DISCOUNT promo (added on top, capped at itemBaseTotal)
// Order-Level discounts (manual modal entry or ORDER_DISCOUNT promo) live ONLY in
// orderData.discount_amount and must NOT be prorated into line_discount.
const isOrderLevelDiscountActive =
  userCustomDiscount !== null || (appliedPromo?.type === "ORDER_DISCOUNT");

const finalCart = cart.map(item => {
  const modsPrice = item.modifiers.reduce((sum: number, m: any) => sum + Number(m.price), 0);
  const itemBaseTotal = (item.unit_price + modsPrice) * item.qty;

  // Start from the cashier-entered item discount (already in VND in cart state)
  let lineDiscount = Number(item.discount_amount || 0);

  if (!isOrderLevelDiscountActive && appliedPromo?.type === "PRODUCT_DISCOUNT") {
    // Accumulate the promo discount on top of the cashier discount
    let applicableVariantsMap: Record<string, number> = {};
    let applicableVariantsList: string[] = [];
    let isMap = false;
    try {
      if (appliedPromo.applicable_products_json) {
        const parsed = JSON.parse(appliedPromo.applicable_products_json);
        if (Array.isArray(parsed)) {
          applicableVariantsList = parsed;
        } else if (parsed && typeof parsed === "object") {
          applicableVariantsMap = parsed;
          applicableVariantsList = Object.keys(parsed);
          isMap = true;
        }
      }
    } catch (e) {}

    if (applicableVariantsList.includes(item.variant_id)) {
      const val = isMap
        ? Number(applicableVariantsMap[item.variant_id])
        : Number(appliedPromo.discount_value);
      let promoItemDiscount = 0;
      if (appliedPromo.discount_type === "PERCENT") {
        promoItemDiscount = itemBaseTotal * (val / 100);
      } else if (appliedPromo.discount_type === "FLAT_PRICE") {
        const unitDiscount = Math.max(0, item.unit_price - val);
        promoItemDiscount = unitDiscount * item.qty;
      } else {
        promoItemDiscount = val * item.qty;
      }
      // Cap the combined discount at the item's base total so revenue never goes negative
      lineDiscount = Math.min(itemBaseTotal, lineDiscount + promoItemDiscount);
    }
  }

  return {
    ...item,
    discount_amount: lineDiscount,
    discount_type: "VND",
  };
});
```

Behavioural contract of the new block:

| Scenario | `item.discount_amount` source |
|---|---|
| No promo, no cashier item discount | 0 |
| Cashier item discount only | unchanged from popup |
| `ORDER_DISCOUNT` promo only | unchanged from popup (0 if cashier didn't enter one) |
| `PRODUCT_DISCOUNT` promo only | cashier discount + promo discount, capped at base total |
| Manual Order Discount (modal) | unchanged from popup (Order-Level goes to `orderData.discount_amount`) |
| Cashier item discount + Manual Order Discount | cashier discount preserved; Order-Level preserved separately |

- [ ] **Step 3: Update `finalDiscountAmountInVND` so PRODUCT_DISCOUNT-only orders do NOT double-store**

Locate `components/POSScreen.tsx:411-429` (the `finalDiscountAmountInVND` initialization block). Replace the entire `let finalDiscountAmountInVND = 0; if/else if/else` chain with:

```typescript
let finalDiscountAmountInVND = 0;
if (userCustomDiscount !== null) {
  // Manual Order Discount from the checkout modal - Order-Level only
  if (userCustomDiscountType === "PERCENT") {
    finalDiscountAmountInVND = subtotal * (userCustomDiscount / 100);
  } else {
    finalDiscountAmountInVND = userCustomDiscount;
  }
} else if (appliedPromo?.type === "ORDER_DISCOUNT") {
  // ORDER_DISCOUNT promo - Order-Level only
  if (appliedPromo.discount_type === "PERCENT") {
    finalDiscountAmountInVND = subtotal * (Number(appliedPromo.discount_value) / 100);
  } else {
    finalDiscountAmountInVND = Number(appliedPromo.discount_value);
  }
}
// PRODUCT_DISCOUNT promo case: finalDiscountAmountInVND stays 0.
// The promo saving is captured in Order_Lines.line_discount via finalCart above;
// writing it again to order.discount_amount would cause Reports to double-apply
// (once via line.line_discount, once via order_discount_ratio).
```

The downstream `orderData.discount_amount: finalDiscountAmountInVND` (line 492) is unchanged - it now receives 0 for PRODUCT_DISCOUNT-only orders, which is exactly what we want.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: `Found 0 errors`.

- [ ] **Step 6: Smoke test the five POS discount scenarios**

Start dev server: `npx next dev`. Sign in as cashier. For each scenario below, place an order and then verify the persisted values in `Orders` and `Order_Lines` sheets.

**Scenario A - Cashier item discount only:**
1. Add "Trà sữa S Size" (35.000d) to cart.
2. In product popup, set per-item discount = 5.000d. Add to cart.
3. Checkout without any promo or order discount.
4. Expected DB state:
   - `Orders.discount_amount = 0`
   - `Order_Lines.line_discount = 5000` for that line.

**Scenario B - Manual Order Discount only:**
1. Add "Trà sữa S Size" (35.000d) to cart.
2. Open checkout modal, enter Order Discount = 10.000d.
3. Pay.
4. Expected DB state:
   - `Orders.discount_amount = 10000`
   - `Order_Lines.line_discount = 0` (no proration).

**Scenario C - Cashier item discount + Manual Order Discount:**
1. Add "Trà sữa S Size" (35.000d) with 5.000d popup discount.
2. Open checkout modal, enter Order Discount = 10.000d.
3. Pay.
4. Expected DB state:
   - `Orders.discount_amount = 10000`
   - `Order_Lines.line_discount = 5000` (cashier discount preserved).

**Scenario D - `ORDER_DISCOUNT` promo applied:**
1. Configure an `ORDER_DISCOUNT` promo (e.g. 10% off, min_order_value 30.000d) via `/admin/promotions`.
2. Add "Trà sữa S Size" (35.000d) to cart.
3. Confirm promo is auto-applied (or enter its code).
4. Pay.
5. Expected DB state:
   - `Orders.discount_amount = 3500` (10% of 35.000d)
   - `Order_Lines.line_discount = 0` (no proration).

**Scenario E - `PRODUCT_DISCOUNT` promo applied:**
1. Configure a `PRODUCT_DISCOUNT` promo: 5.000d off the trà sữa variant.
2. Add "Trà sữa S Size" (35.000d) to cart.
3. Confirm promo is auto-applied.
4. Pay.
5. Expected DB state:
   - `Orders.discount_amount = 0` (Item-Level only - no double-store)
   - `Order_Lines.line_discount = 5000` (per-item discount applied)
   - `Orders.applied_promotion_id` = the promo's id (audit trail preserved)

- [ ] **Step 7: Commit**

```bash
rtk git add components/POSScreen.tsx
rtk git commit -m "fix(pos): stop prorating order-level discount into line_discount

Order-Level discounts (manual modal entry, ORDER_DISCOUNT promo) now
live only in orderData.discount_amount. PRODUCT_DISCOUNT promos live
only in Order_Lines.line_discount (order.discount_amount is zeroed
for that case to prevent Reports from double-applying). Cashier-
entered per-item discounts in the product popup are preserved
verbatim. PRODUCT_DISCOUNT promos accumulate on top of any existing
cashier item discount, capped at the item's base total."
```

---

### Task 6: Verify cross-layer revenue reconciliation

**Files:** none (manual reconciliation only)

- [ ] **Step 1: Pick a recent discounted order from the DB**

After Task 5 ships, place one order that has BOTH a 5.000d cashier item discount AND a 10.000d manual order discount on a 50.000d item.

Expected persisted values:
- `Orders.subtotal_amount = 50000`
- `Orders.discount_amount = 10000`
- `Order_Lines.line_discount = 5000`

- [ ] **Step 2: Compute the expected revenue by hand**

```
variantRaw = 1 * 50000 = 50000
lineDiscount = 5000
variantRevenueAfterLine = 50000 - 5000 = 45000
orderDiscountRatio = 10000 / 50000 = 0.2
finalVariantRevenue = 45000 * (1 - 0.2) = 36000
```

Expected reported revenue: **36.000d**.

- [ ] **Step 3: Verify the Sales report shows 36.000d for that order**

Open `/admin/reports/sales` with a filter that includes only the order from Step 1. The "Tổng Doanh Thu" KPI should be 36.000d.

- [ ] **Step 4: Verify the P&L report shows 36.000d for that order**

Open `/admin/reports/pnl` with the same filter. The "Tổng Doanh Thu" card should be 36.000d.

- [ ] **Step 5: Verify the dashboard best-seller revenue matches**

Open `/admin` (dashboard). The best-seller table should attribute 36.000d of revenue to that product (not 45.000d, not 50.000d).

- [ ] **Step 6: Record the reconciliation result**

Append a note to this plan in the format:

> **Reconciliation:** order `<order_id>` - persisted (subtotal=50000, order_discount=10000, line_discount=5000) - reported revenue: Sales=36000, P&L=36000, Dashboard=36000. PASS.

---

## Part F: Rollback Notes

### Task 7: Document rollback procedure (no code action)

**Files:** none (documentation only)

- [ ] **Step 1: Note the commits to revert if rollback is required**

If the fix ships and an unexpected revenue discrepancy appears, the safe rollback order is:

1. `git revert <commit-hash-of-Task-5>` - restores POS proration (so new orders get prorated `line_discount` again).
2. `git revert <commit-hash-of-Task-4>` - restores P&L action to ignore `order_discount_ratio`.
3. `git revert <commit-hash-of-Task-3>` - restores Sales page to ignore `order_discount_ratio`.
4. `git revert <commit-hash-of-Task-2>` - restores `computeLineRevenue` to its pre-ratio signature.

Do NOT revert Task 5 alone without also reverting Tasks 2-4. If POS writes only to `order.discount_amount` but Reports ignore that field, every discounted order will be reported at its full subtotal - a much worse failure mode than the current double-counting.

- [ ] **Step 2: Confirm the rollback order is captured in the commit message of Task 5**

Edit the Task 5 commit message body (before pushing) to include:

```
ROLLBACK: revert this commit AND the three Reports commits (Tasks 2-4)
together. Reverting this commit alone causes Reports to ignore the
order-level discount entirely.
```

---

## Part G: Self-Review Checklist

- [ ] **Spec coverage:** Assignment Part 1 (POS) → Task 5. Assignment Part 2 (Reports: `computeLineRevenue` + Sales + P&L) → Tasks 2, 3, 4.
- [ ] **Type consistency:** `order_discount_ratio` parameter name matches across `lib/report-utils.ts` (Task 2), `sales/page.tsx` (Task 3), `actions/reports.ts` (Task 4). Lookup map `orderDiscountRatioById` matches in Sales page (Task 3) and P&L action (Task 4).
- [ ] **No placeholder steps:** every step contains a concrete code block or shell command with expected output.
- [ ] **Edge cases handled:** `subtotal = 0` (ratio defaults to 0), `discount > subtotal` (ratio clamped to 1), `discount = 0` (ratio = 0, multiplicative no-op), `PRODUCT_DISCOUNT + cashier discount combined` (capped at base total).
- [ ] **Unchanged files explicitly listed:** `pos.ts`, `order-edit.ts`, `OrderEditModal.tsx` - so the engineer does not "improve" them while in the area.
