# Orders & Revenue Reports — Master Rebuild Plan and Architecture Spec

> **For Antigravity (implementer):** This is an architecture SPEC, not a bite-sized task plan. Read it end-to-end, then produce a sequenced implementation plan under `docs/superpowers/plans/2026-06-18-orders-reports-rebuild.md` using the `superpowers:writing-plans` skill. Each workstream (WS-1 through WS-6) is a candidate sub-plan. Do not start coding until your plan is approved.

**Goal:** Rebuild the Orders module and all Revenue Reports from scratch as a financially sound, auditable, deterministic system. Eliminate the discount double-counting bug class, the destroy-recreate edit flow, and the recompute-on-read report pattern.

**Sponsor decision (2026-06-18):** Stop patching E.1/E.5. The compounded technical debt in `app/actions/order-edit.ts`, `app/actions/pos.ts`, `lib/report-utils.ts`, and the underlying sheet schema is too risky for a financial system. Three prior audit cycles (2026-06-10, 2026-06-15, 2026-06-15-deep) fixed surface symptoms without addressing the conceptual model error. We rebuild.

**Tech stack:** Next.js 14, TypeScript 5, Google Sheets via `lib/sheets_db.ts`. No database migration in scope.

---

## 1. Executive Summary

The current Orders + Reports system has one root cause: **discounts are stored as derivations to be re-applied at read time, rather than as facts pinned at write time.** Every other bug — double counting, revenue drift after migration scripts, fragile edits — is a symptom.

The rebuild enforces four inviolable principles:

1. **`net_total` is the single source of truth.** What the customer paid is authoritative. Every other money field is decomposition context, never a transformation rule.
2. **Snapshot everything at write time.** Prices, modifiers, recipes, COGS, promo rules — all copied into the order at the moment of confirmation. Reports never join back to live product/promo/recipe tables.
3. **Money fields are immutable post-confirmation.** Edits produce a new version (supersede-and-replace), not an in-place mutation. The old version stays for audit.
4. **One pure function computes revenue.** No flag-based branching, no multiplicative-on-additive stacking. Allocation across products is the only computation, and it's deterministic.

Section 2 audits the current system. Section 3 explains why prior fixes failed. Sections 4-6 define the target architecture, data models, and math. Sections 7-8 cover migration and workstreams. Sections 9-11 cover testing, risks, and out-of-scope.

---

## 2. Audit Findings (Current State)

### 2.1 Discount model is fragmented across five overlapping fields

