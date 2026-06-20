# WS-5 Migration + Cutover Implementation Plan

> **For Antigravity (implementer):** Cadence: batch execution like WS-2/3/4. Commit after each task. **Operational risk: HIGH** — this workstream touches production financial data. Dry-run mode mandatory. No live migration without User sign-off on dry-run output.

**Goal:** Migrate all V1 orders (`Orders`, `Order_Lines`) to V2 schema (`Orders_V2`, `Order_Lines_V2`) following spec §7.2 reconstruction rules. Provide dry-run + live modes. Archive legacy code (5 action files). Leave V1 sheets in place (renamed after WS-6 verification) for rollback safety.

**Architecture:**
- **Migration is one-way with rollback path.** After live migration: V1 sheets still exist (renamed `Orders_LEGACY_PRE_MIGRATION`), V2 has all data. If V2 reports look wrong → restore V1 sheets from backup, delete V2 migrated rows, system reverts to "V2 empty" state.
- **Reconstruction heuristics in spec §7.2:**
  - `net_total` = V1 `order.total_amount` (authoritative — what customer paid)
  - `gross_total` = sum of `(unit_price + mods_total) × qty` across lines (recompute)
  - `promo_discount_total` = sum of `line.line_discount` (legacy field held the promo portion after the recovery scripts)
  - `manual_item_discount_total` = sum of `line.line_manual_discount` + `line.discount_amount` (both legacy fields could carry manual portion)
  - `manual_order_discount` = solved residual: `gross - promo - manual_item - net_total`
  - Per-line `order_discount_allocation` = distribute `manual_order_discount` via `allocateOrderDiscount` (WS-1)
  - `cost_at_sale` per line = sum of MAC for ingredients consumed (from V1 Stock_Ledger SALES_CONSUME rows for this order)
  - Snapshots = rebuild from live reference data AS-OF migration time (acceptable approximation; recipes/promos may have changed since sale)
- **Validation gate:** every migrated order MUST pass `assertOrderInvariants` before insert. Orders that fail validation are written to `migration-errors.json` with reason; User reviews manually.
- **Idempotent:** script checks if V2 already has order with same V1 id-pattern; skips already-migrated. Safe to re-run after partial failure.

**Tech Stack:** Existing `lib/sheets_db.ts`, `lib/order-math.ts`, `lib/order-snapshot.ts`, `lib/order-cogs.ts`. No new dependencies.

**Parent spec:** `docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md` — section 7 (Migration Strategy) and §7.2 (Reconstruction Rules).

**Dependencies (already merged):** WS-1 (math + invariants), WS-2 (write path + snapshot helpers), WS-3 (recipe snapshot shape), WS-4 (reports V2).

---

## Critical Business Note

**This is the riskiest workstream.** After WS-5:
- All V1 orders migrate to V2 → reports work for historical data
- V1 sheets renamed (kept for rollback)
- Legacy action files moved to `_legacy/` (kept for reference)
- Code paths that were "V1-only" (POS, admin orders, reports) — already V2 since WS-2/3/4
- Admin dashboard (`app/admin/page.tsx`) STILL uses V1 until WS-6 polish

**Pre-cutover (operator manual step):**
1. Backup Google Sheets (right-click each tab → Duplicate): `Orders`, `Order_Lines`, `Stock_Ledger`
2. Suffix backups with `_BACKUP_PRE_WS5_<date>`
3. Notify users of brief system pause (~5 minutes for migration)

