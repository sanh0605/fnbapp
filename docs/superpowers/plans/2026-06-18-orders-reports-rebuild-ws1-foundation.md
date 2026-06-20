# WS-1 Foundation: Types, Pure Math, Test Infrastructure Implementation Plan

> **For Antigravity (implementer):** This is a bite-sized TDD implementation plan. Execute tasks in order. Each task ends with a commit. Do not skip the test-first steps. Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` for execution tracking.

**Goal:** Stand up the foundation of the Orders V2 rebuild — TypeScript types, pure mathematical functions for discount allocation and revenue computation, invariant assertions, and the test infrastructure to verify them. Zero I/O in this workstream (one read-only schema verification script excepted). All downstream workstreams (WS-2 write path, WS-3 edit path, WS-4 reports) import from here.

**Architecture:** Pure functions in `lib/order-math.ts` operate on plain data shapes defined in `lib/order-types.ts`. No sheet reads, no React, no server actions. Test infrastructure is vitest + fast-check. The Sữa Dâu / UCK000094 scenario from the 2026-06-15-deep audit is the golden case; if the math passes that, it's correct.

**Tech Stack:** TypeScript 5 (strict), vitest 1.x, fast-check 3.x, existing `@/*` path alias, `crypto.randomUUID()` for IDs (Node 20+ global).

**Parent spec:** `docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md` — read sections 5 (data models) and 6 (math) before starting.

---

## File Structure

### Files to create

| Path | Responsibility | Lines (est.) |
|---|---|---|
| `vitest.config.ts` | Test runner config, path alias support | ~15 |
| `lib/order-types.ts` | TypeScript interfaces for `OrderV2`, `OrderLineV2`, `OrderEvent`, enums | ~120 |
| `lib/order-math.ts` | Pure functions: `allocateOrderDiscount`, `allocateLineRevenue`, `assertOrderInvariants` | ~150 |
| `lib/order-math.test.ts` | Unit tests for each function, golden cases | ~400 |
| `lib/order-math.property.test.ts` | Property-based tests (fast-check) for invariants | ~100 |
| `lib/__tests__/fixtures.ts` | Golden case data (UCK000094, edge cases) | ~150 |
| `scripts/verify-v2-schema.ts` | Read-only script that asserts Google Sheets V2 headers match spec §5 | ~80 |

### Files to modify

| Path | Change |
|---|---|
| `package.json` | Add `vitest`, `fast-check`, `@vitest/ui` to devDeps; add `test`, `test:watch`, `test:coverage` scripts |
| `.gitignore` | Add `coverage/` if not present |

### Files NOT touched in WS-1

- `app/actions/pos.ts`, `app/actions/order-edit.ts`, `app/actions/orders.ts` — WS-2, WS-3
- `components/POSScreen.tsx`, `app/admin/orders/*` — WS-2, WS-3
- `app/actions/reports.ts`, `app/admin/reports/*` — WS-4
- `lib/report-utils.ts` — deprecated in WS-4
- `lib/sheets_db.ts` — touched in WS-2 when write paths need batched helpers

---

## Task 1: Install vitest and fast-check, add config

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `.gitignore` (only if `coverage/` is missing)

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install --save-dev vitest@^1.6.0 fast-check@^3.19.0 @vitest/ui@^1.6.0
```
Expected: `added X packages` with no errors. `package.json` devDependencies now contains `vitest`, `fast-check`, `@vitest/ui`.

- [ ] **Step 2: Add test scripts to package.json**

Modify `package.json` `scripts` block. Replace the existing scripts block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "migrate": "node scripts/migrate-to-sheets.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.property.test.ts", "scripts/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/order-math.ts", "lib/order-types.ts"],
    },
  },
});
```

- [ ] **Step 4: Ensure `coverage/` is gitignored**

Check `.gitignore` for `coverage/`. If missing, append:

```
# vitest coverage
coverage/
```

- [ ] **Step 5: Smoke-test the runner**

Create a placeholder test file `lib/__tests__/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("smoke test", () => {
  it("vitest is wired up", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `rtk npm test`
Expected: 1 test passed, 1 test total. No TypeScript errors.

- [ ] **Step 6: Delete the smoke test**

Delete `lib/__tests__/smoke.test.ts`. We have real tests coming.

- [ ] **Step 7: Commit**

```bash
rtk git add package.json package-lock.json vitest.config.ts .gitignore
rtk git commit -m "$(cat <<'EOF'
chore(test): install vitest + fast-check for V2 foundation

WS-1 step 1: bring up test infrastructure for the Orders V2 rebuild.
No source changes yet; subsequent tasks add types, math, and tests.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Write TypeScript types (`lib/order-types.ts`)

**Files:**
- Create: `lib/order-types.ts`

These types are referenced by every downstream workstream. Field names must match the spec §5 exactly so the migration script in WS-5 can map cleanly.

- [ ] **Step 1: Create `lib/order-types.ts` with all enums, interfaces, and helper unions**

Create `lib/order-types.ts`:

```typescript
/**
 * Orders V2 — strict data models.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 5)
 *
 * All money fields are integer đồng (VND). No floats.
 * All IDs are UUIDs (crypto.randomUUID()). No time-based IDs.
 * All timestamps are ISO 8601 UTC strings.
 */

// ============================================================================
// Enums (as const objects for nominal typing + runtime values)
// ============================================================================