| Field | Lives on | Intended meaning | Actual usage |
|---|---|---|---|
| `order.discount_amount` | Orders | Order-level discount (manual OR ORDER_DISCOUNT promo) | Sometimes the manual discount, sometimes the promo, sometimes zeroed by a recovery script |
| `line.line_discount` | Order_Lines | System promo portion | Originally the same value as `order.discount_amount` (double-counted); after recovery scripts, now holds promo OR manual depending on order age |
| `line.line_manual_discount` | Order_Lines | Manual cashier portion | Added in E.1 fix, only populated on orders edited after 2026-06-17 |
| `line.discount_amount` | Order_Lines (legacy) | Original manual discount | Still written for "backward compat" in `OrderEditModal.tsx:258`, conflicts with the two fields above |
| `applied_promotion_snapshot_json` | Orders | Full promo context for audit | Wiped to empty string when cashier enters a manual order discount in POS (`POSScreen.tsx:442-452`, prior plan's Task 9) |

**Consequence:** A report reading a historical order cannot know which combination of meanings applies. Heuristics are required. Heuristics are wrong sometimes. Wrong means financial drift.

### 2.2 Report math compounds discounts (`lib/report-utils.ts:22-75`)

`computeLineRevenue` applies `line_discount` additively (subtract from raw, floor at 0) AND `order_discount_ratio` multiplicatively (`* (1 - ratio)`). When both exist on the same line, the customer-paid amount is impossible to recover. The Sữa Dâu revenue drift (1.820.526đ → 1.906.257đ) traced to this: a recovery script zeroed `order.discount_amount` to dodge the multiplicative term, which changed the math.

Additional smell: the variant vs modifier allocation strategies differ (lines 33-39 fully exhaust discount on variant first; lines 54-58 distribute remainder proportionally across modifiers). Two paths, no documented reason.

### 2.3 Edit flow is destructive and non-transactional (`app/actions/order-edit.ts`)

The current `editOrder` performs four separate sheet writes in sequence:

1. `insertMany("Order_Lines", orderLinesToInsert)` — line 180
2. `insertMany("Stock_Ledger", stockLedgersToInsert)` — line 183
3. `update("Orders", orderId, {...})` — line 187
4. `removeMany("Order_Lines", oldLineIds)` — line 200
5. `removeMany("Stock_Ledger", oldStockIds)` — line 210

If any call fails midway, the database is left with duplicate lines, orphan stock entries, or an order whose total doesn't match its lines. There is no compensation, no transaction, no audit log of what happened.

Other defects in this file:
- **ID generation is racy:** `OL-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}` (line 97). Two concurrent edits within the same millisecond can collide on `Math.random()` returning the same value (range is only 0-999).
- **COGS is recomputed at edit time** via `getIngredientUnitCost` (lines 18-30) using LIFO over `PO_RECEIPT` ledger entries filtered by `created_at <= orderCreatedAt`. A new PO arriving between original sale and edit changes the reported COGS retroactively.
- **Recipe lookup uses `findRecipeAtTime`** (good intent) but COGS does not (inconsistent time-pinning).
- **Hardcoded `discount_type: "VND"` at line 191** — percent discounts are silently coerced.
- **Old lines and stock entries are deleted, not reversed.** No history of what the order looked like before the edit.

### 2.4 POS write path leaks promo context (`components/POSScreen.tsx:416-529`)

`handleConfirmCheckout` builds `finalCart` with a `promo_discount` field (line 495) that is never persisted by `submitOrder` (the field doesn't exist in the Order_Lines schema). The promo breakdown is computed, displayed, then thrown away on save. Reports can't see it.

Additionally, the interaction model conflates three discounts into one cashier flow:
- Per-item manual discount (entered in product modal, line 864-872)
- Per-order manual discount (entered in checkout modal, line 957-969)
- System promotion (auto-applied or code-applied)

The cashier cannot visually distinguish them, and the data model blurs them together. The E.5 plan was attempting to fix this UI issue; we supersede it.

### 2.5 Schema is fluid, no migrations

Google Sheets has no schema enforcement. New columns (`line_manual_discount`, `applied_promotion_snapshot_json`, `discount_reason`) were added ad-hoc over multiple audit cycles. Old rows have empty values for these columns. Every read site uses `Number(x || 0)` defensively, masking the inconsistency. There is no record of when each column was added or what version of the code produced what shape of row.

### 2.6 Reports recompute revenue from raw inputs

`getPnLData` (in `app/actions/reports.ts`) reads `Orders` + `Order_Lines`, calls `computeLineRevenue` for each line, and sums. Because `computeLineRevenue` is non-deterministic across schema versions (different fields populated for different order ages), the same order can produce different revenue numbers after a code change that doesn't touch the data. A financial report that changes output when no data changed is broken by definition.

### 2.7 No order versioning, no audit trail

There is no `Order_Events` or `Order_Versions` sheet. When an order is edited, the original state is lost. When an order is deleted (`deleteOrder` in `app/actions/orders.ts:70-91`), it's gone — body, lines, and stock ledger entries all `removeMany`'d. Financial systems require append-only history.

### 2.8 Prior fixes that became technical debt

| Script / change | What it did | What it broke |
|---|---|---|
| `recover-product-discount.ts` | Set `line.line_discount` from promo formula on orders missing it | Didn't touch `order.discount_amount` → still double-counted in reports |
| `zero-out-prorated-line-discounts.ts` | Zeroed `line.line_discount` on non-applicable variants | Did not redistribute → cashier intent lost |
| `fix-historical-discounts.ts` | Prorated `order.discount_amount` onto lines | Created the line_discount + order_discount_ratio multiplicative stacking |
| E.1 (in progress, stopped) | Added `line_manual_discount` column | Improves separation but does not fix report math or edit destructiveness |

Each script treated a symptom. The 2026-06-15-deep plan acknowledged this ("the fix is in POS write-path + historical data") but still scoped the fix as a script, not a schema rebuild.

---

## 3. Why Prior Attempts Failed

Three recurring patterns:

**P1 — Schema patches instead of schema redesign.** Every prior cycle added a column (`line_discount`, then `line_manual_discount`, then `applied_promotion_snapshot_json`) to disambiguate discounts. Each addition helped new orders but did nothing for historical orders, creating a two-tier dataset that reports must special-case.

**P2 — Read-time fixes instead of write-time discipline.** `computeLineRevenue` has been edited multiple times to handle edge cases. Each edit changes the revenue number for existing orders without changing the data. Stakeholders lose trust.

**P3 — Migration scripts instead of cutover.** Scripts that mutate production data are risky, hard to review, and don't prevent future bad data. The POS keeps producing the same shape of broken orders; the scripts keep fixing yesterday's orders.

**The rebuild breaks all three patterns:** new schema (P1), authoritative stored values (P2), cutover with legacy frozen (P3).

---

## 4. Target Architecture

### 4.1 Architectural principles

| # | Principle | Enforcement |
|---|---|---|
| AP-1 | `net_total` is the source of truth for what was paid | All reports sum `net_total`. No alternative computation path. |
| AP-2 | Snapshot all reference data at order confirmation | Order row contains JSON snapshots for product, variant, modifiers, promo, recipe |
| AP-3 | Money fields are immutable once `status = COMPLETED` | Edits produce a new order version via supersede-and-replace |
| AP-4 | One pure function for per-product revenue allocation | `allocateLineRevenue(line)` — no flags, no branching on `discount_type` |
| AP-5 | Every mutation writes to `Order_Events` audit log | Action wrappers refuse to write without an event record |
| AP-6 | Invariants asserted at write time, trusted at read time | `assertOrderInvariants(order, lines)` called before any write |
| AP-7 | Stock ledger is append-only | Edits write `EDIT_REVERSAL` rows, never delete |

### 4.2 High-level component map

```
POSScreen (UI)
   |
   v
submitOrderV2 (server action) ----------,
   |                                    |
   v                                    v
Orders_V2  Order_Lines_V2  Order_Events  Stock_Ledger
   ^                                    ^
   |                                    |
   |  Reports (PnL, Sales, Stock) ------'
   |  - read Orders_V2 (latest version)
   |  - read Order_Lines_V2
   |  - apply allocateLineRevenue for per-product views
   |  - sum net_total for order-level totals
   |
   v
OrderEditModal (Admin UI)
   |
   v
editOrderV2 (server action) --- supersede + replace + reversal
```

### 4.3 New sheets

- `Orders_V2` — replaces `Orders`
- `Order_Lines_V2` — replaces `Order_Lines`
- `Order_Events` — NEW audit log

`Stock_Ledger` is reused with new transaction types and a new `order_event_id` column.

`Products`, `Product_Variants`, `Modifiers`, `Promotions`, `Recipes`, `Base_Ingredients` are NOT changed. They become reference data only; reports don't join to them.

---

## 5. Strict Data Models

All money fields are integer đồng. All IDs are `crypto.randomUUID()` (or prefixed ULID if human-readability matters). All timestamps are ISO 8601 UTC.

### 5.1 `Orders_V2`

| Column | Type | Mutable after COMPLETED? | Notes |
|---|---|---|---|
| `id` | string (uuid) | no | Primary key |
| `order_no` | string | no | Human-readable, e.g. `UCK000123` |
| `brand_id` | string | no | FK to Brands |
| `status` | enum: `DRAFT`, `COMPLETED`, `SUPERSEDED`, `VOIDED` | yes (status transitions only) | See state machine §5.5 |
| `version` | integer | no | Starts at 1; new version = +1 |
| `parent_order_id` | string (uuid) \| empty | no | Set on supersede-and-replace; roots form a chain |
| `superseded_by` | string (uuid) \| empty | yes (set once on supersede) | Links to the newest version |
| `created_at`, `created_by_id`, `created_by_name` | ISO string, string, string | no | Audit |
| `completed_at` | ISO string \| empty | no | Set when status → COMPLETED |
| `voided_at`, `voided_by_id`, `void_reason` | ISO string \| empty, string \| empty, string \| empty | no (set once) | Set when status → VOIDED |
| `currency` | string | no | Always `VND` in scope |
| **Money fields** | | | |
| `gross_total` | integer | no | Sum of `gross_line_total` across lines |
| `promo_discount_total` | integer | no | Sum of `promo_discount` across lines |
| `manual_item_discount_total` | integer | no | Sum of `manual_item_discount` across lines |
| `manual_order_discount` | integer | no | Order-level cashier discount (single value, not per-line) |
| `net_total` | integer | no | What customer paid. Equals gross − promo − manual_item − manual_order |
| **Snapshots** | | | |
| `applied_promotion_id` | string \| empty | no | FK to Promotions (kept for filtering) |
| `applied_promotion_snapshot_json` | string (JSON) \| empty | no | Full promo row at order time |
| `pos_snapshot_json` | string (JSON) | no | Full cart state at confirmation, for replay/debug |
| `payment_method` | enum: `CASH`, `BANK_TRANSFER` | no | |
| `payment_ref` | string \| empty | no | Bank transfer txn id, etc. |
| **Migration metadata** | | | |
| `migration_notes` | string \| empty | no | Populated only for migrated historical orders |

### 5.2 `Order_Lines_V2`

| Column | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key |
| `order_id` | string (uuid) | FK to Orders_V2 |
| `line_no` | integer | 1-based sequence within order, stable |
| `product_id` | string | FK for filtering; snapshot has the truth |
| `product_snapshot_json` | string (JSON) | `{ id, name, category_id, category_name }` at sale time |
| `variant_id` | string | FK |
| `variant_snapshot_json` | string (JSON) | `{ id, size_name, price }` at sale time |
| `qty` | integer | ≥ 1 |
| `unit_price` | integer | Snapshotted from variant |
| `modifiers_snapshot_json` | string (JSON) | Array of `{ id, name, price, qty }` at sale time |
| **Money fields** | | |
| `gross_line_total` | integer | `(unit_price + sum(modifier.price × modifier.qty)) × line.qty` |
| `promo_discount` | integer | Per-line system promo, computed from promo formula at write time |
| `manual_item_discount` | integer | Per-line cashier discount (VND amount, computed from input) |
| `order_discount_allocation` | integer | This line's share of `order.manual_order_discount`, allocated proportionally |
| `net_line_total` | integer | `gross_line_total − promo_discount − manual_item_discount − order_discount_allocation` |
| **Cost & stock** | | |
| `cost_at_sale` | integer | Total COGS for this line, pinned at order confirmation |
| `recipe_snapshot_json` | string (JSON) | Full recipe used for stock deduction |
| **Discount attribution** | | |
| `promo_discount_reason` | string \| empty | e.g. `PRM-003` |
| `manual_discount_reason` | string \| empty | e.g. `CASHIER_OVERRIDE`, `COMPLIMENTARY` |

### 5.3 `Order_Events` (NEW)

| Column | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key |
| `order_id` | string (uuid) | The order this event applies to (post-supersede, the new order id) |
| `event_type` | enum: `CREATED`, `EDITED`, `VOIDED`, `REOPENED`, `MIGRATED` | |
| `event_at` | ISO string | |
| `actor_id`, `actor_name` | string, string | User who triggered |
| `from_version`, `to_version` | integer, integer | For EDITED: previous and new version numbers |
| `previous_order_id` | string (uuid) \| empty | For EDITED: the superseded order id |
| `delta_json` | string (JSON) | Summary of what changed: lines added/removed/modified, money deltas |
| `reason` | string | Required for EDITED, VOIDED |

### 5.4 `Stock_Ledger` (existing, new columns and transaction types)

New columns:
- `order_event_id` — FK to Order_Events, mandatory for SALES_CONSUME and EDIT_REVERSAL rows
- `unit_cost` (existing, keep)
- `cost_at_sale` — denormalized from order line for fast COGS reporting

New transaction types (additive; existing types preserved):
- `SALES_CONSUME` — existing, now must reference `order_event_id`
- `EDIT_REVERSAL` — negates a previous SALES_CONSUME when an order is edited; positive `quantity_change`
- `EDIT_CONSUME` — new SALES_CONSUME for the edited order version

`remove` and `removeMany` are forbidden on Stock_Ledger in the new architecture. Reversals only.

### 5.5 Order state machine

```
                  +----------+
                  |  DRAFT   |   (optional phase if we add cart persistence)
                  +----------+
                       |
                       v
            +-------------------+
            |     COMPLETED     |   <-- normal terminal state
            +-------------------+
                |           |
                |           | (admin edit)
                |           v
                |     +-----------+   edit produces new order
                |     |SUPERSEDED |   (original is marked superseded,
                |     +-----------+    new order is COMPLETED)
                |
                | (admin void)
                v
            +-----------+
            |  VOIDED   |   <-- terminal; reversed stock; net_total kept
            +-----------+     for audit but excluded from revenue reports
```

Reports read only orders where `status = COMPLETED` and `superseded_by IS NULL`. Superseded and voided orders are visible in admin tooling and audit logs.

---

## 6. The Math: Pure Functions

All functions live in `lib/order-math.ts`. No I/O, no schema lookups, no flags. Deterministic. Unit-tested with golden cases including the UCK000094 scenario.

### 6.1 Per-line allocation

```typescript
interface LineForAllocation {
  gross_line_total: number;
  promo_discount: number;
  manual_item_discount: number;
  order_discount_allocation: number;
  unit_price: number;
  qty: number;
  modifiers_snapshot: Array<{ id: string; price: number; qty: number }>;
}

interface AllocatedRevenue {
  variantRevenue: number;
  modifierRevenue: Record<string, number>; // keyed by modifier id
  lineRevenue: number;
}

/**
 * Allocates a line's net revenue back to its variant and modifiers
 * for per-product reporting. Pure. Deterministic.
 *
 * Invariant: lineRevenue === gross_line_total
 *              - promo_discount
 *              - manual_item_discount
 *              - order_discount_allocation
 */
export function allocateLineRevenue(line: LineForAllocation): AllocatedRevenue {
  const grossVariant = line.unit_price * line.qty;
  const grossModifiers = line.modifiers_snapshot.reduce(
    (sum, m) => sum + m.price * m.qty * line.qty,
    0,
  );
  const grossLine = grossVariant + grossModifiers;

  const totalDiscount =
    line.promo_discount + line.manual_item_discount + line.order_discount_allocation;

  // Allocation ratio: each component of the line loses the same proportion.
  // Edge case: if totalDiscount > grossLine (shouldn't happen, but defensive),
  // ratio floors at 0 — no negative revenue.
  const ratio = grossLine > 0 ? Math.max(0, 1 - totalDiscount / grossLine) : 0;

  const variantRevenue = Math.round(grossVariant * ratio);
  const modifierRevenue: Record<string, number> = {};
  for (const m of line.modifiers_snapshot) {
    modifierRevenue[m.id] = Math.round(m.price * m.qty * line.qty * ratio);
  }

  // Net line revenue is the stored value; allocation must sum back to it.
  const lineRevenue = grossLine - totalDiscount;

  return { variantRevenue, modifierRevenue, lineRevenue };
}
```

### 6.2 Invariant assertion

```typescript
export interface OrderV2Row { /* ...matches §5.1... */ }
export interface OrderLineV2Row { /* ...matches §5.2... */ }

export class InvariantError extends Error {}

export function assertOrderInvariants(order: OrderV2Row, lines: OrderLineV2Row[]): void {
  if (lines.length === 0) throw new InvariantError("order has no lines");

  const sumGross = lines.reduce((s, l) => s + l.gross_line_total, 0);
  const sumPromo = lines.reduce((s, l) => s + l.promo_discount, 0);
  const sumManualItem = lines.reduce((s, l) => s + l.manual_item_discount, 0);
  const sumOrderAlloc = lines.reduce((s, l) => s + l.order_discount_allocation, 0);
  const sumNet = lines.reduce((s, l) => s + l.net_line_total, 0);

  if (sumGross !== order.gross_total)
    throw new InvariantError(`gross mismatch: ${sumGross} vs ${order.gross_total}`);
  if (sumPromo !== order.promo_discount_total)
    throw new InvariantError(`promo mismatch: ${sumPromo} vs ${order.promo_discount_total}`);
  if (sumManualItem !== order.manual_item_discount_total)
    throw new InvariantError(`manual_item mismatch: ${sumManualItem} vs ${order.manual_item_discount_total}`);
  if (Math.abs(sumOrderAlloc - order.manual_order_discount) > 1)
    throw new InvariantError(`order_discount_allocation mismatch: ${sumOrderAlloc} vs ${order.manual_order_discount}`);
  if (Math.abs(sumNet - order.net_total) > 1)
    throw new InvariantError(`net_total mismatch: ${sumNet} vs ${order.net_total}`);

  // Per-line invariant
  for (const l of lines) {
    const expected = l.gross_line_total - l.promo_discount - l.manual_item_discount - l.order_discount_allocation;
    if (Math.abs(expected - l.net_line_total) > 1)
      throw new InvariantError(`line ${l.id} net mismatch: ${expected} vs ${l.net_line_total}`);
  }
}
```

### 6.3 Order-level discount allocation (at write time only)

This runs once when an order is confirmed or edited. Result is stored on the lines; never recomputed at read time.

```typescript
interface AllocatableLine {
  line_id: string;
  capacity: number; // gross_line_total - promo_discount - manual_item_discount
}

/**
 * Distributes `orderDiscount` across lines proportional to their capacity.
 * Caps each allocation at capacity. Residual (rounding or capacity cap)
 * is absorbed by the last eligible line.
 *
 * Returns Map<line_id, allocation>.
 */
export function allocateOrderDiscount(
  lines: AllocatableLine[],
  orderDiscount: number,
): Map<string, number> {
  const result = new Map<string, number>();
  lines.forEach(l => result.set(l.line_id, 0));

  const totalCapacity = lines.reduce((s, l) => s + l.capacity, 0);
  if (totalCapacity <= 0 || orderDiscount <= 0) return result;

  let remaining = Math.min(orderDiscount, totalCapacity);
  let allocated = 0;
  const eligible = lines.filter(l => l.capacity > 0);

  for (let i = 0; i < eligible.length; i++) {
    const l = eligible[i];
    if (i === eligible.length - 1) {
      // Last line absorbs residual to guarantee the sum equals orderDiscount
      const share = remaining - allocated;
      result.set(l.line_id, Math.min(share, l.capacity));
    } else {
      const share = Math.round((orderDiscount * l.capacity) / totalCapacity);
      const capped = Math.min(share, l.capacity);
      result.set(l.line_id, capped);
      allocated += capped;
    }
  }

  return result;
}
```

### 6.4 Reports use stored values only

```typescript
// Pseudo-reports; real implementation in app/actions/reports-v2.ts
export function computeTotalRevenue(orders: OrderV2Row[]): number {
  return orders.reduce((s, o) => s + o.net_total, 0);
}

export function computeRevenueByProduct(lines: OrderLineV2Row[]): Map<string, number> {
  const byProduct = new Map<string, number>();
  for (const l of lines) {
    byProduct.set(l.product_id, (byProduct.get(l.product_id) || 0) + l.net_line_total);
  }
  return byProduct;
}

export function computeCOGSByIngredient(lines: OrderLineV2Row[]): Map<string, number> {
  // cost_at_sale is stored per line; allocation back to ingredients uses
  // recipe_snapshot_json. This is the only non-trivial computation in reports,
  // and it operates on snapshotted data, not live recipes.
}
```

No `computeLineRevenue` re-application. No `order_discount_ratio` multiplier. No special cases for old vs new schema.

---

## 7. Migration Strategy

The rebuild is a cutover, not a script. Old sheets stay; new sheets take over; old sheets are eventually archived.

### 7.1 Phase plan

| Phase | Goal | Exit criteria |
|---|---|---|
| **P1: Schema** | Create Orders_V2, Order_Lines_V2, Order_Events sheets. Empty. | Sheets exist, headers validated by a script |
| **P2: Math + write path** | `lib/order-math.ts`, `submitOrderV2`, `editOrderV2`. Old code untouched. | Unit tests pass; new orders can be written via a hidden dev route |
| **P3: Read path** | `reports-v2.ts` reads new sheets. Old reports untouched. | Reconciliation script shows new == old for orders migrated |
| **P4: Migration** | One-shot script reads Orders/Order_Lines, writes Orders_V2/Order_Lines_V2 with reconstructed fields. Old sheets frozen (renamed `*_LEGACY`). | 100% of historical orders migrated, reconciliation within ±1đ per order |
| **P5: Cutover** | POS UI calls submitOrderV2. Admin orders/edit UI calls V2. Reports read V2. | One full business day of V2-only operation with no incidents |
| **P6: Decommission** (deferred 30 days) | Archive legacy sheets. | — |

### 7.2 Migration reconstruction rules

For each historical order, reconstruct V2 fields as follows:

| V2 field | Reconstruction rule |
|---|---|
| `gross_total` | Sum of `(unit_price + sum(modifier.price)) × qty` across lines (recompute from raw) |
| `promo_discount_total` | If `applied_promotion_snapshot_json.type === "PRODUCT_DISCOUNT"`: sum of line.line_discount. Else 0. |
| `manual_item_discount_total` | Sum of line.line_manual_discount (0 for old orders) + line.discount_amount (legacy field) where present. Dedup heuristics documented per order in `migration_notes`. |
| `manual_order_discount` | If `applied_promotion_snapshot_json.type === "ORDER_DISCOUNT"`: the promo value. Else: order.discount_amount (when not already accounted for in line fields). Heuristic flagged in `migration_notes`. |
| `net_total` | **Use `order.total_amount` directly.** This is what the customer paid. It is authoritative. Do not recompute. |
| Per-line `order_discount_allocation` | Solve: `net_line_total = gross_line_total − promo_discount − manual_item_discount − X`. Distribute residual X across lines per `allocateOrderDiscount`. If no residual, X = 0 for all lines. |
| `cost_at_sale` | Reconstruct from Stock_Ledger entries with `reference_id = order.id` and `transaction_type = SALES_CONSUME`. Sum `abs(quantity_change) × unit_cost`. If no ledger entries, fall back to current recipe × current MAC, flag in `migration_notes`. |
| `parent_order_id`, `version` | Empty and 1 respectively for migrated orders |
| `migration_notes` | Free-text summary of any heuristics applied (e.g., "could not disambiguate 10k discount between promo and manual; classified as manual_item") |

### 7.3 Reconciliation

`scripts/reconcile-v1-v2.ts` produces a per-order diff:

```json
{
  "orderId": "...",
  "v1_total_amount": 50000,
  "v2_net_total": 50000,
  "match": true,
  "drift": 0,
  "flags": []
}
```

Hard rule: any order with `match = false` AND `drift > 1` blocks cutover. Either fix the reconstruction rule for that pattern or mark the order for manual review.

---

## 8. Implementation Workstreams

Antigravity: each workstream is a candidate sub-plan under `docs/superpowers/plans/2026-06-18-orders-reports-rebuild-wsN-<name>.md`. Sequence strictly WS-1 → WS-2 → WS-3 → WS-4 (parallel possible after WS-1) → WS-5 → WS-6.

### WS-1: Foundation — Sheets, Types, Math

**Files to create:**
- `lib/order-math.ts` — pure functions from §6
- `lib/order-types.ts` — TypeScript interfaces for Orders_V2, Order_Lines_V2, Order_Events
- `lib/order-invariants.ts` — assertion helpers
- `lib/sheets-db-helpers.ts` — batched write helpers, id generation

**Files to modify:**
- The three new sheets must be created manually in Google Sheets with exact headers from §5. Add a `scripts/verify-v2-schema.ts` that reads headers and asserts they match.

**Tests:**
- `lib/__tests__/order-math.test.ts` — golden cases:
  - UCK000094: 1× Sữa Dâu (35k) with PRM-003 promo (10k off), 1× Hồng Trà (30k) with 5k manual order discount. Expected: Sữa Dâu `net_line_total = 25000`, Hồng Trà `net_line_total = 25000`, order `net_total = 50000`.
  - Edge: order discount > sum of line capacities (cap behavior)
  - Edge: order with zero lines (must throw)
  - Edge: rounding (3 lines, 100đ order discount, must distribute without loss)

### WS-2: Write Path — POS

**Files to create:**
- `app/actions/pos-v2.ts` — `submitOrderV2(input: CartInput): Promise<{ orderId, orderNo }>`

**Files to modify:**
- `components/POSScreen.tsx` — replace `submitOrder` call with `submitOrderV2`. Split the discount UI into three clearly distinct controls:
  1. Per-item manual discount (in product modal, unchanged location)
  2. Per-order manual discount (in checkout modal, clearly labeled "Giảm giá thủ công đơn hàng")
  3. System promotion (read-only display, banner at top of cart per E.5 Option B)
- Replace any `applied_promotion_snapshot_json = ""` wipes with preservation.

**Tests:**
- Integration: drive `submitOrderV2` with a fixture cart, read back the order, assert invariants pass.
- Property-based: 1000 random carts → assert invariants always hold.

### WS-3: Edit Path — Admin

**Files to create:**
- `app/actions/order-edit-v2.ts` — `editOrderV2(orderId, editInput, reason, actor): Promise<{ newOrderId }>`

**Files to modify:**
- `app/admin/orders/OrderEditModal.tsx` — call `editOrderV2`. Display version info. Require edit reason.
- `app/admin/orders/OrderTable.tsx` — collapse superseded versions into a single row (show latest), with indicator if any superseded versions exist.
- `app/admin/orders/OrderDetailModal.tsx` — show version timeline, allow viewing any prior version.

**Tests:**
- Integration: create order → edit (add a line) → assert old order is SUPERSEDED, new order is COMPLETED, stock ledger has reversal + new consume.
- Edit reason required: calling `editOrderV2` without a reason throws.

### WS-4: Reports — Read Path

**Files to create:**
- `app/actions/reports-v2.ts` — `getPnLDataV2`, `getSalesDataV2`, `getRealtimeStockV2`
- `app/admin/reports/pnl/page.tsx` (modify) — call V2
- `app/admin/reports/sales/page.tsx` (modify) — call V2
- `app/admin/reports/stock/page.tsx` (modify) — call V2

**Files to delete (or mark deprecated):**
- `lib/report-utils.ts` — replace usages with V2 logic; keep file for one release cycle as reference

**Tests:**
- Reconciliation: run V1 report and V2 report for the same migrated data, assert outputs match within ±1đ per order.
- UCK000094 golden case: assert Sữa Dâu reports exactly 25.000đ × qty.

### WS-5: Migration & Cutover

**Files to create:**
- `scripts/migrate-orders-to-v2.ts` — one-shot migration with `--dry-run` and `--order-id=<id>` flags
- `scripts/reconcile-v1-v2.ts` — per-order diff report
- `docs/runbooks/orders-v2-cutover.md` — operator runbook for the cutover day

**Operator steps (documented, not automated):**
1. Manual backup of Orders, Order_Lines, Stock_Ledger sheets (right-click → Duplicate)
2. Run migration `--dry-run` and review summary
3. Run migration live
4. Run reconciliation; resolve any `drift > 1` cases manually
5. Flip feature flag to V2-only
6. Monitor for one business day
7. Rename legacy sheets to `*_LEGACY`

### WS-6: UI Hardening & Polish

**Files to modify:**
- All admin order/report pages — empty states, loading states, error boundaries
- `app/admin/orders/page.tsx` — filtering by date range, brand, staff, status
- `OrderDetailModal` — clear visual hierarchy for gross / promo / manual / net (mirrors POS)

---

## 9. Testing & Verification Strategy

### 9.1 Test pyramid

- **Unit (jest / vitest):** `lib/order-math.ts`, `lib/order-invariants.ts`. Golden cases include UCK000094 and edge cases from §8 WS-1.
- **Integration (jest + sheets_db mock or test spreadsheet):** `submitOrderV2` round-trip, `editOrderV2` supersede-and-reverse, reports aggregation.
- **Property-based (fast-check):** random carts → invariants always hold; random edits → stock ledger net change equals net change of the order's lines.
- **Reconciliation:** V1 vs V2 report outputs for the same migrated data.

### 9.2 Acceptance criteria

The rebuild is done when ALL of these hold:

1. `submitOrderV2` produces orders that pass `assertOrderInvariants` 100% of the time (verified by property-based test with 1000 random carts).
2. `editOrderV2` produces a new order version; the old order is marked SUPERSEDED within the same write; Stock_Ledger has matching reversal rows.
3. P&L report for the Sữa Dâu promo window (after migration) shows Sữa Dâu revenue exactly equal to promo price × quantity (73 × 25.000đ = 1.825.000đ per the 2026-06-15-deep plan's headline number).
4. Reconciliation script reports zero orders with `drift > 1` for the full historical dataset.
5. One business day of V2-only POS operation completes with zero invariant violations logged.

### 9.3 Verification gates (per CLAUDE.md §5)

Before any workstream is marked complete:
- `rtk tsc --noEmit` reports 0 errors in changed files
- All tests in the workstream's test scope pass
- `superpowers:code-reviewer` runs against the changes
- DEVELOPMENT-TRACKING.md updated

---

## 10. Risks & Mitigations

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Google Sheets batched write partially fails (network mid-batch) | Low | High (data inconsistency) | Order_Events log lets us detect and repair; reconciliation script runs hourly; invariant violations raise pager |
| R2 | Migration script reconstructs discount fields incorrectly for some order pattern not yet seen | Medium | High (silent financial drift) | Reconciliation script flags every order with drift > 1; manual review queue; dry-run review with User before live |
| R3 | POS UI changes confuse cashiers, slow down checkout | Medium | Medium | E.5 visual hierarchy already user-approved; train cashiers before cutover; keep V1 path accessible via feature flag for 1 week |
| R4 | Reports performance degrades due to larger rows (snapshots) | Low | Medium | `findAll` cache already exists; snapshot size kept minimal (only needed fields); can add per-line indexes if needed |
| R5 | Edit flow produces duplicate stock consumption if Stock_Ledger reversal missing | Medium | High (inventory drift) | Integration test asserts reversal + consume pair; reconciliation script checks stock ledger invariants |
| R6 | Concurrent edits to the same order (two admins) cause version conflict | Low | Medium | Optimistic locking via `version` field; `editOrderV2` checks `version` matches, fails with clear error if not |
| R7 | Migration of voided or already-edited orders produces wrong version chain | Medium | Low (audit only) | Migration marks all as version 1, parent_order_id empty; document that historical edit chains are not reconstructed |

---

## 11. Out of Scope

The following are explicitly excluded from this rebuild. They can be follow-up work.

- **Database migration (Postgres / SQLite / etc.).** Stay on Google Sheets. If Sheets becomes a hard limit, that's a separate decision.
- **Full refund flow with payment reversal.** Void + new order covers the accounting case. Real payment refunds (bank transfer reversals) are operational, not in-app.
- **Multi-currency.** VND only.
- **Customer loyalty / points accrual.** Not in current scope.
- **Real-time kitchen display integration.** POS → KDS is a separate module.
- **Historical order version chain reconstruction.** Migration marks all as version 1. Pre-migration edits are lost history; we accept this.
- **Discount reason code taxonomy.** Start with two codes (`PRM-*` and `MANUAL_CASHIER`); expand later.

---

## 12. Self-Review (against sponsor's 3 deliverables)

**Deliverable 1: Deep Audit of current architecture.** ✓ Section 2 catalogues 8 categories of defects with file:line references. Section 3 explains why prior attempts failed.

**Deliverable 2: New architecture design.** ✓ Section 4 lays out 7 architectural principles with enforcement mechanisms. Sections 5-6 specify the data model and math. Section 8 sequences the implementation workstreams.

**Deliverable 3: Strict data models.** ✓ Section 5 specifies every field with type, mutability, and notes. Section 6 specifies the pure functions and 7 invariants that must hold for every order. Section 7.2 specifies the migration reconstruction rules field-by-field.

**Open questions for Antigravity to surface in the implementation plan:**
- Q1: Should DRAFT status be exposed in POS (cart persistence), or is DRAFT only for future use? Recommend: future use only; current POS confirms in one shot.
- Q2: How should `payment_ref` be captured for bank transfers? Manual entry, QR scan result, or auto-from-bank API? Recommend: manual entry for now; revisit after cutover.
- Q3: Should supersede chains be flattened (always link new order to root) or nested (each links to immediate predecessor)? Recommend: nested with `parent_order_id`; reports walk the chain to find latest via `superseded_by`.

---

## 13. Handoff to Antigravity

**Next step:** Produce `docs/superpowers/plans/2026-06-18-orders-reports-rebuild.md` (or split into WS-1 through WS-6 sub-plans) using `superpowers:writing-plans`. Each workstream becomes a TDD-style task plan with bite-sized steps.

**Sequencing rule:** WS-1 must land first (foundation). WS-2, WS-3, WS-4 can proceed in parallel after WS-1 (different files, no conflicts). WS-5 requires WS-2 + WS-3 + WS-4 code-complete. WS-6 is polish, can overlap with WS-5.

**Questions to surface with User before WS-5 cutover:**
- Cutover date and time (recommend off-peak)
- Cashier training schedule for new POS UI
- Rollback plan if V2 has critical bug in first 24h (recommend: feature flag to fall back to V1 read path; V1 write path is destroyed once migration runs, so write rollback = restore from sheet backup)

**Do not start coding without an approved plan.** Per CLAUDE.md §4, plan first.