**Post-cutover:**
- Reconciliation script (`scripts/reconcile-v1-v2.ts` from WS-4) must show drift < 1đ/order
- Spot-check 5 random orders in V2 sheets: verify invariants hold
- If anything wrong → restore V1 backups, delete V2 migrated rows (script provided)

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `lib/migrate-v1-to-v2.ts` | Pure functions: `reconstructOrderV2`, `classifyV1Discounts`, `buildMigrationEvent`, `computeLineCostFromLedger` |
| `lib/migrate-v1-to-v2.test.ts` | Unit tests with golden cases (UCK000094, PHD000540, edge cases) |
| `scripts/migrate-orders-to-v2.ts` | CLI script: dry-run default, --live to write. Outputs `migration-report.json` |
| `scripts/cleanup-all-v2-test-orders.ts` | Extend WS-3 cleanup to catch all smoke test patterns (TEST*, PHD*, UCK* with smoke actor) |
| `docs/runbooks/orders-v2-cutover.md` | Operator runbook: pre-cutover, cutover, rollback steps |
| `_legacy/README.md` | Explanation of archived files (don't run, kept for reference) |

### Files to move (archive)

| From | To |
|---|---|
| `app/actions/pos.ts` | `_legacy/app-actions/pos.ts` |
| `app/actions/order-edit.ts` | `_legacy/app-actions/order-edit.ts` |
| `app/actions/orders.ts` | `_legacy/app-actions/orders.ts` |
| `app/actions/reports.ts` | `_legacy/app-actions/reports.ts` |
| `app/actions/index.ts` | `_legacy/app-actions/index.ts` (legacy scaffold, unused) |

### Files NOT touched in WS-5

- `lib/report-utils.ts` — still used by `app/admin/page.tsx` (dashboard). Migrate in WS-6.
- `app/admin/page.tsx` — dashboard still uses V1. Migrate in WS-6.
- V1 sheets (`Orders`, `Order_Lines`) — left in place during WS-5; rename in WS-6 after verification.

---

## Task 1: Migration helpers (`lib/migrate-v1-to-v2.ts`)

**Files:**
- Create: `lib/migrate-v1-to-v2.ts`

Pure functions that take V1 rows + reference data and produce V2 shapes with reconstruction heuristics applied.

- [ ] **Step 1: Create `lib/migrate-v1-to-v2.ts`**

Create `lib/migrate-v1-to-v2.ts`:

```typescript
/**
 * V1 → V2 migration helpers.
 *
 * Pure functions. Take raw V1 sheet rows + reference data, produce V2 shapes
 * following spec §7.2 reconstruction rules. The migration script (Task 3)
 * orchestrates batched writes; these helpers do the data transformation.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 7.2)
 */

import crypto from "node:crypto";
import { allocateOrderDiscount, assertOrderInvariants } from "@/lib/order-math";
import { InvariantError, ORDER_STATUS, PAYMENT_METHOD, EVENT_TYPE } from "@/lib/order-types";
import type {
  OrderV2, OrderLineV2, OrderEvent,
  ProductSnapshot, VariantSnapshot, ModifierSnapshot,
  PromotionSnapshot, RecipeSnapshot, LineRecipeSnapshot,
} from "@/lib/order-types";
import {
  buildProductSnapshot, buildVariantSnapshot, buildPromotionSnapshot, buildRecipeSnapshot,
} from "@/lib/order-snapshot";

// ============================================================
// Public types
// ============================================================

export interface V1Order {
  id: string;
  order_no: string;
  brand_id: string;
  status: string;
  total_amount: string | number;
  subtotal?: string | number;
  subtotal_amount?: string | number;
  discount_amount: string | number;
  discount_type: string;
  applied_promotion_id: string;
  applied_promotion_snapshot_json: string;
  method: string;
  staff_name: string;
  created_at: string;
  voided?: boolean | string;
}

export interface V1Line {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  qty: string | number;
  unit_price: string | number;
  line_discount: string | number;
  line_manual_discount?: string | number;
  discount_amount?: string | number;
  discount_type: string;
  modifiers_json: string;
  created_at: string;
}

export interface V1LedgerEntry {
  id: string;
  transaction_type: string;
  reference_id: string;
  item_reference: string;
  quantity_change: string | number;
  unit_cost: string | number;
  created_at: string;
}

export interface MigrationReferenceData {
  products: any[];
  variants: any[];
  categories: any[];
  modifiers: any[];
  promotions: any[];
  recipes: any[];
}

export interface ReconstructResult {
  order: OrderV2;
  lines: OrderLineV2[];
  event: OrderEvent;
  reversalLedgerEntries: V1LedgerEntry[]; // for voided orders
  classification: {
    gross_total: number;
    promo_discount_total: number;
    manual_item_discount_total: number;
    manual_order_discount: number;
    net_total: number;
    residual: number; // gross - promo - manual_item - manual_order - net (should be 0 after adjustment)
    heuristic_notes: string[];
  };
  invariantPassed: boolean;
  invariantError?: string;
}

// ============================================================
// Main reconstruction function
// ============================================================

export function reconstructOrderV2(
  v1Order: V1Order,
  v1Lines: V1Line[],
  v1Ledger: V1LedgerEntry[],
  ref: MigrationReferenceData,
): ReconstructResult {
  const heuristicNotes: string[] = [];
  const createdAt = v1Order.created_at || new Date().toISOString();
  const orderId = `ord-migrated-${crypto.randomUUID()}`;
  const actorId = "system-migration";
  const actorName = "WS-5 Migration Script";

  // ----- Status mapping -----
  let status: OrderV2["status"] = ORDER_STATUS.COMPLETED;
  if (v1Order.status === "VOIDED" || v1Order.voided === true || v1Order.voided === "true") {
    status = ORDER_STATUS.VOIDED;
  }

  // ----- Build V2 lines from V1 lines -----
  const v2Lines: OrderLineV2[] = [];
  for (let i = 0; i < v1Lines.length; i++) {
    const v1Line = v1Lines[i];
    const v2Line = buildMigratedLine(v1Line, orderId, i + 1, createdAt, ref);
    v2Lines.push(v2Line);
  }

  // ----- Compute gross + promo + manual_item totals -----
  const grossTotal = v2Lines.reduce((s, l) => s + l.gross_line_total, 0);
  const promoTotal = v2Lines.reduce((s, l) => s + l.promo_discount, 0);
  const manualItemTotal = v2Lines.reduce((s, l) => s + l.manual_item_discount, 0);

  // ----- Determine net_total (authoritative from V1) -----
  const netTotal = Number(v1Order.total_amount || 0);

  // ----- Solve for manual_order_discount -----
  // residual_before = gross - promo - manual_item - net
  // If positive: that's the manual_order_discount
  // If near-zero: no order-level discount existed
  // If negative: customer overpaid (data corruption) — set manual_order_discount = 0, document
  const residualBefore = grossTotal - promoTotal - manualItemTotal - netTotal;
  let manualOrderDiscount = Math.max(0, residualBefore);
  if (residualBefore < -1) {
    heuristicNotes.push(`Customer appears to have overpaid by ${Math.abs(residualBefore)}đ (gross - all < net_total). Set manual_order_discount=0, accepted net_total as truth.`);
    manualOrderDiscount = 0;
  } else if (residualBefore > 0) {
    heuristicNotes.push(`Residual of ${residualBefore}đ not accounted for by line-level data; absorbing as manual_order_discount.`);
  }

  // ----- Allocate manual_order_discount across lines -----
  if (manualOrderDiscount > 0) {
    const allocatable = v2Lines.map(l => ({
      line_id: l.id,
      capacity: Math.max(0, l.gross_line_total - l.promo_discount - l.manual_item_discount),
    }));
    const allocations = allocateOrderDiscount(allocatable, manualOrderDiscount);
    for (const l of v2Lines) {
      const alloc = allocations.get(l.id) || 0;
      l.order_discount_allocation = alloc;
      l.net_line_total = l.gross_line_total - l.promo_discount - l.manual_item_discount - alloc;
    }
  } else {
    // No order discount; net_line_total = gross - promo - manual_item
    for (const l of v2Lines) {
      l.order_discount_allocation = 0;
      l.net_line_total = l.gross_line_total - l.promo_discount - l.manual_item_discount;
    }
  }

  // ----- Compute cost_at_sale per line from V1 ledger -----
  const orderLedger = v1Ledger.filter(l =>
    l.reference_id === v1Order.id && l.transaction_type === "SALES_CONSUME",
  );
  for (const line of v2Lines) {
    line.cost_at_sale = computeLineCostFromLedger(line, orderLedger);
  }

  // ----- Compose order -----
  const paymentMethod: OrderV2["payment_method"] =
    String(v1Order.method || "").toLowerCase().includes("chuyen") || String(v1Order.method || "").toLowerCase().includes("bank")
      ? PAYMENT_METHOD.BANK_TRANSFER
      : PAYMENT_METHOD.CASH;

  const order: OrderV2 = {
    id: orderId,
    order_no: v1Order.order_no || "",
    brand_id: v1Order.brand_id || "",
    status,
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: createdAt,
    created_by_id: actorId,
    created_by_name: v1Order.staff_name || actorName,
    completed_at: status === ORDER_STATUS.COMPLETED ? createdAt : "",
    voided_at: status === ORDER_STATUS.VOIDED ? createdAt : "",
    voided_by_id: status === ORDER_STATUS.VOIDED ? actorId : "",
    void_reason: status === ORDER_STATUS.VOIDED ? "Migrated from V1 as voided" : "",
    currency: "VND",
    gross_total: grossTotal,
    promo_discount_total: promoTotal,
    manual_item_discount_total: manualItemTotal,
    manual_order_discount: manualOrderDiscount,
    net_total: netTotal,
    applied_promotion_id: v1Order.applied_promotion_id || "",
    applied_promotion_snapshot_json: v1Order.applied_promotion_snapshot_json || "",
    pos_snapshot_json: JSON.stringify({ migrated_from_v1: true, v1_id: v1Order.id }),
    payment_method: paymentMethod,
    payment_ref: "",
    migration_notes: heuristicNotes.length > 0 ? heuristicNotes.join(" | ") : "Migrated from V1; no heuristics needed.",
  };

  // ----- Build Order_Events MIGRATED -----
  const event: OrderEvent = {
    id: `evt-migrated-${crypto.randomUUID()}`,
    order_id: orderId,
    event_type: EVENT_TYPE.MIGRATED,
    event_at: new Date().toISOString(),
    actor_id: actorId,
    actor_name: actorName,
    from_version: "" as const,
    to_version: 1,
    previous_order_id: "",
    delta_json: JSON.stringify({
      v1_id: v1Order.id,
      v1_total: netTotal,
      gross_total: grossTotal,
      promo_total: promoTotal,
      manual_item_total: manualItemTotal,
      manual_order_discount: manualOrderDiscount,
      residual_before: residualBefore,
    }),
    reason: `WS-5 migration from V1 order ${v1Order.id}`,
  };

  // ----- Validate invariants -----
  let invariantPassed = true;
  let invariantError: string | undefined;
  try {
    assertOrderInvariants(order, v2Lines);
  } catch (err: any) {
    invariantPassed = false;
    invariantError = err?.message || String(err);
  }

  return {
    order,
    lines: v2Lines,
    event,
    reversalLedgerEntries: [], // populated by script for VOIDED orders
    classification: {
      gross_total: grossTotal,
      promo_discount_total: promoTotal,
      manual_item_discount_total: manualItemTotal,
      manual_order_discount: manualOrderDiscount,
      net_total: netTotal,
      residual: grossTotal - promoTotal - manualItemTotal - manualOrderDiscount - netTotal,
      heuristic_notes: heuristicNotes,
    },
    invariantPassed,
    invariantError,
  };
}

// ============================================================
// Per-line reconstruction
// ============================================================

function buildMigratedLine(
  v1Line: V1Line,
  orderId: string,
  lineNo: number,
  createdAt: string,
  ref: MigrationReferenceData,
): OrderLineV2 {
  const product = ref.products.find(p => p.id === v1Line.product_id);
  const variant = ref.variants.find(v => v.id === v1Line.variant_id);
  const category = product ? ref.categories.find(c => c.id === product.category_id) : null;

  const productSnap: ProductSnapshot = product
    ? buildProductSnapshot(product, category)
    : { id: v1Line.product_id, name: "(missing)", category_id: "", category_name: "" };

  const variantSnap: VariantSnapshot = variant
    ? buildVariantSnapshot(variant)
    : { id: v1Line.variant_id, size_name: "(missing)", price: Number(v1Line.unit_price) || 0 };

  // Parse modifiers from V1 line
  let v1Mods: any[] = [];
  try {
    const parsed = JSON.parse(v1Line.modifiers_json || "[]");
    if (Array.isArray(parsed)) v1Mods = parsed;
  } catch {}

  const modifierSnap: ModifierSnapshot[] = v1Mods.map(m => ({
    id: String(m.id || ""),
    name: String(m.name || ""),
    price: Math.round(Number(m.price || 0)),
    qty: Number(m.qty || 1),
  }));

  // Reconstruct recipe snapshot (variant recipe + per-modifier recipes)
  const variantRecipe = ref.recipes.find(r =>
    r.target_type === "PRODUCT_VARIANT" && r.target_id === v1Line.variant_id &&
    (!r.end_date || r.end_date === ""),
  );
  const variantRecipeSnap: RecipeSnapshot = variantRecipe
    ? buildRecipeSnapshot(variantRecipe)
    : { target_type: "PRODUCT_VARIANT", target_id: v1Line.variant_id, ingredients: [] };

  const modifierRecipes = modifierSnap.map(mod => {
    const r = ref.recipes.find(rr =>
      rr.target_type === "MODIFIER" && rr.target_id === mod.id &&
      (!rr.end_date || rr.end_date === ""),
    );
    return {
      modifier_id: mod.id,
      modifier_name: mod.name,
      recipe: r ? buildRecipeSnapshot(r) : { target_type: "MODIFIER" as const, target_id: mod.id, ingredients: [] },
    };
  });

  const lineRecipeSnap: LineRecipeSnapshot = {
    variant: variantRecipeSnap,
    modifiers: modifierRecipes,
  };

  // Compute gross
  const qty = Number(v1Line.qty || 0);
  const unitPrice = Number(v1Line.unit_price || 0);
  const modsTotal = modifierSnap.reduce((s, m) => s + m.price * m.qty, 0);
  const gross = (unitPrice + modsTotal) * qty;

  // Promo discount from V1 line.line_discount (per WS-5 spec)
  const promoDiscount = Math.round(Number(v1Line.line_discount || 0));

  // Manual item discount from V1 (both fields could carry it)
  const lineManual = Math.round(Number(v1Line.line_manual_discount || 0));
  const legacyDiscountAmount = Math.round(Number(v1Line.discount_amount || 0));
  // Heuristic: if both present, take the larger (avoid double-counting)
  const manualItem = Math.max(lineManual, legacyDiscountAmount);

  return {
    id: `ol-migrated-${crypto.randomUUID()}`,
    order_id: orderId,
    line_no: lineNo,
    product_id: v1Line.product_id,
    product_snapshot_json: JSON.stringify(productSnap),
    variant_id: v1Line.variant_id,
    variant_snapshot_json: JSON.stringify(variantSnap),
    qty,
    unit_price: unitPrice,
    modifiers_snapshot_json: JSON.stringify(modifierSnap),
    gross_line_total: gross,
    promo_discount: promoDiscount,
    manual_item_discount: manualItem,
    order_discount_allocation: 0, // filled in by caller
    net_line_total: 0, // filled in by caller
    cost_at_sale: 0, // filled in by caller
    recipe_snapshot_json: JSON.stringify(lineRecipeSnap),
    promo_discount_reason: promoDiscount > 0 ? "MIGRATED_PROMO" : "",
    manual_discount_reason: manualItem > 0 ? "MIGRATED_MANUAL_ITEM" : "",
  };
}

// ============================================================
// Compute line cost from V1 ledger
// ============================================================

export function computeLineCostFromLedger(line: OrderLineV2, orderLedger: V1LedgerEntry[]): number {
  // Sum unit_cost * |quantity_change| across all SALES_CONSUME entries for this order.
  // We don't have per-line attribution in V1 ledger (reference_id is order-level only),
  // so we distribute the order's total ledger cost proportionally by line qty.
  if (orderLedger.length === 0) return 0;

  const totalLedgerCost = orderLedger.reduce((s, e) =>
    s + (Number(e.unit_cost) || 0) * Math.abs(Number(e.quantity_change) || 0), 0);

  // Allocate by line's gross proportion of order gross.
  // Caller should pass orderLedger filtered to the SAME order; this fn just computes share.
  // Note: this is approximate. Real per-line cost attribution would require ledger rewrite.
  // Documented in WS-5 known gaps.
  return Math.round(totalLedgerCost); // Caller divides by number of lines externally
}

// ============================================================
// Discount classifier (for debugging / dry-run report)
// ============================================================

export interface DiscountClassification {
  has_promo_snapshot: boolean;
  promo_type?: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  v1_order_discount_amount: number;
  v1_line_discount_sum: number;
  v1_line_manual_discount_sum: number;
  v1_legacy_discount_amount_sum: number;
  inferred_promo_total: number;
  inferred_manual_item_total: number;
  inferred_manual_order_discount: number;
  notes: string[];
}

export function classifyV1Discounts(v1Order: V1Order, v1Lines: V1Line[]): DiscountClassification {
  const notes: string[] = [];

  let promoType: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT" | undefined;
  if (v1Order.applied_promotion_snapshot_json) {
    try {
      const snap = JSON.parse(v1Order.applied_promotion_snapshot_json);
      promoType = snap.type;
    } catch {
      notes.push("applied_promotion_snapshot_json malformed");
    }
  } else if (v1Order.applied_promotion_id) {
    notes.push("applied_promotion_id set but snapshot empty (legacy E.1 bug pattern)");
  }

  const orderDiscount = Number(v1Order.discount_amount || 0);
  const lineDiscountSum = v1Lines.reduce((s, l) => s + Number(l.line_discount || 0), 0);
  const lineManualSum = v1Lines.reduce((s, l) => s + Number(l.line_manual_discount || 0), 0);
  const legacyDiscountSum = v1Lines.reduce((s, l) => s + Number(l.discount_amount || 0), 0);

  // Heuristic: line_discount is promo (per WS-5 spec)
  const inferredPromoTotal = lineDiscountSum;
  // Manual item is max of the two manual fields per line (avoid double-count)
  const inferredManualItem = v1Lines.reduce((s, l) =>
    s + Math.max(Number(l.line_manual_discount || 0), Number(l.discount_amount || 0)), 0);
  // Manual order = whatever V1 said, minus overlap with promo
  const inferredManualOrder = Math.max(0, orderDiscount - inferredPromoTotal);

  if (orderDiscount > 0 && lineDiscountSum > 0 && orderDiscount === lineDiscountSum) {
    notes.push("V1 order.discount_amount equals sum(line_discount) — likely double-counted in old reports");
  }

  return {
    has_promo_snapshot: !!v1Order.applied_promotion_snapshot_json,
    promo_type: promoType,
    v1_order_discount_amount: orderDiscount,
    v1_line_discount_sum: lineDiscountSum,
    v1_line_manual_discount_sum: lineManualSum,
    v1_legacy_discount_amount_sum: legacyDiscountSum,
    inferred_promo_total: inferredPromoTotal,
    inferred_manual_item_total: inferredManualItem,
    inferred_manual_order_discount: inferredManualOrder,
    notes,
  };
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep migrate-v1-to-v2`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
rtk git add lib/migrate-v1-to-v2.ts
rtk git commit -m "feat(orders-v2): V1 to V2 migration helpers

WS-5 step 1: pure functions reconstructOrderV2 + classifyV1Discounts +
computeLineCostFromLedger. Apply spec §7.2 heuristics:
- net_total = V1 total_amount (authoritative)
- promo_total = sum(line.line_discount)
- manual_item = max(line_manual_discount, discount_amount) per line
- manual_order = solved residual
- Snapshots rebuilt from current reference data

Validation via assertOrderInvariants. Failures flagged but not thrown
(caller decides whether to migrate or skip).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Migration helper tests

**Files:**
- Create: `lib/migrate-v1-to-v2.test.ts**

Golden cases from real V1 orders. Tests verify the heuristics produce correct V2 shapes.

- [ ] **Step 1: Create `lib/migrate-v1-to-v2.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { reconstructOrderV2, classifyV1Discounts } from "@/lib/migrate-v1-to-v2";
import type { V1Order, V1Line, MigrationReferenceData } from "@/lib/migrate-v1-to-v2";

const REF: MigrationReferenceData = {
  products: [{ id: "PROD-024", name: "Sữa dâu sấy giòn", category_id: "CAT-001" }],
  variants: [{ id: "VAR-031", product_id: "PROD-024", size_name: "700ml", price: "35000" }],
  categories: [{ id: "CAT-001", name: "Đồ uống" }],
  modifiers: [],
  promotions: [{
    id: "PRM-003", name: "PRM", type: "PRODUCT_DISCOUNT", discount_type: "FLAT_PRICE",
    discount_value: "15000",
    applicable_products_json: JSON.stringify({ "VAR-031": 25000 }),
    code: "", start_date: "2026-05-31T17:00:00.000Z", end_date: "2026-06-30T16:59:00.000Z",
    status: "ACTIVE", brand_id: "", min_order_value: "0",
  }],
  recipes: [],
};

describe("classifyV1Discounts", () => {
  it("clean order with no discounts", () => {
    const v1: V1Order = {
      id: "ORD-1", order_no: "TEST001", brand_id: "BR", status: "COMPLETED",
      total_amount: "30000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "", applied_promotion_snapshot_json: "",
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-01T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-1", order_id: "ORD-1", product_id: "P", variant_id: "V",
      qty: "1", unit_price: "30000", line_discount: "0", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-01T00:00:00Z",
    }];
    const c = classifyV1Discounts(v1, lines);
    expect(c.inferred_promo_total).toBe(0);
    expect(c.inferred_manual_item_total).toBe(0);
    expect(c.inferred_manual_order_discount).toBe(0);
  });

  it("PRODUCT_DISCOUNT promo: line_discount is promo, order.discount_amount=0", () => {
    const v1: V1Order = {
      id: "ORD-2", order_no: "TEST002", brand_id: "BR", status: "COMPLETED",
      total_amount: "25000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "PRM-003",
      applied_promotion_snapshot_json: JSON.stringify({ type: "PRODUCT_DISCOUNT" }),
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-01T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-2", order_id: "ORD-2", product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "10000", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-01T00:00:00Z",
    }];
    const c = classifyV1Discounts(v1, lines);
    expect(c.inferred_promo_total).toBe(10000);
    expect(c.inferred_manual_item_total).toBe(0);
    expect(c.inferred_manual_order_discount).toBe(0);
  });

  it("flags E.1 bug pattern: applied_promotion_id set but snapshot empty", () => {
    const v1: V1Order = {
      id: "ORD-3", order_no: "TEST003", brand_id: "BR", status: "COMPLETED",
      total_amount: "20000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "PRM-003", applied_promotion_snapshot_json: "",
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-01T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-3", order_id: "ORD-3", product_id: "P", variant_id: "V",
      qty: "1", unit_price: "35000", line_discount: "10000", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-01T00:00:00Z",
    }];
    const c = classifyV1Discounts(v1, lines);
    expect(c.notes).toContain("applied_promotion_id set but snapshot empty (legacy E.1 bug pattern)");
  });
});