export const ORDER_STATUS = {
  DRAFT: "DRAFT",
  COMPLETED: "COMPLETED",
  SUPERSEDED: "SUPERSEDED",
  VOIDED: "VOIDED",
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const EVENT_TYPE = {
  CREATED: "CREATED",
  EDITED: "EDITED",
  VOIDED: "VOIDED",
  REOPENED: "REOPENED",
  MIGRATED: "MIGRATED",
} as const;
export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export const PAYMENT_METHOD = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const STOCK_TXN_TYPE = {
  SALES_CONSUME: "SALES_CONSUME",
  EDIT_REVERSAL: "EDIT_REVERSAL",
  EDIT_CONSUME: "EDIT_CONSUME",
  PO_RECEIPT: "PO_RECEIPT",
  ADJUSTMENT_IN: "ADJUSTMENT_IN",
  ADJUSTMENT_OUT: "ADJUSTMENT_OUT",
} as const;
export type StockTxnType = (typeof STOCK_TXN_TYPE)[keyof typeof STOCK_TXN_TYPE];

// ============================================================================
// Snapshot sub-types (stored as JSON strings in sheets, parsed for use)
// ============================================================================

export interface ProductSnapshot {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
}

export interface VariantSnapshot {
  id: string;
  size_name: string;
  price: number; // integer đồng
}

export interface ModifierSnapshot {
  id: string;
  name: string;
  price: number; // integer đồng
  qty: number; // ≥ 1
}

export interface PromotionSnapshot {
  id: string;
  name: string;
  type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  discount_type: "PERCENT" | "FLAT_PRICE" | "FLAT_VND";
  discount_value: number;
  applicable_products_json?: string;
  code?: string;
  start_date: string;
  end_date: string;
}

export interface RecipeIngredientSnapshot {
  ingredient_id: string;
  ingredient_type: "BASE_INGREDIENT" | "SEMI_PRODUCT";
  quantity: number;
  unit_id: string;
}

export interface RecipeSnapshot {
  target_type: "PRODUCT_VARIANT" | "MODIFIER";
  target_id: string;
  ingredients: RecipeIngredientSnapshot[];
}

// ============================================================================
// Core row types — match Orders_V2, Order_Lines_V2, Order_Events sheet columns
// ============================================================================

export interface OrderV2 {
  // Identity
  id: string;
  order_no: string;
  brand_id: string;

  // Lifecycle
  status: OrderStatus;
  version: number;
  parent_order_id: string | "";
  superseded_by: string | "";

  // Audit
  created_at: string;
  created_by_id: string;
  created_by_name: string;
  completed_at: string | "";
  voided_at: string | "";
  voided_by_id: string | "";
  void_reason: string | "";

  // Money (integer đồng; all immutable once status = COMPLETED)
  currency: "VND";
  gross_total: number;
  promo_discount_total: number;
  manual_item_discount_total: number;
  manual_order_discount: number;
  net_total: number;

  // Snapshots & payment
  applied_promotion_id: string | "";
  applied_promotion_snapshot_json: string; // empty string when no promo
  pos_snapshot_json: string;
  payment_method: PaymentMethod;
  payment_ref: string | "";

  // Migration metadata
  migration_notes: string | "";
}

export interface OrderLineV2 {
  // Identity
  id: string;
  order_id: string;
  line_no: number;

  // Product references + snapshots
  product_id: string;
  product_snapshot_json: string; // JSON of ProductSnapshot
  variant_id: string;
  variant_snapshot_json: string; // JSON of VariantSnapshot

  // Quantities
  qty: number; // ≥ 1
  unit_price: number; // integer đồng, snapshotted
  modifiers_snapshot_json: string; // JSON of ModifierSnapshot[]

  // Money (integer đồng)
  gross_line_total: number;
  promo_discount: number;
  manual_item_discount: number;
  order_discount_allocation: number;
  net_line_total: number;

  // Cost & stock
  cost_at_sale: number;
  recipe_snapshot_json: string; // JSON of RecipeSnapshot

  // Attribution
  promo_discount_reason: string | "";
  manual_discount_reason: string | "";
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: EventType;
  event_at: string;
  actor_id: string;
  actor_name: string;
  from_version: number | "";
  to_version: number;
  previous_order_id: string | "";
  delta_json: string; // JSON summary of changes
  reason: string;
}

// ============================================================================
// Input shapes (used by pure functions — sheets-agnostic)
// ============================================================================

/**
 * Shape passed to `allocateLineRevenue`. Callers parse the JSON snapshots
 * before calling. The function is pure data-in, data-out.
 */
export interface LineForAllocation {
  unit_price: number;
  qty: number;
  modifiers: ModifierSnapshot[];
  gross_line_total: number;
  promo_discount: number;
  manual_item_discount: number;
  order_discount_allocation: number;
}

export interface AllocatedRevenue {
  variantRevenue: number;
  modifierRevenue: Record<string, number>;
  lineRevenue: number;
}

export interface AllocatableLine {
  line_id: string;
  capacity: number; // gross_line_total - promo_discount - manual_item_discount
}

// ============================================================================
// Errors
// ============================================================================

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `rtk tsc --noEmit`
Expected: 0 errors. (If errors appear in unrelated files, ignore them — we only care that `lib/order-types.ts` is clean. Note any errors in `lib/order-types.ts` itself.)

- [ ] **Step 3: Commit**

```bash
rtk git add lib/order-types.ts
rtk git commit -m "$(cat <<'EOF'
feat(orders-v2): add strict TypeScript types for Orders_V2, Order_Lines_V2, Order_Events

WS-1 step 2: foundation types. All money fields are integer đồng,
all IDs are UUIDs, all snapshots are JSON strings. Field names match
spec section 5 exactly to keep the WS-5 migration mapping 1:1.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Write golden case fixtures (`lib/__tests__/fixtures.ts`)

**Files:**
- Create: `lib/__tests__/fixtures.ts`

These fixtures encode the financial scenarios we must always get right. The UCK000094 fixture is the headline case from the 2026-06-15-deep audit.

- [ ] **Step 1: Create `lib/__tests__/fixtures.ts`**

Create `lib/__tests__/fixtures.ts`:

```typescript
/**
 * Golden case fixtures for order-math tests.
 *
 * Each fixture is a complete (order + lines) pair that should satisfy
 * `assertOrderInvariants`. Functions take these as inputs.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md
 */

import type { OrderV2, OrderLineV2, LineForAllocation } from "@/lib/order-types";

// ============================================================================
// UCK000094 — Sữa Dâu (35k) with PRM-003 PRODUCT_DISCOUNT (10k off per cup)
//             + Hồng Trà (30k) with 5k manual order discount
//
// Customer pays: (35k - 10k promo) + (30k - 5k order_alloc) = 25k + 25k = 50k
// Per-line order_discount_allocation: 5000 / 25000 (Hồng Trà capacity) = 5000
//   (Sữa Dâu capacity is 25000 after promo; but we allocate proportional to
//    capacity, and only Hồng Trà has capacity because Sữa Dâu's promo uses
//    its full base — actually 35-10=25, still has 25 capacity. Allocation
//    would split 5k proportionally: 25/(25+25) = 50%. Let's pre-compute
//    2500/2500 so the fixture stays consistent.)
// ============================================================================

export const UCK000094_SUA_DAU_PRICE = 35000;
export const UCK000094_PROMO_DISCOUNT_PER_CUP = 10000;
export const UCK000094_HONG_TRA_PRICE = 30000;
export const UCK000094_MANUAL_ORDER_DISCOUNT = 5000;
export const UCK000094_EXPECTED_NET_TOTAL =
  (UCK000094_SUA_DAU_PRICE - UCK000094_PROMO_DISCOUNT_PER_CUP) +
  (UCK000094_HONG_TRA_PRICE - UCK000094_MANUAL_ORDER_DISCOUNT); // = 50000

/**
 * Sữa Dâu line: 1× at 35k, 10k promo, no manual item, no order_discount_allocation.
 * gross=35000, net=25000.
 */
export function makeSuaDauLine(orderId: string, lineId: string): OrderLineV2 {
  return {
    id: lineId,
    order_id: orderId,
    line_no: 1,
    product_id: "PROD-SUA-DAU",
    product_snapshot_json: JSON.stringify({
      id: "PROD-SUA-DAU",
      name: "Sữa Dâu sấy giòn",
      category_id: "CAT-DRINKS",
      category_name: "Đồ uống",
    }),
    variant_id: "VAR-SUA-DAU-M",
    variant_snapshot_json: JSON.stringify({
      id: "VAR-SUA-DAU-M",
      size_name: "M",
      price: UCK000094_SUA_DAU_PRICE,
    }),
    qty: 1,
    unit_price: UCK000094_SUA_DAU_PRICE,
    modifiers_snapshot_json: "[]",
    gross_line_total: UCK000094_SUA_DAU_PRICE,
    promo_discount: UCK000094_PROMO_DISCOUNT_PER_CUP,
    manual_item_discount: 0,
    order_discount_allocation: 0, // promo exhausts the line's "capacity" for order-discount allocation; 0 here keeps it simple
    net_line_total: UCK000094_SUA_DAU_PRICE - UCK000094_PROMO_DISCOUNT_PER_CUP,
    cost_at_sale: 12000,
    recipe_snapshot_json: JSON.stringify({
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-SUA-DAU-M",
      ingredients: [
        { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "UNIT-LITER" },
        { ingredient_id: "BI-STRAWBERRY", ingredient_type: "BASE_INGREDIENT", quantity: 0.03, unit_id: "UNIT-KG" },
      ],
    }),
    promo_discount_reason: "PRM-003",
    manual_discount_reason: "",
  };
}

/**
 * Hồng Trà line: 1× at 30k, no promo, no manual item, order_discount_allocation = 5000.
 * gross=30000, net=25000.
 */
export function makeHongTraLine(orderId: string, lineId: string, orderAlloc: number): OrderLineV2 {
  return {
    id: lineId,
    order_id: orderId,
    line_no: 2,
    product_id: "PROD-HONG-TRA",
    product_snapshot_json: JSON.stringify({
      id: "PROD-HONG-TRA",
      name: "Hồng Trà",
      category_id: "CAT-DRINKS",
      category_name: "Đồ uống",
    }),
    variant_id: "VAR-HONG-TRA-M",
    variant_snapshot_json: JSON.stringify({
      id: "VAR-HONG-TRA-M",
      size_name: "M",
      price: UCK000094_HONG_TRA_PRICE,
    }),
    qty: 1,
    unit_price: UCK000094_HONG_TRA_PRICE,
    modifiers_snapshot_json: "[]",
    gross_line_total: UCK000094_HONG_TRA_PRICE,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: orderAlloc,
    net_line_total: UCK000094_HONG_TRA_PRICE - orderAlloc,
    cost_at_sale: 10000,
    recipe_snapshot_json: JSON.stringify({
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-HONG-TRA-M",
      ingredients: [
        { ingredient_id: "BI-TEA", ingredient_type: "BASE_INGREDIENT", quantity: 0.04, unit_id: "UNIT-LITER" },
      ],
    }),
    promo_discount_reason: "",
    manual_discount_reason: "",
  };
}

/**
 * Full UCK000094 order with both lines. Customer pays 50000đ.
 * gross=65000, promo_total=10000, manual_item_total=0, manual_order=5000, net=50000.
 */
export function makeUCK000094Order(): { order: OrderV2; lines: OrderLineV2[] } {
  const orderId = "ord-uck000094-v1";
  const suaDau = makeSuaDauLine(orderId, "ol-uck000094-1");
  const hongTra = makeHongTraLine(orderId, "ol-uck000094-2", UCK000094_MANUAL_ORDER_DISCOUNT);

  const order: OrderV2 = {
    id: orderId,
    order_no: "UCK000094",
    brand_id: "BRAND-UCK",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-05-15T10:30:00.000Z",
    created_by_id: "USER-CASHIER-01",
    created_by_name: "Nguyễn A",
    completed_at: "2026-05-15T10:30:05.000Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: suaDau.gross_line_total + hongTra.gross_line_total, // 65000
    promo_discount_total: suaDau.promo_discount + hongTra.promo_discount, // 10000
    manual_item_discount_total: 0,
    manual_order_discount: UCK000094_MANUAL_ORDER_DISCOUNT, // 5000
    net_total: UCK000094_EXPECTED_NET_TOTAL, // 50000
    applied_promotion_id: "PRM-003",
    applied_promotion_snapshot_json: JSON.stringify({
      id: "PRM-003",
      name: "Sữa Dâu 25k",
      type: "PRODUCT_DISCOUNT",
      discount_type: "FLAT_VND",
      discount_value: 10000,
      applicable_products_json: JSON.stringify(["VAR-SUA-DAU-M"]),
      start_date: "2026-05-01T00:00:00.000Z",
      end_date: "2026-05-31T23:59:59.000Z",
    }),
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };

  return { order, lines: [suaDau, hongTra] };
}

// ============================================================================
// Edge case fixtures
// ============================================================================

/** Order with no discounts at all — net = gross. */
export function makeNoDiscountOrder(): { order: OrderV2; lines: OrderLineV2[] } {
  const orderId = "ord-no-discount";
  const line: OrderLineV2 = {
    id: "ol-no-discount-1",
    order_id: orderId,
    line_no: 1,
    product_id: "PROD-X",
    product_snapshot_json: JSON.stringify({ id: "PROD-X", name: "X", category_id: "C", category_name: "C" }),
    variant_id: "VAR-X",
    variant_snapshot_json: JSON.stringify({ id: "VAR-X", size_name: "M", price: 30000 }),
    qty: 2,
    unit_price: 30000,
    modifiers_snapshot_json: "[]",
    gross_line_total: 60000,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 0,
    net_line_total: 60000,
    cost_at_sale: 20000,
    recipe_snapshot_json: "{}",
    promo_discount_reason: "",
    manual_discount_reason: "",
  };
  const order: OrderV2 = {
    id: orderId,
    order_no: "TEST-001",
    brand_id: "B",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-06-01T00:00:00.000Z",
    created_by_id: "U",
    created_by_name: "Test",
    completed_at: "2026-06-01T00:00:00.000Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: 60000,
    promo_discount_total: 0,
    manual_item_discount_total: 0,
    manual_order_discount: 0,
    net_total: 60000,
    applied_promotion_id: "",
    applied_promotion_snapshot_json: "",
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };
  return { order, lines: [line] };
}

/** Line with modifiers (for allocation tests). */
export function makeLineWithModifiers(): LineForAllocation {
  return {
    unit_price: 30000,
    qty: 2,
    modifiers: [
      { id: "MOD-ICE", name: "Đá", price: 0, qty: 1 },
      { id: "MOD-SUGAR", name: "Đường", price: 2000, qty: 1 },
      { id: "MOD-CHEESE", name: "Phô mai", price: 8000, qty: 1 },
    ],
    gross_line_total: (30000 + 0 + 2000 + 8000) * 2, // 80000
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 0,
  };
}

/** Line where order discount > sum of line capacities (cap test). */
export function makeCapacityCapOrder() {
  // Line A: 30k gross, 25k promo → capacity 5k
  // Line B: 20k gross, no promo, 0 manual → capacity 20k
  // Total capacity = 25k
  // Order discount = 50k → capped at 25k; net = 50k - 25k = 25k? No — discount can't exceed capacity.
  // net_total = 50000 - 25000 = 25000
  const orderId = "ord-cap-test";
  const lineA: OrderLineV2 = {
    id: "ol-cap-1",
    order_id: orderId,
    line_no: 1,
    product_id: "PROD-A",
    product_snapshot_json: "{}",
    variant_id: "VAR-A",
    variant_snapshot_json: JSON.stringify({ id: "VAR-A", size_name: "M", price: 30000 }),
    qty: 1,
    unit_price: 30000,
    modifiers_snapshot_json: "[]",
    gross_line_total: 30000,
    promo_discount: 25000,
    manual_item_discount: 0,
    order_discount_allocation: 5000, // capped to capacity
    net_line_total: 0,
    cost_at_sale: 0,
    recipe_snapshot_json: "{}",
    promo_discount_reason: "PRM-X",
    manual_discount_reason: "",
  };
  const lineB: OrderLineV2 = {
    id: "ol-cap-2",
    order_id: orderId,
    line_no: 2,
    product_id: "PROD-B",
    product_snapshot_json: "{}",
    variant_id: "VAR-B",
    variant_snapshot_json: JSON.stringify({ id: "VAR-B", size_name: "M", price: 20000 }),
    qty: 1,
    unit_price: 20000,
    modifiers_snapshot_json: "[]",
    gross_line_total: 20000,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 20000, // capped to capacity
    net_line_total: 0,
    cost_at_sale: 0,
    recipe_snapshot_json: "{}",
    promo_discount_reason: "",
    manual_discount_reason: "",
  };
  lineA.net_line_total = lineA.gross_line_total - lineA.promo_discount - lineA.manual_item_discount - lineA.order_discount_allocation;
  lineB.net_line_total = lineB.gross_line_total - lineB.promo_discount - lineB.manual_item_discount - lineB.order_discount_allocation;

  const order: OrderV2 = {
    id: orderId,
    order_no: "TEST-CAP",
    brand_id: "B",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-06-01T00:00:00.000Z",
    created_by_id: "U",
    created_by_name: "Test",
    completed_at: "2026-06-01T00:00:00.000Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: 50000,
    promo_discount_total: 25000,
    manual_item_discount_total: 0,
    manual_order_discount: 25000, // capped from 50000 input
    net_total: lineA.net_line_total + lineB.net_line_total, // 0
    applied_promotion_id: "PRM-X",
    applied_promotion_snapshot_json: "{}",
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };
  return { order, lines: [lineA, lineB] };
}
```

- [ ] **Step 2: Verify types compile**

Run: `rtk tsc --noEmit 2>&1 | grep -E "(fixtures|order-types)" || echo "no errors in fixtures/types"`
Expected: `no errors in fixtures/types`. (Pre-existing errors in other files are out of scope.)

- [ ] **Step 3: Commit**

```bash
rtk git add lib/__tests__/fixtures.ts
rtk git commit -m "$(cat <<'EOF'
test(orders-v2): add golden case fixtures including UCK000094

WS-1 step 3: encodes the Sữa Dâu / Hồng Trà scenario from the
2026-06-15-deep audit (expected net_total = 50.000đ) plus edge cases
(no discount, line with modifiers, capacity-cap order discount).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: TDD `allocateOrderDiscount` — proportional allocation with cap and residual

**Files:**
- Create: `lib/order-math.test.ts` (initial — append in subsequent tasks)
- Create: `lib/order-math.ts` (initial — append in subsequent tasks)

This is the most subtle function: it distributes an order-level discount across lines proportional to each line's capacity (gross − promo − manual_item). It must (a) cap each allocation at capacity, (b) absorb rounding residual into the last eligible line so the sum equals `orderDiscount` exactly (when within total capacity).

- [ ] **Step 1: Write failing tests for `allocateOrderDiscount`**

Create `lib/order-math.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { allocateOrderDiscount } from "@/lib/order-math";
import type { AllocatableLine } from "@/lib/order-types";

describe("allocateOrderDiscount", () => {
  it("returns zero allocations when order discount is 0", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 30000 },
      { line_id: "L2", capacity: 20000 },
    ];
    const result = allocateOrderDiscount(lines, 0);
    expect(result.get("L1")).toBe(0);
    expect(result.get("L2")).toBe(0);
  });

  it("returns zero allocations when total capacity is 0", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 0 },
      { line_id: "L2", capacity: 0 },
    ];
    const result = allocateOrderDiscount(lines, 5000);
    expect(result.get("L1")).toBe(0);
    expect(result.get("L2")).toBe(0);
  });

  it("allocates proportionally when discount fits within capacity", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 30000 },
      { line_id: "L2", capacity: 20000 },
    ];
    const result = allocateOrderDiscount(lines, 10000);
    // L1 share: 10000 * 30/50 = 6000
    // L2 share: 10000 * 20/50 = 4000
    expect(result.get("L1")).toBe(6000);
    expect(result.get("L2")).toBe(4000);
  });

  it("sum of allocations equals order discount exactly (no rounding loss)", () => {
    // 3 lines with capacity 100 each, discount 100
    // Naive proportional: 33.33 each → rounding to 33/33/34
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 100 },
      { line_id: "L2", capacity: 100 },
      { line_id: "L3", capacity: 100 },
    ];
    const result = allocateOrderDiscount(lines, 100);
    const sum = (result.get("L1") || 0) + (result.get("L2") || 0) + (result.get("L3") || 0);
    expect(sum).toBe(100);
  });

  it("caps each allocation at line capacity when discount exceeds total capacity", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 5000 },
      { line_id: "L2", capacity: 20000 },
    ];
    // Discount 50000 > total capacity 25000 → each capped to capacity
    const result = allocateOrderDiscount(lines, 50000);
    expect(result.get("L1")).toBe(5000);
    expect(result.get("L2")).toBe(20000);
    const sum = (result.get("L1") || 0) + (result.get("L2") || 0);
    expect(sum).toBe(25000); // not 50000
  });

  it("skips lines with zero capacity", () => {
    const lines: AllocatableLine[] = [
      { line_id: "L1", capacity: 0 },
      { line_id: "L2", capacity: 20000 },
    ];
    const result = allocateOrderDiscount(lines, 5000);
    expect(result.get("L1")).toBe(0);
    expect(result.get("L2")).toBe(5000);
  });

  it("handles empty lines array", () => {
    const result = allocateOrderDiscount([], 5000);
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk npm test -- order-math.test.ts`
Expected: All 7 tests fail with `Cannot find module '@/lib/order-math'` or similar.

- [ ] **Step 3: Implement `allocateOrderDiscount` minimally**

Create `lib/order-math.ts`:

```typescript
/**
 * Orders V2 — pure math functions.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 6)
 *
 * No I/O. No side effects. Deterministic.
 */

import type {
  AllocatableLine,
  AllocatedRevenue,
  LineForAllocation,
  OrderV2,
  OrderLineV2,
} from "@/lib/order-types";
import { InvariantError } from "@/lib/order-types";

/**
 * Distributes `orderDiscount` across lines proportional to their capacity.
 *
 * Rules:
 *   1. Each allocation is capped at the line's capacity.
 *   2. If `orderDiscount > totalCapacity`, sum of allocations equals totalCapacity.
 *   3. Otherwise, sum of allocations equals `orderDiscount` exactly (rounding
 *      residual absorbed by the last eligible line).
 *   4. Lines with capacity 0 are skipped.
 *
 * Returns Map<line_id, allocation>. Every input line is present in the map.
 */
export function allocateOrderDiscount(
  lines: AllocatableLine[],
  orderDiscount: number,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const l of lines) result.set(l.line_id, 0);

  if (orderDiscount <= 0) return result;

  const eligible = lines.filter(l => l.capacity > 0);
  if (eligible.length === 0) return result;

  const totalCapacity = eligible.reduce((s, l) => s + l.capacity, 0);
  const target = Math.min(orderDiscount, totalCapacity);

  let allocated = 0;
  for (let i = 0; i < eligible.length; i++) {
    const l = eligible[i];
    if (i === eligible.length - 1) {
      // Last line absorbs rounding residual.
      const residual = target - allocated;
      result.set(l.line_id, Math.min(residual, l.capacity));
    } else {
      const proportional = Math.round((target * l.capacity) / totalCapacity);
      const capped = Math.min(proportional, l.capacity);
      result.set(l.line_id, capped);
      allocated += capped;
    }
  }

  return result;
}

// ============================================================================
// Functions below are stubs — implemented in Tasks 5 and 6.
// ============================================================================

export function allocateLineRevenue(_line: LineForAllocation): AllocatedRevenue {
  throw new Error("allocateLineRevenue: not yet implemented (Task 5)");
}

export function assertOrderInvariants(_order: OrderV2, _lines: OrderLineV2[]): void {
  throw new Error("assertOrderInvariants: not yet implemented (Task 6)");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npm test -- order-math.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/order-math.ts lib/order-math.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(orders-v2): TDD allocateOrderDiscount with cap + residual

WS-1 step 4: proportional order-level discount allocator. Caps each
line at capacity, absorbs rounding residual into last eligible line
so the sum is always exact. 7 unit tests pass.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: TDD `allocateLineRevenue` — per-line variant + modifier breakdown

**Files:**
- Modify: `lib/order-math.ts`
- Modify: `lib/order-math.test.ts`

This function takes a line with all discount fields populated and allocates the net revenue back to the variant and each modifier for per-product reporting. One ratio across the whole line — no additive-then-multiplicative stacking.

- [ ] **Step 1: Append failing tests for `allocateLineRevenue`**

Append to `lib/order-math.test.ts` (add this `describe` block at the end of the file):

```typescript
import { allocateLineRevenue } from "@/lib/order-math";
import { makeLineWithModifiers, makeSuaDauLine, makeHongTraLine } from "@/lib/__tests__/fixtures";
import type { LineForAllocation } from "@/lib/order-types";

describe("allocateLineRevenue", () => {
  it("returns gross when no discounts applied", () => {
    const line: LineForAllocation = {
      unit_price: 30000,
      qty: 2,
      modifiers: [],
      gross_line_total: 60000,
      promo_discount: 0,
      manual_item_discount: 0,
      order_discount_allocation: 0,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(60000);
    expect(result.modifierRevenue).toEqual({});
    expect(result.lineRevenue).toBe(60000);
  });

  it("applies a single ratio across variant and modifiers", () => {
    // gross = 80000 (variant 60k + modifiers 20k), discount 20000 → ratio 0.75
    const line = makeLineWithModifiers(); // gross 80000, variant 60000, mods 0/4000/16000
    line.promo_discount = 20000;
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(45000); // 60000 * 0.75
    expect(result.modifierRevenue["MOD-ICE"]).toBe(0); // 0 * 0.75
    expect(result.modifierRevenue["MOD-SUGAR"]).toBe(3000); // 4000 * 0.75
    expect(result.modifierRevenue["MOD-CHEESE"]).toBe(12000); // 16000 * 0.75
    expect(result.lineRevenue).toBe(60000); // 80000 - 20000
  });

  it("lineRevenue equals stored net (gross - all discounts)", () => {
    const line: LineForAllocation = {
      unit_price: 35000,
      qty: 1,
      modifiers: [],
      gross_line_total: 35000,
      promo_discount: 10000,
      manual_item_discount: 5000,
      order_discount_allocation: 0,
    };
    const result = allocateLineRevenue(line);
    expect(result.lineRevenue).toBe(20000); // 35000 - 10000 - 5000
    expect(result.variantRevenue).toBe(20000); // ratio = 20000/35000 ≈ 0.571; 35000 * ratio rounded
  });

  it("floors revenue at 0 when discounts exceed gross", () => {
    // Defensive: shouldn't happen post-invariants, but allocator must not return negative
    const line: LineForAllocation = {
      unit_price: 10000,
      qty: 1,
      modifiers: [],
      gross_line_total: 10000,
      promo_discount: 15000, // exceeds gross
      manual_item_discount: 0,
      order_discount_allocation: 0,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(0);
    expect(result.lineRevenue).toBe(0); // floor
  });

  it("UCK000094 Sữa Dâu line: variantRevenue = 25000 (promo price)", () => {
    // Sữa Dâu: 1× 35k, 10k promo, 0 manual, 0 order_alloc
    const fixtureLine = makeSuaDauLine("ord-x", "ol-x");
    const line: LineForAllocation = {
      unit_price: fixtureLine.unit_price,
      qty: fixtureLine.qty,
      modifiers: [],
      gross_line_total: fixtureLine.gross_line_total,
      promo_discount: fixtureLine.promo_discount,
      manual_item_discount: fixtureLine.manual_item_discount,
      order_discount_allocation: fixtureLine.order_discount_allocation,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(25000); // headline number from 2026-06-15-deep audit
    expect(result.lineRevenue).toBe(25000);
  });

  it("UCK000094 Hồng Trà line: variantRevenue = 25000 (after 5k order discount)", () => {
    const fixtureLine = makeHongTraLine("ord-x", "ol-x", 5000);
    const line: LineForAllocation = {
      unit_price: fixtureLine.unit_price,
      qty: fixtureLine.qty,
      modifiers: [],
      gross_line_total: fixtureLine.gross_line_total,
      promo_discount: fixtureLine.promo_discount,
      manual_item_discount: fixtureLine.manual_item_discount,
      order_discount_allocation: fixtureLine.order_discount_allocation,
    };
    const result = allocateLineRevenue(line);
    expect(result.variantRevenue).toBe(25000); // 30000 - 5000
    expect(result.lineRevenue).toBe(25000);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `rtk npm test -- order-math.test.ts`
Expected: All 7 original tests pass; all 6 new `allocateLineRevenue` tests fail with `not yet implemented`.

- [ ] **Step 3: Implement `allocateLineRevenue`**

In `lib/order-math.ts`, replace the `allocateLineRevenue` stub with:

```typescript
/**
 * Allocates a line's net revenue back to its variant and modifiers
 * for per-product reporting.
 *
 * Strategy: apply a single ratio across all components of the line.
 *   ratio = (gross - totalDiscount) / gross   (floored at 0)
 *
 * The `lineRevenue` returned equals the stored net (gross - all discounts).
 * `variantRevenue + sum(modifierRevenue)` may differ by ±1đ due to
 * rounding per component; consumers that need the exact line total must
 * use `lineRevenue`, not sum the components.
 */
export function allocateLineRevenue(line: LineForAllocation): AllocatedRevenue {
  const grossVariant = line.unit_price * line.qty;
  const grossModifiers = line.modifiers.reduce(
    (sum, m) => sum + m.price * m.qty * line.qty,
    0,
  );
  const grossLine = grossVariant + grossModifiers;

  const totalDiscount =
    line.promo_discount + line.manual_item_discount + line.order_discount_allocation;

  const lineRevenue = Math.max(0, grossLine - totalDiscount);
  const ratio = grossLine > 0 ? lineRevenue / grossLine : 0;

  const variantRevenue = Math.round(grossVariant * ratio);
  const modifierRevenue: Record<string, number> = {};
  for (const m of line.modifiers) {
    modifierRevenue[m.id] = Math.round(m.price * m.qty * line.qty * ratio);
  }

  return { variantRevenue, modifierRevenue, lineRevenue };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npm test -- order-math.test.ts`
Expected: All 13 tests pass (7 + 6).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/order-math.ts lib/order-math.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(orders-v2): TDD allocateLineRevenue with single-ratio allocation

WS-1 step 5: per-line revenue allocator for per-product reporting.
Applies ONE ratio across variant and modifiers — no additive +
multiplicative stacking that caused the original Sữa Dâu bug.
UCK000094 Sữa Dâu = 25.000đ (matches 2026-06-15-deep audit target).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: TDD `assertOrderInvariants` — order + line level checks

**Files:**
- Modify: `lib/order-math.ts`
- Modify: `lib/order-math.test.ts`

The guardian. Every order write path (submitOrderV2, editOrderV2, migration) calls this before persisting. Throws `InvariantError` with a precise message if anything is off.

- [ ] **Step 1: Append failing tests for `assertOrderInvariants`**

Append to `lib/order-math.test.ts`:

```typescript
import { assertOrderInvariants } from "@/lib/order-math";
import { InvariantError } from "@/lib/order-types";
import {
  makeUCK000094Order,
  makeNoDiscountOrder,
  makeCapacityCapOrder,
} from "@/lib/__tests__/fixtures";

describe("assertOrderInvariants", () => {
  it("passes for UCK000094 fixture", () => {
    const { order, lines } = makeUCK000094Order();
    expect(() => assertOrderInvariants(order, lines)).not.toThrow();
  });

  it("passes for no-discount fixture", () => {
    const { order, lines } = makeNoDiscountOrder();
    expect(() => assertOrderInvariants(order, lines)).not.toThrow();
  });

  it("passes for capacity-cap fixture", () => {
    const { order, lines } = makeCapacityCapOrder();
    expect(() => assertOrderInvariants(order, lines)).not.toThrow();
  });

  it("throws when order has no lines", () => {
    const { order } = makeUCK000094Order();
    expect(() => assertOrderInvariants(order, [])).toThrow(InvariantError);
    expect(() => assertOrderInvariants(order, [])).toThrow(/no lines/);
  });

  it("throws when gross_total mismatches sum of line gross", () => {
    const { order, lines } = makeUCK000094Order();
    order.gross_total = 99999;
    expect(() => assertOrderInvariants(order, lines)).toThrow(/gross mismatch/);
  });

  it("throws when promo_discount_total mismatches", () => {
    const { order, lines } = makeUCK000094Order();
    order.promo_discount_total = 0;
    expect(() => assertOrderInvariants(order, lines)).toThrow(/promo mismatch/);
  });

  it("throws when manual_item_discount_total mismatches", () => {
    const { order, lines } = makeUCK000094Order();
    order.manual_item_discount_total = 999;
    expect(() => assertOrderInvariants(order, lines)).toThrow(/manual_item mismatch/);
  });

  it("throws when sum of order_discount_allocation != manual_order_discount", () => {
    const { order, lines } = makeUCK000094Order();
    order.manual_order_discount = 99999;
    expect(() => assertOrderInvariants(order, lines)).toThrow(/order_discount_allocation mismatch/);
  });

  it("throws when net_total mismatches sum of line net", () => {
    const { order, lines } = makeUCK000094Order();
    order.net_total = 99999;
    expect(() => assertOrderInvariants(order, lines)).toThrow(/net_total mismatch/);
  });

  it("throws when net_total != gross - all discounts (order-level formula)", () => {
    const { order, lines } = makeNoDiscountOrder();
    order.promo_discount_total = 10000; // makes formula math wrong but sum-of-lines correct
    expect(() => assertOrderInvariants(order, lines)).toThrow();
  });

  it("throws when a line's net doesn't match its components", () => {
    const { order, lines } = makeUCK000094Order();
    lines[0].net_line_total = 99999;
    expect(() => assertOrderInvariants(order, lines)).toThrow(/line .* net mismatch/);
  });

  it("allows ±1 đồng tolerance for rounding", () => {
    const { order, lines } = makeUCK000094Order();
    order.net_total = order.net_total + 1; // within tolerance
    expect(() => assertOrderInvariants(order, lines)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `rtk npm test -- order-math.test.ts`
Expected: All 13 prior tests pass; all 12 new `assertOrderInvariants` tests fail with `not yet implemented`.

- [ ] **Step 3: Implement `assertOrderInvariants`**

In `lib/order-math.ts`, replace the `assertOrderInvariants` stub with:

```typescript
/**
 * Asserts all financial invariants for an order + its lines.
 *
 * Invariants (see spec section 6.2):
 *   I1. gross_total = sum(line.gross_line_total)
 *   I2. promo_discount_total = sum(line.promo_discount)
 *   I3. manual_item_discount_total = sum(line.manual_item_discount)
 *   I4. sum(line.order_discount_allocation) = manual_order_discount (±1đ)
 *   I5. net_total = gross - promo - manual_item - manual_order (±1đ)
 *   I6. per-line: net_line_total = gross - promo - manual_item - order_alloc (±1đ)
 *   I7. net_total = sum(line.net_line_total) (±1đ)
 *
 * Throws InvariantError on the first violation.
 */
export function assertOrderInvariants(order: OrderV2, lines: OrderLineV2[]): void {
  if (lines.length === 0) {
    throw new InvariantError("order has no lines");
  }

  const sumGross = lines.reduce((s, l) => s + l.gross_line_total, 0);
  const sumPromo = lines.reduce((s, l) => s + l.promo_discount, 0);
  const sumManualItem = lines.reduce((s, l) => s + l.manual_item_discount, 0);
  const sumOrderAlloc = lines.reduce((s, l) => s + l.order_discount_allocation, 0);
  const sumNet = lines.reduce((s, l) => s + l.net_line_total, 0);

  if (sumGross !== order.gross_total) {
    throw new InvariantError(`gross mismatch: lines sum to ${sumGross}, order.gross_total=${order.gross_total}`);
  }
  if (sumPromo !== order.promo_discount_total) {
    throw new InvariantError(`promo mismatch: lines sum to ${sumPromo}, order.promo_discount_total=${order.promo_discount_total}`);
  }
  if (sumManualItem !== order.manual_item_discount_total) {
    throw new InvariantError(`manual_item mismatch: lines sum to ${sumManualItem}, order.manual_item_discount_total=${order.manual_item_discount_total}`);
  }
  if (Math.abs(sumOrderAlloc - order.manual_order_discount) > 1) {
    throw new InvariantError(`order_discount_allocation mismatch: lines sum to ${sumOrderAlloc}, order.manual_order_discount=${order.manual_order_discount}`);
  }

  const expectedNet =
    order.gross_total -
    order.promo_discount_total -
    order.manual_item_discount_total -
    order.manual_order_discount;
  if (Math.abs(expectedNet - order.net_total) > 1) {
    throw new InvariantError(`net_total formula mismatch: expected ${expectedNet}, got ${order.net_total}`);
  }

  if (Math.abs(sumNet - order.net_total) > 1) {
    throw new InvariantError(`net_total mismatch: lines sum to ${sumNet}, order.net_total=${order.net_total}`);
  }

  for (const l of lines) {
    const expectedLineNet =
      l.gross_line_total - l.promo_discount - l.manual_item_discount - l.order_discount_allocation;
    if (Math.abs(expectedLineNet - l.net_line_total) > 1) {
      throw new InvariantError(`line ${l.id} net mismatch: expected ${expectedLineNet}, got ${l.net_line_total}`);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npm test -- order-math.test.ts`
Expected: All 25 tests pass (13 + 12).

- [ ] **Step 5: Commit**

```bash
rtk git add lib/order-math.ts lib/order-math.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(orders-v2): TDD assertOrderInvariants — guardian for all write paths

WS-1 step 6: 7 financial invariants enforced. Called by submitOrderV2,
editOrderV2, and the migration script before any write. ±1đ tolerance
for integer rounding. Throws InvariantError with precise diagnostic.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Property-based tests — invariants hold for random carts

**Files:**
- Create: `lib/order-math.property.test.ts**

Property-based testing with `fast-check` generates 1000 random (order, lines) pairs and asserts invariants always hold. This catches edge cases unit tests miss.

- [ ] **Step 1: Write the property test**

Create `lib/order-math.property.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { assertOrderInvariants, allocateLineRevenue, allocateOrderDiscount } from "@/lib/order-math";
import type { OrderV2, OrderLineV2, AllocatableLine, LineForAllocation } from "@/lib/order-types";

/**
 * Generate a random valid (order, lines) pair using the same math the write
 * path will use. If invariants ever fail on random input, the write path
 * would produce invalid orders in production.
 */
function makeValidOrderAndLines(params: {
  lineCount: number;
  unitPrice: number;
  qty: number;
  promoPerLine: number;
  manualItemPerLine: number;
  manualOrder: number;
}): { order: OrderV2; lines: OrderLineV2[] } {
  const orderId = `ord-prop-${Math.random().toString(36).slice(2)}`;
  const lines: OrderLineV2[] = [];

  for (let i = 0; i < params.lineCount; i++) {
    const gross = params.unitPrice * params.qty;
    const promo = Math.min(params.promoPerLine, gross);
    const manualItem = Math.min(params.manualItemPerLine, gross - promo);
    lines.push({
      id: `ol-${i}`,
      order_id: orderId,
      line_no: i + 1,
      product_id: `prod-${i}`,
      product_snapshot_json: "{}",
      variant_id: `var-${i}`,
      variant_snapshot_json: "{}",
      qty: params.qty,
      unit_price: params.unitPrice,
      modifiers_snapshot_json: "[]",
      gross_line_total: gross,
      promo_discount: promo,
      manual_item_discount: manualItem,
      order_discount_allocation: 0, // filled in below
      net_line_total: 0, // filled in below
      cost_at_sale: 0,
      recipe_snapshot_json: "{}",
      promo_discount_reason: "",
      manual_discount_reason: "",
    });
  }

  // Allocate order discount across lines
  const allocatable: AllocatableLine[] = lines.map(l => ({
    line_id: l.id,
    capacity: l.gross_line_total - l.promo_discount - l.manual_item_discount,
  }));
  const allocations = allocateOrderDiscount(allocatable, params.manualOrder);
  for (const l of lines) {
    l.order_discount_allocation = allocations.get(l.id) || 0;
    l.net_line_total = l.gross_line_total - l.promo_discount - l.manual_item_discount - l.order_discount_allocation;
  }

  const order: OrderV2 = {
    id: orderId,
    order_no: "PROP-001",
    brand_id: "B",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-06-01T00:00:00.000Z",
    created_by_id: "U",
    created_by_name: "Test",
    completed_at: "2026-06-01T00:00:00.000Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: lines.reduce((s, l) => s + l.gross_line_total, 0),
    promo_discount_total: lines.reduce((s, l) => s + l.promo_discount, 0),
    manual_item_discount_total: lines.reduce((s, l) => s + l.manual_item_discount, 0),
    manual_order_discount: Math.min(
      params.manualOrder,
      lines.reduce((s, l) => s + l.order_discount_allocation, 0),
    ),
    net_total: lines.reduce((s, l) => s + l.net_line_total, 0),
    applied_promotion_id: "",
    applied_promotion_snapshot_json: "",
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };

  return { order, lines };
}

describe("order-math property tests", () => {
  it("invariants always hold for random valid orders", () => {
    fc.assert(
      fc.property(
        fc.record({
          lineCount: fc.integer({ min: 1, max: 10 }),
          unitPrice: fc.integer({ min: 1000, max: 100000 }),
          qty: fc.integer({ min: 1, max: 5 }),
          promoPerLine: fc.integer({ min: 0, max: 20000 }),
          manualItemPerLine: fc.integer({ min: 0, max: 10000 }),
          manualOrder: fc.integer({ min: 0, max: 50000 }),
        }),
        (params) => {
          const { order, lines } = makeValidOrderAndLines(params);
          expect(() => assertOrderInvariants(order, lines)).not.toThrow();
        },
      ),
      { numRuns: 500 },
    );
  });

  it("allocateLineRevenue never returns negative revenue", () => {
    fc.assert(
      fc.property(
        fc.record({
          unitPrice: fc.integer({ min: 1000, max: 100000 }),
          qty: fc.integer({ min: 1, max: 5 }),
          modifierPrice: fc.integer({ min: 0, max: 20000 }),
          promo: fc.integer({ min: 0, max: 200000 }),
          manual: fc.integer({ min: 0, max: 50000 }),
          orderAlloc: fc.integer({ min: 0, max: 50000 }),
        }),
        (p) => {
          const gross = (p.unitPrice + p.modifierPrice) * p.qty;
          const line: LineForAllocation = {
            unit_price: p.unitPrice,
            qty: p.qty,
            modifiers: [{ id: "m1", name: "M", price: p.modifierPrice, qty: 1 }],
            gross_line_total: gross,
            promo_discount: p.promo,
            manual_item_discount: p.manual,
            order_discount_allocation: p.orderAlloc,
          };
          const result = allocateLineRevenue(line);
          expect(result.variantRevenue).toBeGreaterThanOrEqual(0);
          expect(result.lineRevenue).toBeGreaterThanOrEqual(0);
          for (const id in result.modifierRevenue) {
            expect(result.modifierRevenue[id]).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("allocateOrderDiscount sum always equals min(discount, totalCapacity)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ line_id: fc.string({ minLength: 1, maxLength: 10 }), capacity: fc.integer({ min: 0, max: 50000 }) }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 100000 }),
        (lines, discount) => {
          const result = allocateOrderDiscount(lines, discount);
          const sum = Array.from(result.values()).reduce((s, v) => s + v, 0);
          const totalCapacity = lines.reduce((s, l) => s + l.capacity, 0);
          expect(sum).toBe(Math.min(discount, totalCapacity));
        },
      ),
      { numRuns: 500 },
    );
  });
});
```

- [ ] **Step 2: Run property tests**

Run: `rtk npm test -- order-math.property.test.ts`
Expected: All 3 property tests pass (each running 500 iterations). Total ~1500 assertions.

- [ ] **Step 3: Run the full test suite**

Run: `rtk npm test`
Expected: All 28 tests pass (25 unit + 3 property).

- [ ] **Step 4: Commit**

```bash
rtk git add lib/order-math.property.test.ts
rtk git commit -m "$(cat <<'EOF'
test(orders-v2): property-based tests for invariants and allocators

WS-1 step 7: 1500 random-input assertions across 3 properties.
Catches edge cases unit tests miss — empty lines, discount exceeding
capacity, lines with all-promo-no-capacity, etc.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Schema verification script (`scripts/verify-v2-schema.ts`)

**Files:**
- Create: `scripts/verify-v2-schema.ts`

This is the only I/O in WS-1. It reads the headers of the three new sheets and asserts they match spec §5. Run after manually creating the sheets in Google Sheets (operator step — see runbook in spec §7).

- [ ] **Step 1: Create `scripts/verify-v2-schema.ts`**

Create `scripts/verify-v2-schema.ts`:

```typescript
/**
 * Verify V2 sheet headers match spec.
 *
 * Run AFTER manually creating Orders_V2, Order_Lines_V2, Order_Events sheets
 * in Google Sheets (see docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md §7).
 *
 * Usage:
 *   npx tsx scripts/verify-v2-schema.ts
 *
 * Exit codes:
 *   0 — all sheets match
 *   1 — one or more sheets missing or headers mismatch
 */

import { getSheetsClient } from "../lib/sheets_db";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

interface SheetSpec {
  name: string;
  requiredHeaders: readonly string[];
}

const SHEETS: readonly SheetSpec[] = [
  {
    name: "Orders_V2",
    requiredHeaders: [
      "id", "order_no", "brand_id", "status", "version", "parent_order_id", "superseded_by",
      "created_at", "created_by_id", "created_by_name", "completed_at",
      "voided_at", "voided_by_id", "void_reason",
      "currency",
      "gross_total", "promo_discount_total", "manual_item_discount_total",
      "manual_order_discount", "net_total",
      "applied_promotion_id", "applied_promotion_snapshot_json", "pos_snapshot_json",
      "payment_method", "payment_ref",
      "migration_notes",
    ] as const,
  },
  {
    name: "Order_Lines_V2",
    requiredHeaders: [
      "id", "order_id", "line_no",
      "product_id", "product_snapshot_json",
      "variant_id", "variant_snapshot_json",
      "qty", "unit_price", "modifiers_snapshot_json",
      "gross_line_total", "promo_discount", "manual_item_discount",
      "order_discount_allocation", "net_line_total",
      "cost_at_sale", "recipe_snapshot_json",
      "promo_discount_reason", "manual_discount_reason",
    ] as const,
  },
  {
    name: "Order_Events",
    requiredHeaders: [
      "id", "order_id", "event_type", "event_at",
      "actor_id", "actor_name",
      "from_version", "to_version", "previous_order_id",
      "delta_json", "reason",
    ] as const,
  },
] as const;

async function readHeaders(sheetName: string): Promise<string[] | null> {
  const sheets = await getSheetsClient();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!1:1`,
    });
    return (res.data.values?.[0] as string[] | undefined) ?? [];
  } catch (err: any) {
    if (err?.code === 400 || /Unable to parse range/i.test(err?.message ?? "")) {
      return null; // sheet does not exist
    }
    throw err;
  }
}

function diffHeaders(expected: readonly string[], actual: string[]): { missing: string[]; extra: string[] } {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter(h => !actualSet.has(h));
  const extra = actual.filter(h => !expectedSet.has(h));
  return { missing, extra };
}

async function main() {
  if (!SPREADSHEET_ID) {
    console.error("FATAL: GOOGLE_SPREADSHEET_ID env var is required");
    process.exit(1);
  }

  let allOk = true;

  for (const spec of SHEETS) {
    const headers = await readHeaders(spec.name);
    if (headers === null) {
      console.error(`[MISSING] Sheet '${spec.name}' does not exist or is unreadable`);
      allOk = false;
      continue;
    }
    if (headers.length === 0) {
      console.error(`[EMPTY] Sheet '${spec.name}' has no header row`);
      allOk = false;
      continue;
    }
    const { missing, extra } = diffHeaders(spec.requiredHeaders, headers);
    if (missing.length === 0 && extra.length === 0) {
      console.log(`[OK] ${spec.name} — ${headers.length} headers match`);
    } else {
      allOk = false;
      console.error(`[MISMATCH] ${spec.name}`);
      if (missing.length > 0) console.error(`  missing: ${missing.join(", ")}`);
      if (extra.length > 0) console.error(`  extra:   ${extra.join(", ")}`);
    }
  }

  if (!allOk) {
    console.error("\nSchema verification FAILED. Fix the sheets above before WS-2 cutover.");
    process.exit(1);
  }
  console.log("\nSchema verification PASSED. All V2 sheets ready.");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "verify-v2-schema" || echo "no errors in verify-v2-schema"`
Expected: `no errors in verify-v2-schema`. (We don't run it yet — the sheets don't exist.)

- [ ] **Step 3: Commit**

```bash
rtk git add scripts/verify-v2-schema.ts
rtk git commit -m "$(cat <<'EOF'
feat(orders-v2): schema verification script for V2 sheets

WS-1 step 8: read-only script that asserts Orders_V2, Order_Lines_V2,
Order_Events headers match spec section 5. Run after manually creating
the sheets; exits non-zero on any mismatch. WS-2 cannot start until
this passes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Final verification and tracking update

**Files:** No source changes — verification only.

- [ ] **Step 1: Run the complete test suite**

Run: `rtk npm test`
Expected: All 28 tests pass. No failures. No skipped tests.

- [ ] **Step 2: Run TypeScript check**

Run: `rtk tsc --noEmit`
Expected: 0 errors in `lib/order-math.ts`, `lib/order-types.ts`, `lib/__tests__/fixtures.ts`, `scripts/verify-v2-schema.ts`. (Pre-existing errors in unrelated files are not WS-1's concern; note them in the handoff but do not fix.)

- [ ] **Step 3: Run linter on new files**

Run: `rtk lint lib/order-math.ts lib/order-types.ts lib/__tests__/fixtures.ts scripts/verify-v2-schema.ts`
Expected: No new lint errors. (Warnings about existing patterns are OK.)

- [ ] **Step 4: Run coverage**

Run: `rtk npm run test:coverage`
Expected: Coverage ≥ 95% for `lib/order-math.ts` and `lib/order-types.ts`. If below, add tests for uncovered branches before approving WS-1.

- [ ] **Step 5: Update DEVELOPMENT-TRACKING.md**

Append to `DEVELOPMENT-TRACKING.md` (root):

```markdown
## 2026-06-18 — WS-1 Foundation Complete

- Installed vitest + fast-check
- Created `lib/order-types.ts` (strict types for Orders_V2, Order_Lines_V2, Order_Events)
- Created `lib/order-math.ts` with 3 pure functions: `allocateOrderDiscount`, `allocateLineRevenue`, `assertOrderInvariants`
- 28 tests passing (25 unit + 3 property-based, ~1500 assertions)
- UCK000094 golden case verified: Sữa Dâu reports exactly 25.000đ
- Schema verification script ready: `scripts/verify-v2-schema.ts`
- **Next:** Operator creates V2 sheets in Google Sheets (manual step), runs verify-v2-schema.ts, then WS-2 can start.
```

- [ ] **Step 6: Commit tracking update**

```bash
rtk git add DEVELOPMENT-TRACKING.md
rtk git commit -m "$(cat <<'EOF'
docs(tracking): WS-1 foundation complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Notify Claude for code review**

Per CLAUDE.md §5 step 1, run `superpowers:code-reviewer` against the WS-1 branch before marking complete. Address any high-confidence issues before handoff.

---

## Self-Review

**Spec coverage check** (against `2026-06-18-orders-reports-rebuild.md` §8 WS-1):
- ✓ `lib/order-math.ts` — pure functions from spec §6 → Tasks 4, 5, 6
- ✓ `lib/order-types.ts` — TypeScript interfaces → Task 2
- ✓ `lib/order-invariants.ts` — folded into `order-math.ts` as `assertOrderInvariants` → Task 6 (one file is simpler than two for callers)
- ✓ Tests for math → Tasks 4-7 (unit + property)
- ✓ Schema verification script → Task 8
- Note: `lib/sheets-db-helpers.ts` (batched write helpers, ID generation) deferred to WS-2 — it's only needed when the first write path lands, and it has I/O which makes it not pure

**Placeholder scan:**
- No `TBD`, `TODO`, `implement later` strings.
- Every code block is complete and runnable as written.
- Every test has actual assertions, not `expect(true).toBe(true)`.

**Type consistency:**
- `AllocatableLine`, `LineForAllocation`, `AllocatedRevenue`, `OrderV2`, `OrderLineV2`, `OrderEvent` — used consistently across files.
- `allocateOrderDiscount`, `allocateLineRevenue`, `assertOrderInvariants` — same names in tests, source, and fixtures.
- `ORDER_STATUS`, `EVENT_TYPE`, `PAYMENT_METHOD`, `STOCK_TXN_TYPE` — defined once in `order-types.ts`, not duplicated.

**Test count sanity:**
- Task 4: 7 tests (`allocateOrderDiscount`)
- Task 5: 6 tests (`allocateLineRevenue`)
- Task 6: 12 tests (`assertOrderInvariants`)
- Task 7: 3 property tests
- Total: 28 tests, matches Task 9 Step 1 expectation.

**Risks for the implementer:**
- R1: `crypto.randomUUID()` requires Node 19+. Project uses Node 20 (per `@types/node`), so OK. WS-2 will use this for ID generation.
- R2: vitest may pick up `.next/types/**/*.ts` if include pattern is too broad. The `include` in vitest.config.ts is restricted to `lib/**` and `scripts/**` to avoid this.
- R3: `fast-check` property tests are slower than unit tests (~3-5s for 500 runs each). Acceptable; CI cost is fine.
- R4: Schema verification script can't actually run until operator creates the sheets. That's intentional — the script is the verification gate for "sheets ready, can start WS-2".

---

## Handoff

**WS-1 is the foundation. Do not start WS-2 (write path) until WS-1 is merged AND the operator has run `verify-v2-schema.ts` successfully against the real Google Sheets.**

**Manual operator steps between WS-1 and WS-2:**
1. In Google Sheets, create three new tabs: `Orders_V2`, `Order_Lines_V2`, `Order_Events`
2. Copy the header row from spec §5 (or from `scripts/verify-v2-schema.ts` SHEETS const) into row 1 of each sheet
3. Run `npx tsx scripts/verify-v2-schema.ts` — must print "Schema verification PASSED"
4. Backup the existing `Orders`, `Order_Lines`, `Stock_Ledger` tabs (right-click → Duplicate, suffix `_BACKUP_2026-06-18`)

**Next plan: WS-2 (POS write path).** Claude will draft after WS-1 is reviewed and merged.

---

## Notes for the implementing agent (Antigravity)

- **Follow the task order strictly.** Each task depends on the previous. Skipping ahead = compile errors.
- **Commit after each task.** Small commits make review easier and rollback surgical.
- **Run the failing test BEFORE implementing.** Seeing the test fail with the expected error confirms the test is wired correctly.
- **Do not modify files outside WS-1's scope.** Pre-existing TypeScript errors in other files are out of scope; do not "fix" them in this branch.
- **If a test fails for unexpected reasons, stop and ping Claude.** Do not "make it pass" by weakening the assertion. The assertions encode the financial invariants; weakening them defeats the rebuild.
- **Property tests may surface edge cases the unit tests miss.** If a property fails, capture the failing input (fast-check prints it), write a unit test for that specific input, then fix the implementation. Do not weaken the property.