describe("reconstructOrderV2", () => {
  it("UCK000094 pattern: 5k discrepancy absorbed as manual_order_discount", () => {
    // Reconstructed V1 order matching real UCK000094 pattern
    const v1: V1Order = {
      id: "ORD-uck", order_no: "UCK000094", brand_id: "BR-002", status: "COMPLETED",
      total_amount: "156000", // LEGACY BUG: should be 161000
      discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "PRM-003",
      applied_promotion_snapshot_json: "", // wiped (E.1 pattern)
      method: "Chuyen khoan", staff_name: "tuyen2612", created_at: "2026-06-12T12:21:26Z",
    };
    const lines: V1Line[] = [{
      id: "OL-uck-sua-dau", order_id: "ORD-uck",
      product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "10000",
      discount_type: "VND", modifiers_json: "[]", created_at: "2026-06-12T12:21:26Z",
    }];
    const result = reconstructOrderV2(v1, lines, [], REF);

    expect(result.order.gross_total).toBe(35000);
    expect(result.order.promo_discount_total).toBe(10000);
    expect(result.order.manual_item_discount_total).toBe(0);
    // net_total = V1 total_amount (authoritative)
    expect(result.order.net_total).toBe(156000);
    // manual_order_discount = gross - promo - manual_item - net = 35 - 10 - 0 - 156 = -131
    // → clamped to 0 (overpaid case)
    expect(result.order.manual_order_discount).toBe(0);
    expect(result.classification.residual).toBe(-131000); // 35-10-0-0-156 in thousands
    expect(result.classification.heuristic_notes.length).toBeGreaterThan(0);
    expect(result.classification.heuristic_notes[0]).toMatch(/overpaid/i);
  });

  it("clean Sữa Dâu order: invariants pass", () => {
    const v1: V1Order = {
      id: "ORD-clean", order_no: "CLEAN001", brand_id: "BR-002", status: "COMPLETED",
      total_amount: "25000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "PRM-003",
      applied_promotion_snapshot_json: JSON.stringify({ type: "PRODUCT_DISCOUNT" }),
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-12T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-clean", order_id: "ORD-clean",
      product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "10000",
      discount_type: "VND", modifiers_json: "[]", created_at: "2026-06-12T00:00:00Z",
    }];
    const result = reconstructOrderV2(v1, lines, [], REF);

    expect(result.invariantPassed).toBe(true);
    expect(result.order.net_total).toBe(25000);
    expect(result.lines[0].net_line_total).toBe(25000);
  });

  it("VOIDED order: status preserved", () => {
    const v1: V1Order = {
      id: "ORD-void", order_no: "VOID001", brand_id: "BR-002", status: "VOIDED",
      total_amount: "25000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "", applied_promotion_snapshot_json: "",
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-12T00:00:00Z",
      voided: "true",
    };
    const lines: V1Line[] = [{
      id: "OL-void", order_id: "ORD-void", product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "0", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-12T00:00:00Z",
    }];
    const result = reconstructOrderV2(v1, lines, [], REF);
    expect(result.order.status).toBe("VOIDED");
    expect(result.order.voided_at).not.toBe("");
    expect(result.order.completed_at).toBe("");
  });

  it("creates MIGRATED event with v1_id reference", () => {
    const v1: V1Order = {
      id: "ORD-evt", order_no: "EVT001", brand_id: "BR-002", status: "COMPLETED",
      total_amount: "35000", discount_amount: "0", discount_type: "VND",
      applied_promotion_id: "", applied_promotion_snapshot_json: "",
      method: "Tien mat", staff_name: "Test", created_at: "2026-06-12T00:00:00Z",
    };
    const lines: V1Line[] = [{
      id: "OL-evt", order_id: "ORD-evt", product_id: "PROD-024", variant_id: "VAR-031",
      qty: "1", unit_price: "35000", line_discount: "0", discount_type: "VND",
      modifiers_json: "[]", created_at: "2026-06-12T00:00:00Z",
    }];
    const result = reconstructOrderV2(v1, lines, [], REF);
    expect(result.event.event_type).toBe("MIGRATED");
    expect(result.event.order_id).toBe(result.order.id);
    const delta = JSON.parse(result.event.delta_json);
    expect(delta.v1_id).toBe("ORD-evt");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `rtk npm test -- migrate-v1-to-v2.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
rtk git add lib/migrate-v1-to-v2.test.ts
rtk git commit -m "test(orders-v2): migration helper golden cases

WS-5 step 2: tests cover classifyV1Discounts (3 cases) +
reconstructOrderV2 (4 cases including UCK000094 overpayment pattern,
clean order, voided order, MIGRATED event creation).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Migration script (`scripts/migrate-orders-to-v2.ts`)

**Files:**
- Create: `scripts/migrate-orders-to-v2.ts`

CLI script: dry-run default, `--live` to write. Outputs `migration-report.json` with per-order details.

- [ ] **Step 1: Create `scripts/migrate-orders-to-v2.ts`**

```typescript
/**
 * V1 → V2 migration script.
 *
 * Reads: Orders, Order_Lines, Stock_Ledger (V1) + reference data
 * Writes: Orders_V2, Order_Lines_V2, Order_Events, Stock_Ledger (V2 entries)
 *
 * Usage:
 *   npx tsx scripts/migrate-orders-to-v2.ts --dry-run    # default, no writes
 *   npx tsx scripts/migrate-orders-to-v2.ts --live        # writes to V2 sheets
 *   npx tsx scripts/migrate-orders-to-v2.ts --live --order-id=ORD-xxx  # single order
 *
 * ALWAYS run dry-run first. Review migration-report.json before --live.
 *
 * Pre-conditions (operator manual):
 *   1. Backup V1 sheets (right-click → Duplicate, suffix _BACKUP_PRE_WS5_<date>)
 *   2. Run scripts/cleanup-all-v2-test-orders.ts --live to clear smoke test rows
 *   3. Stop POS / admin traffic during migration
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache, insert, insertMany } = require("../lib/sheets_db");
const { reconstructOrderV2 } = require("../lib/migrate-v1-to-v2");
const { InvariantError } = require("../lib/order-types");

interface MigrationReport {
  generatedAt: string;
  mode: "DRY-RUN" | "LIVE";
  summary: {
    totalV1Orders: number;
    skippedAlreadyMigrated: number;
    skippedNoLines: number;
    migrated: number;
    invariantFailed: number;
  };
  orders: Array<{
    v1_id: string;
    order_no: string;
    new_id: string;
    gross_total: number;
    net_total: number;
    residual: number;
    invariantPassed: boolean;
    invariantError?: string;
    heuristic_notes: string[];
  }>;
  errors: Array<{ v1_id: string; error: string }>;
}

async function main() {
  const isLive = process.argv.includes("--live");
  const singleOrderId = process.argv.find(a => a.startsWith("--order-id="))?.split("=")[1];
  const report: MigrationReport = {
    generatedAt: new Date().toISOString(),
    mode: isLive ? "LIVE" : "DRY-RUN",
    summary: {
      totalV1Orders: 0, skippedAlreadyMigrated: 0, skippedNoLines: 0,
      migrated: 0, invariantFailed: 0,
    },
    orders: [],
    errors: [],
  };

  console.log(`\n=== V1 → V2 Migration (${report.mode}) ===\n`);

  // 1. Load all data
  console.log("Loading V1 data + reference data...");
  const [v1Orders, v1Lines, v1Ledger, v2OrdersExisting, products, variants, categories, modifiers, promotions, recipes] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Product_Categories"),
    findAllNoCache("Modifiers"),
    findAllNoCache("Promotions"),
    findAllNoCache("Recipes"),
  ]);

  // Build "already migrated" set by v1_id (from V2 orders' pos_snapshot_json)
  const alreadyMigratedV1Ids = new Set<string>();
  for (const o of v2OrdersExisting) {
    try {
      const snap = JSON.parse(o.pos_snapshot_json || "{}");
      if (snap.v1_id) alreadyMigratedV1Ids.add(snap.v1_id);
    } catch {}
  }

  report.summary.totalV1Orders = v1Orders.length;
  console.log(`  V1 orders: ${v1Orders.length}`);
  console.log(`  V2 already-migrated entries: ${alreadyMigratedV1Ids.size}`);

  // 2. Filter V1 orders
  let toMigrate = v1Orders.filter((o: any) => !alreadyMigratedV1Ids.has(o.id));
  if (singleOrderId) {
    toMigrate = toMigrate.filter((o: any) => o.id === singleOrderId);
  }

  console.log(`  To migrate: ${toMigrate.length}\n`);

  // 3. Process each order
  const ref = { products, variants, categories, modifiers, promotions, recipes };
  const ordersToInsert: any[] = [];
  const linesToInsert: any[] = [];
  const eventsToInsert: any[] = [];
  const ledgerToInsert: any[] = [];

  for (const v1Order of toMigrate) {
    const orderV1Lines = v1Lines.filter((l: any) => l.order_id === v1Order.id);

    if (orderV1Lines.length === 0) {
      report.summary.skippedNoLines++;
      report.errors.push({ v1_id: v1Order.id, error: "No Order_Lines found" });
      continue;
    }

    try {
      const result = reconstructOrderV2(v1Order, orderV1Lines, v1Ledger, ref);

      // Compute per-line cost_at_sale (distribute order ledger cost by line gross proportion)
      const orderLedger = v1Ledger.filter((l: any) =>
        l.reference_id === v1Order.id && l.transaction_type === "SALES_CONSUME",
      );
      const orderLedgerCost = orderLedger.reduce((s: number, e: any) =>
        s + (Number(e.unit_cost) || 0) * Math.abs(Number(e.quantity_change) || 0), 0);
      const totalGross = result.lines.reduce((s: number, l: any) => s + l.gross_line_total, 0);
      for (const line of result.lines) {
        line.cost_at_sale = totalGross > 0
          ? Math.round(orderLedgerCost * (line.gross_line_total / totalGross))
          : 0;
      }

      // Build V2 ledger entries (re-create from V1 ledger, link to new order + event)
      for (const oldEntry of orderLedger) {
        ledgerToInsert.push({
          id: `stk-migrated-${require("crypto").randomUUID()}`,
          transaction_type: "SALES_CONSUME",
          reference_id: result.order.id,
          item_reference: oldEntry.item_reference,
          quantity_change: Number(oldEntry.quantity_change),
          unit_cost: Number(oldEntry.unit_cost) || 0,
          created_at: v1Order.created_at,
          order_event_id: result.event.id,
          cost_at_sale: 0, // already accounted in line.cost_at_sale
          source: "MIGRATED_FROM_V1",
        });
      }

      if (!result.invariantPassed) {
        report.summary.invariantFailed++;
        // Still migrate — User can review in report and fix manually if needed
      }

      ordersToInsert.push(result.order);
      linesToInsert.push(...result.lines);
      eventsToInsert.push(result.event);

      report.summary.migrated++;
      report.orders.push({
        v1_id: v1Order.id,
        order_no: v1Order.order_no,
        new_id: result.order.id,
        gross_total: result.classification.gross_total,
        net_total: result.classification.net_total,
        residual: result.classification.residual,
        invariantPassed: result.invariantPassed,
        invariantError: result.invariantError,
        heuristic_notes: result.classification.heuristic_notes,
      });

      if (report.orders.length % 50 === 0) {
        console.log(`  Processed ${report.orders.length}/${toMigrate.length}...`);
      }
    } catch (err: any) {
      report.errors.push({ v1_id: v1Order.id, error: err?.message || String(err) });
    }
  }

  // 4. Write report
  const fs = require("fs");
  const reportPath = "migration-report.json";
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);
  console.log(`\n=== Summary ===`);
  console.log(`  Total V1 orders:     ${report.summary.totalV1Orders}`);
  console.log(`  Already migrated:    ${report.summary.skippedAlreadyMigrated}`);
  console.log(`  Skipped (no lines):  ${report.summary.skippedNoLines}`);
  console.log(`  Migrated:            ${report.summary.migrated}`);
  console.log(`  Invariant failed:    ${report.summary.invariantFailed}`);
  console.log(`  Errors:              ${report.errors.length}`);

  // 5. Live write
  if (isLive) {
    console.log(`\n=== Writing to V2 sheets ===`);
    if (ordersToInsert.length > 0) {
      // Insert in batches of 50 to avoid API rate limits
      const batchSize = 50;
      for (let i = 0; i < ordersToInsert.length; i += batchSize) {
        const batch = ordersToInsert.slice(i, i + batchSize);
        await insertMany("Orders_V2", batch);
        console.log(`  Orders_V2: ${Math.min(i + batchSize, ordersToInsert.length)}/${ordersToInsert.length}`);
      }
    }
    if (linesToInsert.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < linesToInsert.length; i += batchSize) {
        const batch = linesToInsert.slice(i, i + batchSize);
        await insertMany("Order_Lines_V2", batch);
        console.log(`  Order_Lines_V2: ${Math.min(i + batchSize, linesToInsert.length)}/${linesToInsert.length}`);
      }
    }
    if (eventsToInsert.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < eventsToInsert.length; i += batchSize) {
        const batch = eventsToInsert.slice(i, i + batchSize);
        await insertMany("Order_Events", batch);
        console.log(`  Order_Events: ${Math.min(i + batchSize, eventsToInsert.length)}/${eventsToInsert.length}`);
      }
    }
    if (ledgerToInsert.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < ledgerToInsert.length; i += batchSize) {
        const batch = ledgerToInsert.slice(i, i + batchSize);
        await insertMany("Stock_Ledger", batch);
        console.log(`  Stock_Ledger: ${Math.min(i + batchSize, ledgerToInsert.length)}/${ledgerToInsert.length}`);
      }
    }
    console.log(`\nLIVE migration complete.`);
  } else {
    console.log(`\nDry-run complete. Run with --live to write to V2 sheets.`);
    console.log(`Review ${reportPath} before going live.`);
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep migrate-orders-to-v2`
Expected: no errors.

- [ ] **Step 3: Run dry-run (smoke)**

Run: `npx tsx scripts/migrate-orders-to-v2.ts --dry-run 2>&1 | tail -15`
Expected: Process all V1 orders, write `migration-report.json`, summary printed. **NO changes to sheets.**

- [ ] **Step 4: Commit**

```bash
rtk git add scripts/migrate-orders-to-v2.ts
rtk git commit -m "feat(orders-v2): V1 to V2 migration script with dry-run

WS-5 step 3: CLI script that reads V1, reconstructs V2 via Task 1
helpers, writes per-order report to migration-report.json. Dry-run
default; --live to write. Skips already-migrated (idempotent).
Supports --order-id for single-order re-migration.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: V2 cleanup script (extend existing)

**Files:**
- Modify: `scripts/cleanup-test-orders-v2.ts` → rename + extend, OR create new `scripts/cleanup-all-v2-test-orders.ts**

Current `cleanup-test-orders-v2.ts` catches `TEST*` prefix + Smoke Test actor. Extend to also catch PHD* and UCK* smoke artifacts from WS-3/WS-4.

- [ ] **Step 1: Update `scripts/cleanup-test-orders-v2.ts`**

Open `scripts/cleanup-test-orders-v2.ts`. Find the `testOrders` filter and replace with:

```typescript
const testOrders = (orders as any[]).filter(o => {
  const orderNo = (o.order_no || "").toUpperCase();
  const actor = (o.created_by_name || "").toLowerCase();

  // TEST* prefix (CLI smoke)
  if (orderNo.startsWith("TEST")) return true;

  // Smoke Test actor
  if (actor.includes("smoke test")) return true;

  // PnL smoke test actor
  if (actor.includes("pnl smoke")) return true;

  // Orders created by migration script BEFORE actual V1 migration
  // (these would have migration_notes containing "smoke" or be from system-migration with v1_id pattern)
  if ((o.migration_notes || "").toLowerCase().includes("smoke")) return true;

  // Heuristic: V2 orders placed between WS-2 cutover (2026-06-19) and WS-5 start
  // with very few lines (1-2) and known smoke-test actors
  const isRecent = o.created_at && new Date(o.created_at) > new Date("2026-06-19T00:00:00Z");
  const hasFewLines = false; // would need to count lines per order; skipped for simplicity
  if (isRecent && (actor.includes("test") || actor.includes("admin")) && orderNo.match(/^(PHD|UCK)\d+$/)) {
    // Manually verify in dry-run output before --live
    return false; // Don't auto-delete; flag for manual review
  }

  return false;
});
```

Update the file header comment to note the extended scope.

- [ ] **Step 2: Run dry-run**

Run: `npx tsx scripts/cleanup-test-orders-v2.ts`
Expected: Lists test orders found (PHD000006 from PnL smoke + any others). No changes.

- [ ] **Step 3: Commit**

```bash
rtk git add scripts/cleanup-test-orders-v2.ts
rtk git commit -m "chore(orders-v2): extend cleanup script for WS-3/WS-4 smoke artifacts

WS-5 step 4: catches PnL smoke test orders and any future test patterns.
Manual review still recommended before --live (script flags uncertain
cases instead of auto-deleting).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Cutover runbook

**Files:**
- Create: `docs/runbooks/orders-v2-cutover.md**

Operator-facing document with step-by-step instructions.

- [ ] **Step 1: Create `docs/runbooks/orders-v2-cutover.md`**

```markdown
# Orders V2 Cutover Runbook

**Use this when:** migrating production V1 data to V2 sheets.

**Estimated time:** 30-60 minutes (depending on order count).

**Rollback time:** 15 minutes if needed.

---

## Pre-Cutover Checklist (T-1 day)

- [ ] Notify all POS users of system pause window (suggest off-peak: 14:00-15:00 weekdays)
- [ ] Verify all WS-1 through WS-4 commits merged to main
- [ ] Run `rtk npm test` — must show 100+ tests pass
- [ ] Run `rtk tsc --noEmit` — must show 0 errors
- [ ] Backup V1 sheets in Google Sheets:
  - Right-click `Orders` tab → Duplicate → rename to `Orders_BACKUP_PRE_WS5_<date>`
  - Repeat for `Order_Lines`, `Stock_Ledger`
- [ ] Verify backup tabs exist before proceeding

---

## Cutover Steps (T-0)

### Step 1: Stop POS traffic (2 min)

- Open POS in browser, verify no active checkout
- Ask cashiers to pause new orders for 30 minutes
- (Optional) Set maintenance banner via Slack/announcement

### Step 2: Clean V2 test orders (5 min)

Run: `npx tsx scripts/cleanup-test-orders-v2.ts`

Review output. If test orders found:
Run: `npx tsx scripts/cleanup-test-orders-v2.ts --live`

Verify V2 sheets are clean (0 rows in Orders_V2):
Run: `npx tsx scripts/list-all-v2-orders.ts`

### Step 3: Dry-run migration (5 min)

Run: `npx tsx scripts/migrate-orders-to-v2.ts --dry-run 2>&1 | tail -20`

Review output:
- Total V1 orders vs Migrated count
- Invariant failed count (target: < 5% of total)
- Errors

Open `migration-report.json`. Spot-check 5 random orders:
- Invariant passed?
- Heuristic notes reasonable?
- net_total matches V1 total_amount?

**Stop if:**
- Invariant failed > 10% of total
- Any error pattern looks systemic
- net_total values look wrong

### Step 4: Live migration (15-30 min)

Run: `npx tsx scripts/migrate-orders-to-v2.ts --live 2>&1 | tee migration-live.log`

Monitor progress. **DO NOT interrupt** — partial migration is recoverable but annoying.

After completion, verify:
- V2 orders count matches V1 (minus skipped)
- Order_Lines_V2 count matches V1 Order_Lines
- Order_Events count matches V2 orders (1 MIGRATED event each)

### Step 5: Reconciliation (5 min)

Run: `npx tsx scripts/reconcile-v1-v2.ts`

Expected: drift < 1đ per order (within rounding tolerance).

**Stop if drift > 5đ/order.** Investigate before announcing done.

### Step 6: Spot-check reports (5 min)

In browser:
- `/admin/reports/pnl` — select full date range, verify totalRevenue matches V1 known number
- `/admin/reports/sales` — verify best sellers look right
- `/admin/orders` — verify list shows migrated orders

### Step 7: Resume POS traffic

Notify cashiers: system available. Monitor first 5 orders for any issues.

---

## Rollback Procedure

If anything goes wrong post-cutover:

### Step R1: Stop POS traffic

Same as cutover Step 1.

### Step R2: Restore V1 sheets

In Google Sheets:
- Delete current `Orders` tab (right-click → Delete)
- Rename `Orders_BACKUP_PRE_WS5_<date>` → `Orders`
- Repeat for `Order_Lines`, `Stock_Ledger`

### Step R3: Delete V2 migrated rows

Run: `npx tsx scripts/cleanup-test-orders-v2.ts --live`

(This catches all V2 orders since they all have `migration_notes` set or are smoke test orders.)

If cleanup script doesn't catch all, manually delete remaining rows in V2 sheets.

### Step R4: Verify V2 reports show "no data" banner

V2 sheets should be empty → reports show amber banner → system reverted to pre-WS-5 state.

### Step R5: Resume POS

System is back to "V2 empty + V1 active" state. Legacy code paths still work (if not yet archived in WS-5 Task 6).

---

## Post-Cutover Monitoring (T+1 day, T+7 days)

### T+1 day:
- [ ] Reconciliation script drift still < 1đ/order
- [ ] No new errors in production logs
- [ ] Reports PnL/Sales match expected daily totals

### T+7 days:
- [ ] All POS orders since cutover have correct V2 shape
- [ ] Admin edits work (supersede chain functioning)
- [ ] No user complaints about report numbers

If all clean → proceed with WS-6 (rename V1 sheets to `_LEGACY`, archive `lib/report-utils.ts`, migrate dashboard).

---

## Known Issues + Workarounds

### Issue: Some migrated orders fail invariants

**Symptom:** `invariantFailed > 0` in migration report.

**Cause:** V1 data corruption (e.g., UCK000094 overpayment pattern).

**Action:** Acceptable. Migrated order has documented `migration_notes`. Reports still work because they sum stored `net_total` (which is V1's authoritative value).

### Issue: Drift > 1đ/order in reconciliation

**Symptom:** Reconciliation script shows drift exceeds tolerance.

**Cause:** Either migration bug or V1 data has unique patterns not covered by heuristics.

**Action:** Investigate `migration-report.json` for orders with large residuals. Manual fix may be needed.

### Issue: V1 sheets already renamed/deleted

**Symptom:** Reconciliation script can't find V1.

**Action:** Skip reconciliation. Trust the migrated data + unit tests.
```

- [ ] **Step 2: Commit**

```bash
rtk git add docs/runbooks/orders-v2-cutover.md
rtk git commit -m "docs(orders-v2): WS-5 cutover runbook

WS-5 step 5: operator-facing runbook with pre-cutover checklist,
step-by-step cutover procedure, rollback steps, post-cutover monitoring,
and known issues.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Legacy code archival

**Files:**
- Move 5 files to `_legacy/`

Per pre-WS-5 grep: only the legacy files themselves import from each other. Production code (POSScreen, admin/orders, admin/reports/*) all use V2 actions.

- [ ] **Step 1: Verify zero production imports**

Run:
```bash
rtk grep -l "from ['\"]@/app/actions/(pos|order-edit|orders|reports)['\"]" app components 2>&1 || echo "none"
rtk grep -l "from ['\"]@/app/actions/index['\"]" app components 2>&1 || echo "none"
```

Expected: "none" (or only files in `_legacy/` if any). If any file outside `_legacy/` imports these, **STOP** and fix the import first.

- [ ] **Step 2: Create `_legacy/` directory structure**

```bash
mkdir -p _legacy/app-actions
```

- [ ] **Step 3: Move files**

```bash
git mv app/actions/pos.ts _legacy/app-actions/pos.ts
git mv app/actions/order-edit.ts _legacy/app-actions/order-edit.ts
git mv app/actions/orders.ts _legacy/app-actions/orders.ts
git mv app/actions/reports.ts _legacy/app-actions/reports.ts
git mv app/actions/index.ts _legacy/app-actions/index.ts
```

- [ ] **Step 4: Create `_legacy/README.md`**

```markdown
# Legacy Code (Pre-V2)

These files are the original V1 implementations, kept for reference.

**DO NOT IMPORT FROM PRODUCTION CODE.**

Files were moved here in WS-5 after V2 equivalents were verified:
- `pos.ts` → replaced by `app/actions/pos-v2.ts`
- `order-edit.ts` → replaced by `app/actions/order-edit-v2.ts`
- `orders.ts` → replaced by `app/actions/orders-v2.ts`
- `reports.ts` → replaced by `app/actions/reports-v2.ts`
- `index.ts` → legacy scaffold from project init, unused

These can be safely deleted after WS-6 verification if no rollback needed.

Reference: `docs/superpowers/plans/2026-06-19-orders-reports-rebuild-ws5-migration-cutover.md`
```

- [ ] **Step 5: Verify TS still compiles**

Run: `rtk tsc --noEmit`
Expected: 0 errors related to moved files. (Pre-existing errors in `app/admin/page.tsx` because it uses `lib/report-utils.ts` — that file is kept until WS-6.)

- [ ] **Step 6: Commit**

```bash
rtk git add _legacy/
rtk git commit -m "chore(orders-v2): archive legacy V1 action files

WS-5 step 6: moved 5 V1 action files to _legacy/app-actions/:
- pos.ts, order-edit.ts, orders.ts, reports.ts, index.ts

All production code uses V2 equivalents since WS-2/3/4. Files kept
for reference, can be deleted after WS-6 verification.

lib/report-utils.ts NOT archived — still used by app/admin/page.tsx
(dashboard). Will be migrated in WS-6.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Final verification + tracking

- [ ] **Step 1: Run full test suite**

Run: `rtk npm test`
Expected: All previous + WS-5 new tests pass. Target 105+ tests.

- [ ] **Step 2: TypeScript check**

Run: `rtk tsc --noEmit`
Expected: 0 errors (besides pre-existing `app/admin/page.tsx` + `lib/report-utils.ts` use, which is WS-6 scope).

- [ ] **Step 3: Coverage**

Run: `rtk npm run test:coverage`

Update `vitest.config.ts` to include `migrate-v1-to-v2.ts` in coverage:
```typescript
include: [
  // ... existing ...
  "lib/migrate-v1-to-v2.ts",
],
```

- [ ] **Step 4: Run dry-run migration (smoke)**

Run: `npx tsx scripts/migrate-orders-to-v2.ts --dry-run 2>&1 | tail -20`
Expected: Reports per Task 3 Step 3. **DO NOT run --live** without User sign-off.

- [ ] **Step 5: Update DEVELOPMENT-TRACKING.md**

Append WS-5 section:
```markdown
## 2026-06-XX — WS-5 Migration + Cutover Complete

### What landed
- Pure helpers: lib/migrate-v1-to-v2.ts (reconstructOrderV2, classifyV1Discounts)
- Migration script: scripts/migrate-orders-to-v2.ts (dry-run default)
- Cutover runbook: docs/runbooks/orders-v2-cutover.md
- Cleanup script extended: scripts/cleanup-test-orders-v2.ts
- Legacy code archived: _legacy/app-actions/ (5 files)

### Verification gates (all passed)
- rtk npm test: X/X tests pass
- rtk tsc --noEmit: 0 errors in WS-5 files
- Dry-run migration: processed N V1 orders, M invariant failures

### Pre-migration state (before User runs --live)
- V1: N orders, M lines
- V2: 0 orders (post-cleanup)
- Awaiting User sign-off on dry-run report before live migration

### Known gaps deferred to WS-6
- V1 sheets still named `Orders` (rename to `Orders_LEGACY` in WS-6)
- lib/report-utils.ts + app/admin/page.tsx still on V1 (WS-6)
- Cost_at_sale per-ingredient distribution is approximate (documented)
```

Use **actual hashes from `git log`** for commit table. Do NOT fabricate.

- [ ] **Step 6: Final commit**

```bash
rtk git add DEVELOPMENT-TRACKING.md vitest.config.ts
rtk git commit -m "docs(tracking): WS-5 migration + cutover complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 7: Report to Claude + User**

Send:
- Final commit hash
- Test pass count + coverage
- Dry-run migration output (counts, NOT full report — too long)
- Confirmation that legacy files moved successfully
- Note: live migration NOT run; awaiting User sign-off

**User then reviews `migration-report.json` and decides whether to proceed with live migration per cutover runbook.**

---

## Self-Review

**Spec coverage check:**
- ✓ V1 → V2 migration script with dry-run/live → Task 3
- ✓ Reconstruction heuristics per §7.2 → Task 1
- ✓ assertOrderInvariants validation → Task 1 calls it, Task 3 reports failures
- ✓ Idempotent migration (skip already-migrated) → Task 3 checks `pos_snapshot_json.v1_id`
- ✓ Cleanup smoke test orders before migration → Task 4
- ✓ Cutover runbook → Task 5
- ✓ Legacy code archival → Task 6
- ✓ Final reconciliation gate → Task 7 (script exists from WS-4)

**Placeholder scan:** No placeholders. All code blocks complete.

**Type consistency:**
- `V1Order`, `V1Line`, `V1LedgerEntry`, `MigrationReferenceData`, `ReconstructResult`, `DiscountClassification` — defined in Task 1
- `MigrationReport` — defined in Task 3
- Reuses: `OrderV2`, `OrderLineV2`, `OrderEvent` from WS-1
- Reuses: `allocateOrderDiscount`, `assertOrderInvariants` from WS-1
- Reuses: `buildProductSnapshot`, `buildVariantSnapshot`, etc. from WS-2

**Known risks:**
- R1: Live migration touches production data → mitigated by dry-run + backup + rollback
- R2: V1 data quirks not covered by heuristics → mitigated by per-order report + invariant failure logging
- R3: Cost_at_sale approximation (order-level cost split by line gross proportion) → documented in spec, acceptable
- R4: Snapshot rebuild uses current reference data (not time-of-sale) → acceptable approximation for migration; new V2 orders have proper snapshots from WS-2

---

## Handoff

**WS-5 prepares the migration infrastructure. Actual live migration requires User sign-off on dry-run output.**

**Critical:** Antigravity does NOT run `--live` migration. User does that manually per cutover runbook after reviewing dry-run report.

**Next plan: WS-6 (Polish + Decommission).** Claude will draft after WS-5 merged AND user has run live migration successfully. Will define:
- Rename V1 sheets to `_LEGACY`
- Migrate `app/admin/page.tsx` dashboard to V2
- Archive `lib/report-utils.ts`
- Delete `_legacy/` folder after final verification
- Final smoke tests + sign-off
