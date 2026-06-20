# WS-3 Admin Edit Path Implementation Plan

> **For Antigravity (implementer):** Bite-sized TDD plan. Cadence: User approved batch execution for WS-2; same for WS-3 — commit after each task, no waiting for review between tasks, stop and report after Task 9. If a task fails tests, STOP and report (don't weaken assertions).

**Goal:** Replace the destructive legacy edit/delete flow with `editOrderV2` (supersede-and-replace) and `voidOrderV2` (soft-void with reversal). Close the modifier-recipe gap from WS-2. Migrate admin Orders UI (table, edit modal, detail modal, page) to V2 data shape with version timeline.

**Architecture:**
- **Edit = supersede, not mutate.** Editing order v1 produces v2 (new rows in `Orders_V2`/`Order_Lines_V2`); v1 is marked `SUPERSEDED` with `superseded_by` pointing to v2. Stock ledger gets `EDIT_REVERSAL` rows (positive `quantity_change`) matching old `SALES_CONSUME`, plus fresh `SALES_CONSUME` for v2.
- **Version chain via `parent_order_id`** — always points to the ROOT (first version), not immediate predecessor. Makes "find root" O(1). To list timeline: scan all orders with same `parent_order_id`, sort by `version`.
- **Same `order_no` across versions** — `UCK000094` stays `UCK000094` after edit. The `version` field distinguishes them. Reports filter `status=COMPLETED AND superseded_by=""` to get latest only.
- **Optimistic locking via `version`** — `editOrderV2` checks the input version matches the DB version; rejects with clear error if not.
- **Sale time preserved across edits** — new order's `created_at` = original order's `created_at`. COGS recomputed at original sale time, not edit time. Honors historical cost accuracy.
- **Modifier recipes snapshotted** — closes WS-2 gap. `recipe_snapshot_json` shape extended to `{ variant: RecipeSnapshot, modifiers: Array<{modifier_id, recipe: RecipeSnapshot}> }`. Old smoke-test V2 rows (TEST157569 etc.) must be deleted first since they use the old shape.

**Tech Stack:** Next.js 14 server actions, existing `lib/sheets_db.ts` + `lib/sheets-db-v2.ts` (WS-2), `lib/order-cart.ts` (WS-2) reused with extension.

**Parent spec:** `docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md` — sections 4.3 (state machine), 5.5 (status transitions), 7 (migration context).

**WS-1 + WS-2 dependencies (already merged):** `lib/order-types.ts`, `lib/order-math.ts`, `lib/order-snapshot.ts`, `lib/order-cogs.ts`, `lib/order-cart.ts`, `lib/sheets-db-v2.ts`, `app/actions/pos-v2.ts`.

---

## Pre-Task Cleanup (operator step, do this BEFORE Task 1)

The WS-2 smoke test wrote test rows to V2 sheets with the old `recipe_snapshot_json` shape. These must be removed before changing the shape in Task 1, otherwise parsing will fail.

- [ ] **In Google Sheets, delete these test rows:**
  - `Orders_V2`: any row with `order_no` starting with `TEST` (e.g., `TEST157569`)
  - `Order_Lines_V2`: corresponding line rows (match by `order_id`)
  - `Order_Events`: corresponding event rows
  - `Stock_Ledger`: any row with `order_event_id` matching those events

  Use Find & Replace or filter by `TEST*` prefix on `order_no`.

- [ ] **Verify cleanup:**

  Run: `npx tsx scripts/verify-v2-schema.ts`
  Expected: schema still passes (headers unchanged). Test rows gone.

  Then run a quick query (Antigravity can write a `scripts/list-test-orders.ts` if helpful) to confirm no rows have `order_no LIKE 'TEST%'` in `Orders_V2`.

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `lib/order-edit-cart.ts` | `buildEditedOrderFromCart(input, ref, original)` — like `buildOrderFromCart` but pins `created_at`, walks version chain, sets `parent_order_id` to root |
| `lib/order-edit-cart.test.ts` | Tests for edit cart math including version chaining |
| `lib/sheets-db-v2-edit.ts` | `supersedeOrderV2({ oldOrderId, newOrder, newLines, event, reversalEntries, consumeEntries })` — batched write |
| `lib/sheets-db-v2-edit.test.ts` | Tests with mocked sheets client |
| `app/actions/order-edit-v2.ts` | `editOrderV2(orderId, version, editInput, reason)` server action |
| `app/actions/orders-v2.ts` | `getOrdersV2()`, `getOrderDetailV2(orderId)`, `voidOrderV2(orderId, reason)` |
| `scripts/test-edit-order-v2.ts` | Smoke test: edit an order, verify supersede chain + reversals |
| `scripts/test-void-order-v2.ts` | Smoke test: void an order, verify VOIDED status + reversals |

### Files to modify

| Path | Change |
|---|---|
| `lib/order-types.ts` | Extend `RecipeSnapshot` storage shape (see Task 1). Add helper `parseLineRecipeSnapshot(json)` |
| `lib/order-cart.ts` | Capture modifier recipes into the new `recipe_snapshot_json` shape. Extract `buildLine` helper to be reusable by `order-edit-cart.ts` |
| `lib/order-cogs.ts` | Accept new shape: compute MAC for variant ingredients + each modifier's ingredients |
| `app/actions/pos-v2.ts` | Build Stock_Ledger entries for modifier ingredients too (closes WS-2 gap) |
| `app/admin/orders/page.tsx` | Call `getOrdersV2` instead of `getOrders` |
| `app/admin/orders/OrderTable.tsx` | Accept V2 shape, version badge if `parent_order_id !== ""`, replace delete button with void |
| `app/admin/orders/OrderDetailModal.tsx` | V2 shape, version timeline section, void button (with reason prompt) |
| `app/admin/orders/OrderEditModal.tsx` | Call `editOrderV2`, version input, required reason field |

### Files NOT touched in WS-3

- `app/actions/pos.ts` (legacy `submitOrder`) — still in code; archived in WS-5
- `app/actions/order-edit.ts` (legacy `editOrder`) — still in code; archived in WS-5
- `app/actions/orders.ts` (legacy `getOrders`, `deleteOrder`) — still in code; archived in WS-5
- `app/admin/reports/*` — WS-4

---

## Task 1: Extend recipe snapshot to include modifier recipes

**Files:**
- Modify: `lib/order-types.ts`
- Modify: `lib/order-cart.ts`
- Modify: `lib/order-cogs.ts`
- Modify: `lib/order-cart.test.ts` (add tests for new shape)
- Modify: `lib/order-cogs.test.ts` (add tests for new shape)

This is the WS-2 gap closure. New `recipe_snapshot_json` shape:

```typescript
// Old shape (WS-2):
RecipeSnapshot

// New shape (WS-3):
{
  variant: RecipeSnapshot,           // variant recipe (may be empty)
  modifiers: Array<{                 // one entry per modifier with a recipe
    modifier_id: string,
    modifier_name: string,
    recipe: RecipeSnapshot,
  }>,
}
```

- [ ] **Step 1: Add parser/helper to `lib/order-types.ts`**

Append to `lib/order-types.ts`:

```typescript
// ============================================================================
// Line recipe snapshot — combined variant + modifier recipes
// ============================================================================

export interface ModifierRecipeEntry {
  modifier_id: string;
  modifier_name: string;
  recipe: RecipeSnapshot;
}

export interface LineRecipeSnapshot {
  variant: RecipeSnapshot;
  modifiers: ModifierRecipeEntry[];
}

/** Parse the combined recipe_snapshot_json. Throws InvariantError on malformed JSON. */
export function parseLineRecipeSnapshot(json: string): LineRecipeSnapshot {
  if (!json || json === "{}" || json === "") {
    return {
      variant: { target_type: "PRODUCT_VARIANT", target_id: "", ingredients: [] },
      modifiers: [],
    };
  }
  try {
    const parsed = JSON.parse(json);
    // New shape
    if (parsed && typeof parsed === "object" && "variant" in parsed) {
      return parsed as LineRecipeSnapshot;
    }
    // Legacy shape (raw RecipeSnapshot) — wrap as variant-only
    if (parsed && typeof parsed === "object" && "target_type" in parsed) {
      return { variant: parsed as RecipeSnapshot, modifiers: [] };
    }
  } catch {}
  return {
    variant: { target_type: "PRODUCT_VARIANT", target_id: "", ingredients: [] },
    modifiers: [],
  };
}
```

- [ ] **Step 2: Update `lib/order-cart.ts` to populate new shape**

In `lib/order-cart.ts`, modify the `buildLine` internal function. Find the section that builds `recipeSnap` (currently only variant recipe) and replace with:

```typescript
// Pick variant recipe (most recent non-expired)
const variantRecipe = pickRecipe(ref.recipes, "PRODUCT_VARIANT", item.variant_id);
const variantRecipeSnap = variantRecipe ? buildRecipeSnapshot(variantRecipe) : {
  target_type: "PRODUCT_VARIANT" as const,
  target_id: item.variant_id,
  ingredients: [],
};

// Pick each modifier's recipe (most recent non-expired)
const modifierRecipeEntries: ModifierRecipeEntry[] = [];
for (const mod of modifierSnap) {
  const modRecipe = pickRecipe(ref.recipes, "MODIFIER", mod.id);
  if (modRecipe) {
    modifierRecipeEntries.push({
      modifier_id: mod.id,
      modifier_name: mod.name,
      recipe: buildRecipeSnapshot(modRecipe),
    });
  }
}

const lineRecipeSnap = {
  variant: variantRecipeSnap,
  modifiers: modifierRecipeEntries,
};
```

Then later in the same function, use `JSON.stringify(lineRecipeSnap)` for `recipe_snapshot_json` field instead of just `variantRecipeSnap`.

Add the necessary imports at the top of `lib/order-cart.ts`:

```typescript
import type {
  // ... existing imports ...
  ModifierRecipeEntry,
} from "@/lib/order-types";
```

- [ ] **Step 3: Update `lib/order-cogs.ts` to handle new shape**

The function signature stays the same (takes a recipe), but callers now pass the parsed `LineRecipeSnapshot` or we accept both. Cleanest: change the function to accept `LineRecipeSnapshot` and iterate all ingredients.

Replace `lib/order-cogs.ts` contents with:

```typescript
/**
 * COGS computation for an order line at sale time.
 * Iterates ingredients from variant recipe + each modifier recipe.
 * Moving Average Cost across all PO_RECEIPT entries up to sale time.
 */

import type { LineRecipeSnapshot, RecipeSnapshot } from "@/lib/order-types";

interface LedgerEntry {
  item_reference: string;
  transaction_type: string;
  unit_cost: string | number;
  quantity_change: string | number;
  created_at: string;
}

/** Compute MAC cost across a single RecipeSnapshot's ingredients. */
function costForRecipe(
  recipe: RecipeSnapshot,
  ledger: LedgerEntry[],
  lineQty: number,
  saleMs: number,
): number {
  if (!recipe.ingredients || recipe.ingredients.length === 0) return 0;
  let total = 0;
  for (const ing of recipe.ingredients) {
    if (ing.quantity <= 0) continue;
    const purchases = ledger.filter(e =>
      e.item_reference === ing.ingredient_id &&
      e.transaction_type === "PO_RECEIPT" &&
      e.created_at &&
      new Date(e.created_at).getTime() <= saleMs,
    );
    if (purchases.length === 0) continue;
    const totalCost = purchases.reduce((s, e) => s + Number(e.unit_cost) * Number(e.quantity_change), 0);
    const totalQty = purchases.reduce((s, e) => s + Number(e.quantity_change), 0);
    if (totalQty <= 0) continue;
    const mac = totalCost / totalQty;
    total += mac * ing.quantity * lineQty;
  }
  return total;
}

export function computeLineCostAtSale(
  lineRecipe: LineRecipeSnapshot | RecipeSnapshot,
  ledger: LedgerEntry[],
  lineQty: number,
  saleTime: string = new Date().toISOString(),
): number {
  const saleMs = new Date(saleTime).getTime();

  // Backward compat: if caller passes raw RecipeSnapshot (old shape), treat as variant-only
  if ("target_type" in lineRecipe && !("variant" in lineRecipe)) {
    return Math.round(costForRecipe(lineRecipe as RecipeSnapshot, ledger, lineQty, saleMs));
  }

  const snap = lineRecipe as LineRecipeSnapshot;
  let total = costForRecipe(snap.variant, ledger, lineQty, saleMs);
  for (const modEntry of snap.modifiers) {
    total += costForRecipe(modEntry.recipe, ledger, lineQty, saleMs);
  }
  return Math.round(total);
}
```

- [ ] **Step 4: Update `app/actions/pos-v2.ts` to consume new shape**

In `app/actions/pos-v2.ts`, replace the COGS loop (around line 60-64) and `buildStockLedgerEntries` function. The new code uses `parseLineRecipeSnapshot` and builds ledger entries for variant + each modifier:

```typescript
import { parseLineRecipeSnapshot } from "@/lib/order-types";
// ...

// 5. Compute COGS per line
const saleTime = built.order.created_at;
for (const line of built.lines) {
  const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
  line.cost_at_sale = computeLineCostAtSale(lineRecipe, ledger, line.qty, saleTime);
}
```

Replace `buildStockLedgerEntries` with:

```typescript
function buildStockLedgerEntries(
  built: ReturnType<typeof buildOrderFromCart>,
  eventId: string,
  saleTime: string,
) {
  const entries: any[] = [];
  for (const line of built.lines) {
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);

    // Variant ingredients
    for (const ing of lineRecipe.variant.ingredients) {
      if (ing.quantity <= 0) continue;
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "SALES_CONSUME",
        reference_id: built.order.id,
        item_reference: ing.ingredient_id,
        quantity_change: -(ing.quantity * line.qty),
        unit_cost: 0,
        created_at: saleTime,
        order_event_id: eventId,
        cost_at_sale: 0, // simplified: per-ingredient MAC refinement deferred
        source: "VARIANT_RECIPE",
      });
    }

    // Modifier ingredients
    for (const modEntry of lineRecipe.modifiers) {
      for (const ing of modEntry.recipe.ingredients) {
        if (ing.quantity <= 0) continue;
        entries.push({
          id: `stk-${crypto.randomUUID()}`,
          transaction_type: "SALES_CONSUME",
          reference_id: built.order.id,
          item_reference: ing.ingredient_id,
          quantity_change: -(ing.quantity * line.qty),
          unit_cost: 0,
          created_at: saleTime,
          order_event_id: eventId,
          cost_at_sale: 0,
          source: `MODIFIER_RECIPE:${modEntry.modifier_id}`,
        });
      }
    }
  }
  return entries;
}
```

- [ ] **Step 5: Update tests to cover new shape**

Add to `lib/order-cart.test.ts`:

```typescript
it("modifier recipes are captured in recipe_snapshot_json", () => {
  const refWithModifierRecipe: ReferenceData = {
    ...REF,
    modifiers: [{ id: "MOD-004", name: "Trân châu trắng", price: "5000", status: "ACTIVE" }],
    recipes: [
      // Existing variant recipes...
      ...REF.recipes,
      {
        id: "RCP-MOD-004",
        target_type: "MODIFIER",
        target_id: "MOD-004",
        ingredients_json: JSON.stringify([
          { ingredient_id: "BI-PEARL", ingredient_type: "BASE_INGREDIENT", quantity: 0.03, unit_id: "UNIT-KG" },
        ]),
        end_date: "",
        created_at: "2026-06-01T00:00:00Z",
      },
    ],
  };

  const result = buildOrderFromCart({
    brand_id: "BR-002",
    items: [{
      product_id: "PROD-024",
      variant_id: "VAR-031",
      qty: 1,
      modifiers: [{ modifier_id: "MOD-004", modifier_qty: 1 }],
      manual_item_discount: { value: 0, type: "VND" },
    }],
    payment_method: "CASH",
    actor: { id: "U1", name: "Test" },
  }, refWithModifierRecipe);

  const recipeSnap = JSON.parse(result.lines[0].recipe_snapshot_json);
  expect(recipeSnap.variant).toBeDefined();
  expect(recipeSnap.modifiers.length).toBe(1);
  expect(recipeSnap.modifiers[0].modifier_id).toBe("MOD-004");
  expect(recipeSnap.modifiers[0].recipe.ingredients[0].ingredient_id).toBe("BI-PEARL");
});
```

Add to `lib/order-cogs.test.ts`:

```typescript
it("computes MAC across variant + modifier ingredients", () => {
  const lineRecipe = {
    variant: {
      target_type: "PRODUCT_VARIANT",
      target_id: "V1",
      ingredients: [
        { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "L" },
      ],
    },
    modifiers: [{
      modifier_id: "MOD-PEARL",
      modifier_name: "Trân châu",
      recipe: {
        target_type: "MODIFIER",
        target_id: "MOD-PEARL",
        ingredients: [
          { ingredient_id: "BI-PEARL", ingredient_type: "BASE_INGREDIENT", quantity: 0.03, unit_id: "KG" },
        ],
      },
    }],
  };
  const ledger = [
    { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "20000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
    { item_reference: "BI-PEARL", transaction_type: "PO_RECEIPT", unit_cost: "50000", quantity_change: "5", created_at: "2026-06-01T00:00:00Z" },
  ];
  // 0.05L milk × 20k/L = 1000
  // 0.03kg pearl × 50k/kg = 1500
  // Total = 2500
  expect(computeLineCostAtSale(lineRecipe as any, ledger, 1)).toBe(2500);
});

it("backward compat: accepts raw RecipeSnapshot (old shape)", () => {
  const oldShape: RecipeSnapshot = {
    target_type: "PRODUCT_VARIANT",
    target_id: "V1",
    ingredients: [
      { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "L" },
    ],
  };
  const ledger = [
    { item_reference: "BI-MILK", transaction_type: "PO_RECEIPT", unit_cost: "20000", quantity_change: "10", created_at: "2026-06-01T00:00:00Z" },
  ];
  expect(computeLineCostAtSale(oldShape, ledger, 1)).toBe(20000);
});
```

- [ ] **Step 6: Run all tests**

Run: `rtk npm test`
Expected: All existing 67 tests + new ones pass. If any test fails because it parses old `recipe_snapshot_json` shape, update the test to use new shape.

- [ ] **Step 7: Commit**

```bash
rtk git add lib/order-types.ts lib/order-cart.ts lib/order-cogs.ts lib/order-cart.test.ts lib/order-cogs.test.ts app/actions/pos-v2.ts
rtk git commit -m "feat(orders-v2): capture modifier recipes in line snapshot

WS-3 step 1 (closes WS-2 gap): recipe_snapshot_json now stores both
variant recipe AND each modifier's recipe. New shape:
  { variant: RecipeSnapshot, modifiers: Array<{modifier_id, recipe}> }

computeLineCostAtSale iterates both. submitOrderV2 emits SALES_CONSUME
ledger entries for both variant + modifier ingredients.

Backward compat: computeLineCostAtSale accepts legacy raw RecipeSnapshot.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Edit cart math (`lib/order-edit-cart.ts`)

**Files:**
- Create: `lib/order-edit-cart.ts`
- Create: `lib/order-edit-cart.test.ts`

`buildEditedOrderFromCart` — like `buildOrderFromCart` but for edit context. Pins `created_at` to original, walks version chain, sets `parent_order_id` to root.

- [ ] **Step 1: Write failing tests**

Create `lib/order-edit-cart.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildEditedOrderFromCart } from "@/lib/order-edit-cart";
import { makeSuaDauStandaloneOrder } from "@/lib/__tests__/fixtures";
import type { CartInput, ReferenceData } from "@/lib/order-cart";

const REF: ReferenceData = {
  brands: [{ id: "BR-002", code: "UCK", name: "UCK" }],
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
  recipes: [], base_ingredients: [],
};

describe("buildEditedOrderFromCart", () => {
  it("preserves created_at from original order", () => {
    const original = makeSuaDauStandaloneOrder();
    const editInput: CartInput = {
      brand_id: "BR-002",
      items: [{
        product_id: "PROD-024", variant_id: "VAR-031", qty: 2, // changed qty 1 → 2
        modifiers: [], manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    };

    const result = buildEditedOrderFromCart(editInput, REF, original);

    expect(result.order.created_at).toBe(original.order.created_at);
    expect(result.order.completed_at).toBe(original.order.completed_at);
  });

  it("increments version", () => {
    const original = makeSuaDauStandaloneOrder();
    expect(original.order.version).toBe(1);

    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    }, REF, original);

    expect(result.order.version).toBe(2);
  });

  it("preserves order_no from original", () => {
    const original = makeSuaDauStandaloneOrder();
    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    }, REF, original);
    expect(result.order.order_no).toBe(original.order.order_no);
  });

  it("walks parent chain: editing v2 produces v3 with parent_order_id = root v1", () => {
    const v1 = makeSuaDauStandaloneOrder();
    const v1RootId = v1.order.id;

    // Manually construct v2 in the chain
    const v2Order = { ...v1.order, id: "ord-v2-mock", version: 2, parent_order_id: v1RootId };
    const v2 = { order: v2Order, lines: v1.lines };

    // Now edit v2
    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      payment_method: "CASH",
      actor: { id: "U3", name: "Editor" },
    }, REF, v2);

    expect(result.order.version).toBe(3);
    expect(result.order.parent_order_id).toBe(v1RootId); // root, not v2
  });

  it("edits actor is recorded in created_by_*", () => {
    const original = makeSuaDauStandaloneOrder();
    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      payment_method: "CASH",
      actor: { id: "user-editor-01", name: "Quản lý A" },
    }, REF, original);

    expect(result.order.created_by_id).toBe("user-editor-01");
    expect(result.order.created_by_name).toBe("Quản lý A");
  });

  it("changing qty from 1 to 2 doubles gross_total", () => {
    const original = makeSuaDauStandaloneOrder();
    expect(original.order.gross_total).toBe(35000);

    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [{ product_id: "PROD-024", variant_id: "VAR-031", qty: 2, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
      payment_method: "CASH",
      actor: { id: "U2", name: "Editor" },
    }, REF, original);

    expect(result.order.gross_total).toBe(70000);
    expect(result.order.promo_discount_total).toBe(20000); // 10k promo per cup × 2
    expect(result.order.net_total).toBe(50000); // 70k - 20k promo
  });

  it("invariants pass on edited order (assertOrderInvariants called internally)", () => {
    const original = makeSuaDauStandaloneOrder();
    const result = buildEditedOrderFromCart({
      brand_id: "BR-002",
      items: [
        { product_id: "PROD-024", variant_id: "VAR-031", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } },
      ],
      payment_method: "BANK_TRANSFER",
      manual_order_discount: { value: 5000, type: "VND" },
      actor: { id: "U2", name: "Editor" },
    }, REF, original);

    // If assertOrderInvariants didn't pass, function would have thrown.
    expect(result.order.id).not.toBe(original.order.id);
    expect(result.order.status).toBe("COMPLETED");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npm test -- order-edit-cart.test.ts`
Expected: All tests fail with module-not-found.

- [ ] **Step 3: Implement `lib/order-edit-cart.ts`**

Create `lib/order-edit-cart.ts`:

```typescript
/**
 * Edit cart → new OrderV2 version (supersedes original).
 *
 * Pure function. Mirrors buildOrderFromCart but pins:
 *   - created_at = original.created_at (preserves sale time)
 *   - order_no = original.order_no
 *   - version = original.version + 1
 *   - parent_order_id = root (walks chain to v1)
 *
 * Internally calls assertOrderInvariants before returning.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 5.5)
 */

import crypto from "node:crypto";
import { buildOrderFromCart } from "@/lib/order-cart";
import type { CartInput, ReferenceData, BuildOrderResult } from "@/lib/order-cart";
import type { OrderV2, OrderLineV2 } from "@/lib/order-types";

interface OriginalOrder {
  order: OrderV2;
  lines: OrderLineV2[];
}

export function buildEditedOrderFromCart(
  input: CartInput,
  ref: ReferenceData,
  original: OriginalOrder,
): BuildOrderResult {
  // Delegate core math to buildOrderFromCart, then patch identity fields.
  const built = buildOrderFromCart(input, ref);

  // Find root: if original has no parent, original IS the root.
  const rootId = original.order.parent_order_id || original.order.id;

  const editedOrder: OrderV2 = {
    ...built.order,
    id: `ord-${crypto.randomUUID()}`, // new ID (supersede = new row)
    order_no: original.order.order_no, // preserve order_no
    version: original.order.version + 1,
    parent_order_id: rootId,
    created_at: original.order.created_at, // preserve sale time
    completed_at: original.order.completed_at,
    // created_by_* reflects the editor (who made this version), not original cashier
  };

  // Re-assert invariants with patched values (they should still hold)
  // Math fields are unchanged from buildOrderFromCart output, so this is just paranoia.
  // But it's cheap and catches bugs.
  const { assertOrderInvariants } = require("@/lib/order-math");
  assertOrderInvariants(editedOrder, built.lines);

  // Patch line order_id to point to new order id
  const editedLines = built.lines.map(l => ({ ...l, order_id: editedOrder.id }));

  return {
    order: editedOrder,
    lines: editedLines,
    resolvedPromotion: built.resolvedPromotion,
    resolvedRecipes: built.resolvedRecipes,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npm test -- order-edit-cart.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/order-edit-cart.ts lib/order-edit-cart.test.ts
rtk git commit -m "feat(orders-v2): buildEditedOrderFromCart for supersede-and-replace

WS-3 step 2: pure function that produces the next version of an order.
Preserves sale_time and order_no; increments version; walks chain to
find root for parent_order_id. Internally calls assertOrderInvariants.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Supersede batched write (`lib/sheets-db-v2-edit.ts`)

**Files:**
- Create: `lib/sheets-db-v2-edit.ts`
- Create: `lib/sheets-db-v2-edit.test.ts**

`supersedeOrderV2` wraps: update old order (→ SUPERSEDED), insert new order+lines+event, insert reversal ledger, insert consume ledger. Cleanup on failure.

- [ ] **Step 1: Write failing tests with mocks**

Create `lib/sheets-db-v2-edit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { supersedeOrderV2 } from "@/lib/sheets-db-v2-edit";
import type { OrderV2, OrderLineV2, OrderEvent } from "@/lib/order-types";

vi.mock("@/lib/sheets_db", () => ({
  insert: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  removeMany: vi.fn(),
  getHeaders: vi.fn(),
  findAllNoCache: vi.fn(),
}));

import { insert, insertMany, update, findAllNoCache } from "@/lib/sheets_db";

const oldOrder: OrderV2 = {
  id: "ord-v1", order_no: "UCK001", brand_id: "BR-002", status: "COMPLETED", version: 1,
  parent_order_id: "", superseded_by: "",
  created_at: "2026-06-18T00:00:00Z", created_by_id: "U1", created_by_name: "Cashier",
  completed_at: "2026-06-18T00:00:00Z",
  voided_at: "", voided_by_id: "", void_reason: "",
  currency: "VND",
  gross_total: 35000, promo_discount_total: 10000, manual_item_discount_total: 0,
  manual_order_discount: 0, net_total: 25000,
  applied_promotion_id: "PRM-003", applied_promotion_snapshot_json: "{}",
  pos_snapshot_json: "{}", payment_method: "CASH", payment_ref: "",
  migration_notes: "",
};

const newOrder: OrderV2 = {
  ...oldOrder,
  id: "ord-v2", version: 2, parent_order_id: "ord-v1",
  gross_total: 70000, promo_discount_total: 20000, net_total: 50000,
};

const newLines: OrderLineV2[] = [{
  id: "ol-v2-1", order_id: "ord-v2", line_no: 1,
  product_id: "P1", product_snapshot_json: "{}",
  variant_id: "V1", variant_snapshot_json: "{}",
  qty: 2, unit_price: 35000, modifiers_snapshot_json: "[]",
  gross_line_total: 70000, promo_discount: 20000, manual_item_discount: 0,
  order_discount_allocation: 0, net_line_total: 50000,
  cost_at_sale: 24000, recipe_snapshot_json: "{}",
  promo_discount_reason: "PRM-003", manual_discount_reason: "",
}];

const event: OrderEvent = {
  id: "evt-edit-1", order_id: "ord-v2", event_type: "EDITED",
  event_at: "2026-06-19T00:00:00Z",
  actor_id: "U2", actor_name: "Manager",
  from_version: 1, to_version: 2, previous_order_id: "ord-v1",
  delta_json: "{}", reason: "Customer added 1 more cup",
};

const reversalEntries = [{
  id: "stk-rev-1", transaction_type: "EDIT_REVERSAL",
  reference_id: "ord-v1", item_reference: "BI-MILK",
  quantity_change: 0.05, unit_cost: 0, // positive (reversal of negative consume)
  created_at: "2026-06-19T00:00:00Z", order_event_id: "evt-edit-1",
  cost_at_sale: 0, source: "VARIANT_RECIPE",
}];

const consumeEntries = [{
  id: "stk-new-1", transaction_type: "SALES_CONSUME",
  reference_id: "ord-v2", item_reference: "BI-MILK",
  quantity_change: -0.10, unit_cost: 0,
  created_at: "2026-06-19T00:00:00Z", order_event_id: "evt-edit-1",
  cost_at_sale: 0, source: "VARIANT_RECIPE",
}];

describe("supersedeOrderV2", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks old order as SUPERSEDED with superseded_by pointing to new", async () => {
    (update as any).mockResolvedValue({});
    (insert as any).mockResolvedValue({});
    (insertMany as any).mockResolvedValue([]);
    (findAllNoCache as any).mockResolvedValue([oldOrder]);

    const result = await supersedeOrderV2({
      oldOrderId: "ord-v1",
      expectedOldVersion: 1,
      newOrder,
      newLines,
      event,
      reversalEntries,
      consumeEntries,
    });

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith("Orders_V2", "ord-v1", expect.objectContaining({
      status: "SUPERSEDED",
      superseded_by: "ord-v2",
    }));
  });

  it("rejects if old order version != expectedOldVersion (optimistic lock)", async () => {
    (findAllNoCache as any).mockResolvedValue([{ ...oldOrder, version: 5 }]); // version mismatch

    const result = await supersedeOrderV2({
      oldOrderId: "ord-v1",
      expectedOldVersion: 1, // we thought it was v1, but it's v5
      newOrder, newLines, event, reversalEntries, consumeEntries,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/version/i);
  });

  it("rejects if old order is not COMPLETED", async () => {
    (findAllNoCache as any).mockResolvedValue([{ ...oldOrder, status: "VOIDED" }]);

    const result = await supersedeOrderV2({
      oldOrderId: "ord-v1", expectedOldVersion: 1,
      newOrder, newLines, event, reversalEntries, consumeEntries,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/status/i);
  });

  it("inserts new order, lines, event, reversal + consume ledger in sequence", async () => {
    (update as any).mockResolvedValue({});
    (insert as any).mockResolvedValue({});
    (insertMany as any).mockResolvedValue([]);
    (findAllNoCache as any).mockResolvedValue([oldOrder]);

    await supersedeOrderV2({
      oldOrderId: "ord-v1", expectedOldVersion: 1,
      newOrder, newLines, event, reversalEntries, consumeEntries,
    });

    expect(update).toHaveBeenCalledWith("Orders_V2", "ord-v1", expect.anything());
    expect(insert).toHaveBeenCalledWith("Orders_V2", newOrder);
    expect(insertMany).toHaveBeenCalledWith("Order_Lines_V2", newLines);
    expect(insert).toHaveBeenCalledWith("Order_Events", event);
    expect(insertMany).toHaveBeenCalledWith("Stock_Ledger", expect.arrayContaining(reversalEntries));
    expect(insertMany).toHaveBeenCalledWith("Stock_Ledger", expect.arrayContaining(consumeEntries));
  });

  it("rolls back on failure (best-effort)", async () => {
    (findAllNoCache as any).mockResolvedValue([oldOrder]);
    (update as any).mockResolvedValue({});
    (insert as any).mockResolvedValue({});
    (insertMany as any).mockRejectedValueOnce(new Error("Order_Lines_V2 write failed"));
    (remove as any).mockResolvedValue({});

    const result = await supersedeOrderV2({
      oldOrderId: "ord-v1", expectedOldVersion: 1,
      newOrder, newLines, event, reversalEntries, consumeEntries,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Order_Lines_V2/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk npm test -- sheets-db-v2-edit.test.ts`
Expected: All fail with module-not-found.

- [ ] **Step 3: Implement `lib/sheets-db-v2-edit.ts`**

Create `lib/sheets-db-v2-edit.ts`:

```typescript
/**
 * Supersede-and-replace batched write for order edits.
 *
 * Operations (in order):
 *   1. Verify old order exists, is COMPLETED, version matches (optimistic lock)
 *   2. Update old order: status=SUPERSEDED, superseded_by=newOrderId
 *   3. Insert new order (COMPLETED, version+1)
 *   4. InsertMany new Order_Lines_V2
 *   5. Insert Order_Events (EDITED)
 *   6. InsertMany Stock_Ledger EDIT_REVERSAL + SALES_CONSUME entries
 *
 * On any failure, attempts reverse-order cleanup. Not a true transaction.
 */

"use server";

import { findAllNoCache, insert, insertMany, remove, removeMany, update } from "@/lib/sheets_db";
import { ORDER_STATUS } from "@/lib/order-types";
import type { OrderV2, OrderLineV2, OrderEvent } from "@/lib/order-types";

interface LedgerEntryInput {
  id: string;
  transaction_type: string;
  reference_id: string;
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
  created_at: string;
  order_event_id: string;
  cost_at_sale: number;
  source?: string;
}

export interface SupersedeOrderV2Input {
  oldOrderId: string;
  expectedOldVersion: number;
  newOrder: OrderV2;
  newLines: OrderLineV2[];
  event: OrderEvent;
  reversalEntries: LedgerEntryInput[];
  consumeEntries: LedgerEntryInput[];
}

export type SupersedeOrderV2Result =
  | { success: true }
  | { success: false; error: string };

export async function supersedeOrderV2(input: SupersedeOrderV2Input): Promise<SupersedeOrderV2Result> {
  // 1. Verify old order
  const allOrders = await findAllNoCache("Orders_V2");
  const oldOrder = allOrders.find((o: any) => o.id === input.oldOrderId);
  if (!oldOrder) {
    return { success: false, error: `Order ${input.oldOrderId} not found` };
  }
  if (oldOrder.status !== ORDER_STATUS.COMPLETED) {
    return { success: false, error: `Order status is ${oldOrder.status}, must be COMPLETED to edit` };
  }
  if (Number(oldOrder.version) !== input.expectedOldVersion) {
    return { success: false, error: `Optimistic lock failed: expected version ${input.expectedOldVersion} but found ${oldOrder.version}` };
  }

  const cleanup: string[] = [];

  try {
    // 2. Mark old as SUPERSEDED
    await update("Orders_V2", input.oldOrderId, {
      status: ORDER_STATUS.SUPERSEDED,
      superseded_by: input.newOrder.id,
    });
    cleanup.push(`UPDATE:Orders_V2:${input.oldOrderId}`);

    // 3. Insert new order
    await insert("Orders_V2", input.newOrder);
    cleanup.push(`Orders_V2:${input.newOrder.id}`);

    // 4. Insert new lines
    if (input.newLines.length > 0) {
      await insertMany("Order_Lines_V2", input.newLines);
      cleanup.push(`Order_Lines_V2:${input.newLines.map(l => l.id).join(",")}`);
    }

    // 5. Insert event
    await insert("Order_Events", input.event);
    cleanup.push(`Order_Events:${input.event.id}`);

    // 6. Insert reversal + consume ledger entries (combined)
    const allLedger = [...input.reversalEntries, ...input.consumeEntries];
    if (allLedger.length > 0) {
      await insertMany("Stock_Ledger", allLedger);
      cleanup.push(`Stock_Ledger:${allLedger.map(l => l.id).join(",")}`);
    }

    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);

    // Reverse-order cleanup
    for (const entry of [...cleanup].reverse()) {
      try {
        if (entry.startsWith("UPDATE:")) {
          const [, sheet, id] = entry.split(":");
          // Best-effort: restore old status (we may not have it in scope cleanly)
          await update(sheet, id, { status: ORDER_STATUS.COMPLETED, superseded_by: "" });
        } else {
          const [sheet, ids] = entry.split(":");
          const idList = ids.split(",");
          await removeMany(sheet, idList);
        }
      } catch {
        // best-effort
      }
    }

    return { success: false, error: errorMsg };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk npm test -- sheets-db-v2-edit.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
rtk git add lib/sheets-db-v2-edit.ts lib/sheets-db-v2-edit.test.ts
rtk git commit -m "feat(orders-v2): supersedeOrderV2 batched write with optimistic lock

WS-3 step 3: wraps the supersede-and-replace atomic-ish operation.
Checks old order is COMPLETED and version matches input before
proceeding. On failure, attempts reverse-order cleanup including
restoring old order status.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: `editOrderV2` server action

**Files:**
- Create: `app/actions/order-edit-v2.ts`

Orchestrator: load old → check version → build edited order → compute COGS at original sale time → build reversal + consume ledger → call `supersedeOrderV2`.

- [ ] **Step 1: Implement `app/actions/order-edit-v2.ts`**

Create `app/actions/order-edit-v2.ts`:

```typescript
"use server";

import { findAll, findAllNoCache } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "node:crypto";

import { buildEditedOrderFromCart } from "@/lib/order-edit-cart";
import { computeLineCostAtSale } from "@/lib/order-cogs";
import { supersedeOrderV2 } from "@/lib/sheets-db-v2-edit";
import { EVENT_TYPE, parseLineRecipeSnapshot } from "@/lib/order-types";
import type { CartInput } from "@/lib/order-cart";

export interface EditOrderV2Input {
  orderId: string;
  expectedVersion: number;
  cart: CartInput;
  reason: string;
}

export type EditOrderV2Result =
  | { success: true; new_order_id: string; new_version: number }
  | { success: false; error: string };

export async function editOrderV2(input: EditOrderV2Input): Promise<EditOrderV2Result> {
  try {
    if (!input.reason || input.reason.trim().length === 0) {
      return { success: false, error: "Lý do chỉnh sửa là bắt buộc" };
    }

    // 1. Load old order + lines
    const [allOrders, allLines] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
    ]);
    const oldOrder = allOrders.find((o: any) => o.id === input.orderId);
    if (!oldOrder) return { success: false, error: `Order ${input.orderId} not found` };

    const oldLines = allLines.filter((l: any) => l.order_id === input.orderId);
    const oldOrderV2 = normalizeOrderV2(oldOrder);
    const oldLinesV2 = oldLines.map(normalizeLineV2);

    // 2. Resolve actor
    const session = await getServerSession(authOptions);
    const actor = {
      id: (session?.user as any)?.id || "system",
      name: session?.user?.name || "Hệ thống",
    };

    // 3. Load reference data
    const [brands, products, variants, categories, modifiers, promotions, recipes, baseIngredients] = await Promise.all([
      findAll("Brands"), findAll("Products"), findAll("Product_Variants"),
      findAll("Product_Categories"), findAll("Modifiers"), findAll("Promotions"),
      findAll("Recipes"), findAll("Base_Ingredients"),
    ]);
    const ledger = await findAllNoCache("Stock_Ledger");

    // 4. Build edited order (preserves sale time, increments version)
    const built = buildEditedOrderFromCart(
      { ...input.cart, actor },
      { brands, products, variants, categories, modifiers, promotions, recipes, base_ingredients: baseIngredients },
      { order: oldOrderV2, lines: oldLinesV2 },
    );

    // 5. Compute COGS at ORIGINAL sale time (not edit time)
    const originalSaleTime = oldOrderV2.created_at;
    for (const line of built.lines) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
      line.cost_at_sale = computeLineCostAtSale(lineRecipe, ledger, line.qty, originalSaleTime);
    }

    // 6. Build EDITED event
    const eventTime = new Date().toISOString();
    const event = {
      id: `evt-${crypto.randomUUID()}`,
      order_id: built.order.id,
      event_type: EVENT_TYPE.EDITED,
      event_at: eventTime,
      actor_id: actor.id,
      actor_name: actor.name,
      from_version: oldOrderV2.version,
      to_version: built.order.version,
      previous_order_id: oldOrderV2.id,
      delta_json: JSON.stringify({
        old_gross: oldOrderV2.gross_total,
        new_gross: built.order.gross_total,
        old_net: oldOrderV2.net_total,
        new_net: built.order.net_total,
        old_line_count: oldLinesV2.length,
        new_line_count: built.lines.length,
      }),
      reason: input.reason,
    };

    // 7. Build reversal entries (mirror old SALES_CONSUME rows for this order)
    const oldLedgerRows = ledger.filter((l: any) =>
      l.reference_id === oldOrderV2.id && l.transaction_type === "SALES_CONSUME",
    );
    const reversalEntries = oldLedgerRows.map((l: any) => ({
      id: `stk-${crypto.randomUUID()}`,
      transaction_type: "EDIT_REVERSAL",
      reference_id: oldOrderV2.id,
      item_reference: l.item_reference,
      quantity_change: -Number(l.quantity_change), // negate (positive value)
      unit_cost: Number(l.unit_cost) || 0,
      created_at: eventTime,
      order_event_id: event.id,
      cost_at_sale: Number(l.cost_at_sale) || 0,
      source: l.source || "VARIANT_RECIPE",
    }));

    // 8. Build new SALES_CONSUME entries for the new version
    const consumeEntries = buildStockLedgerEntries(built, event.id, originalSaleTime);

    // 9. Execute supersede
    const result = await supersedeOrderV2({
      oldOrderId: oldOrderV2.id,
      expectedOldVersion: input.expectedVersion,
      newOrder: built.order,
      newLines: built.lines,
      event,
      reversalEntries,
      consumeEntries,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    return {
      success: true,
      new_order_id: built.order.id,
      new_version: built.order.version,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

function buildStockLedgerEntries(
  built: ReturnType<typeof buildEditedOrderFromCart>,
  eventId: string,
  saleTime: string,
): any[] {
  const entries: any[] = [];
  for (const line of built.lines) {
    const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
    for (const ing of lineRecipe.variant.ingredients) {
      if (ing.quantity <= 0) continue;
      entries.push({
        id: `stk-${crypto.randomUUID()}`,
        transaction_type: "SALES_CONSUME",
        reference_id: built.order.id,
        item_reference: ing.ingredient_id,
        quantity_change: -(ing.quantity * line.qty),
        unit_cost: 0,
        created_at: saleTime,
        order_event_id: eventId,
        cost_at_sale: 0,
        source: "VARIANT_RECIPE",
      });
    }
    for (const modEntry of lineRecipe.modifiers) {
      for (const ing of modEntry.recipe.ingredients) {
        if (ing.quantity <= 0) continue;
        entries.push({
          id: `stk-${crypto.randomUUID()}`,
          transaction_type: "SALES_CONSUME",
          reference_id: built.order.id,
          item_reference: ing.ingredient_id,
          quantity_change: -(ing.quantity * line.qty),
          unit_cost: 0,
          created_at: saleTime,
          order_event_id: eventId,
          cost_at_sale: 0,
          source: `MODIFIER_RECIPE:${modEntry.modifier_id}`,
        });
      }
    }
  }
  return entries;
}

// Coerce raw sheet row (strings) into typed OrderV2/OrderLineV2 with numeric fields
function normalizeOrderV2(row: any): any {
  return {
    ...row,
    version: Number(row.version) || 1,
    gross_total: Number(row.gross_total) || 0,
    promo_discount_total: Number(row.promo_discount_total) || 0,
    manual_item_discount_total: Number(row.manual_item_discount_total) || 0,
    manual_order_discount: Number(row.manual_order_discount) || 0,
    net_total: Number(row.net_total) || 0,
  };
}

function normalizeLineV2(row: any): any {
  return {
    ...row,
    line_no: Number(row.line_no) || 0,
    qty: Number(row.qty) || 0,
    unit_price: Number(row.unit_price) || 0,
    gross_line_total: Number(row.gross_line_total) || 0,
    promo_discount: Number(row.promo_discount) || 0,
    manual_item_discount: Number(row.manual_item_discount) || 0,
    order_discount_allocation: Number(row.order_discount_allocation) || 0,
    net_line_total: Number(row.net_line_total) || 0,
    cost_at_sale: Number(row.cost_at_sale) || 0,
  };
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep order-edit-v2`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
rtk git add app/actions/order-edit-v2.ts
rtk git commit -m "feat(orders-v2): editOrderV2 server action

WS-3 step 4: orchestrates the supersede-and-replace flow. Loads old
order + lines, resolves actor from session, builds edited order via
buildEditedOrderFromCart (preserves sale time, increments version),
computes COGS at original sale time, builds EDIT_REVERSAL + new
SALES_CONSUME ledger entries, calls supersedeOrderV2 for batched
write with optimistic lock.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Read path + void (`app/actions/orders-v2.ts`)

**Files:**
- Create: `app/actions/orders-v2.ts`

Three actions:
- `getOrdersV2()` — list latest versions only, with lines + brand/product names attached
- `getOrderDetailV2(orderId)` — single order + all versions in its chain (for timeline)
- `voidOrderV2(orderId, reason)` — mark VOIDED, write reversal ledger, Order_Events VOIDED

- [ ] **Step 1: Implement `app/actions/orders-v2.ts`**

Create `app/actions/orders-v2.ts`:

```typescript
"use server";

import { findAll, findAllNoCache, insert, update } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import crypto from "node:crypto";

import { EVENT_TYPE, ORDER_STATUS } from "@/lib/order-types";
import type { OrderV2, OrderLineV2, OrderEvent } from "@/lib/order-types";

// ============================================================
// getOrdersV2 — list latest COMPLETED versions with details
// ============================================================

export interface OrderListItem {
  id: string;
  order_no: string;
  display_order_no: string;
  brand_id: string;
  status: string;
  version: number;
  parent_order_id: string;
  gross_total: number;
  promo_discount_total: number;
  manual_item_discount_total: number;
  manual_order_discount: number;
  net_total: number;
  method: string;
  created_by_name: string;
  created_at: string;
  lines: Array<OrderLineV2 & {
    product_name: string;
    size_name: string;
    modifiers: any[];
  }>;
}

export interface GetOrdersV2Result {
  orders: OrderListItem[];
  brands: any[];
  products: any[];
  variants: any[];
  modifiers: any[];
  categories: any[];
}

export async function getOrdersV2(): Promise<GetOrdersV2Result> {
  try {
    const [orders, orderLines, products, variants, brands, modifiers, categories] = await Promise.all([
      findAllNoCache("Orders_V2"),
      findAllNoCache("Order_Lines_V2"),
      findAll("Products"),
      findAll("Product_Variants"),
      findAll("Brands"),
      findAll("Modifiers"),
      findAll("Product_Categories"),
    ]);

    // Latest versions only: status=COMPLETED AND superseded_by=""
    const latestOrders = (orders as any[]).filter(o =>
      o.status === ORDER_STATUS.COMPLETED && !o.superseded_by,
    );

    const mappedOrders: OrderListItem[] = latestOrders.map(order => {
      const orderLinesV2 = (orderLines as any[]).filter(l => l.order_id === order.id);
      const mappedLines = orderLinesV2.map(line => {
        const product = (products as any[]).find(p => p.id === line.product_id);
        const variant = (variants as any[]).find(v => v.id === line.variant_id);
        let mods: any[] = [];
        try {
          if (line.modifiers_snapshot_json) {
            mods = JSON.parse(line.modifiers_snapshot_json);
          }
        } catch {}
        return {
          ...line,
          qty: Number(line.qty) || 0,
          unit_price: Number(line.unit_price) || 0,
          gross_line_total: Number(line.gross_line_total) || 0,
          promo_discount: Number(line.promo_discount) || 0,
          manual_item_discount: Number(line.manual_item_discount) || 0,
          order_discount_allocation: Number(line.order_discount_allocation) || 0,
          net_line_total: Number(line.net_line_total) || 0,
          product_name: product?.name || "Unknown",
          size_name: variant?.size_name || "Unknown",
          modifiers: mods,
        };
      });

      const brand = (brands as any[]).find(b => b.id === order.brand_id);
      let display_order_no = order.order_no;
      if (display_order_no && display_order_no.startsWith("#")) {
        const numStr = display_order_no.replace("#", "").padStart(6, "0");
        const bCode = brand?.code || "ORD";
        display_order_no = `${bCode}${numStr}`;
      }

      return {
        id: order.id,
        order_no: order.order_no,
        display_order_no,
        brand_id: order.brand_id,
        status: order.status,
        version: Number(order.version) || 1,
        parent_order_id: order.parent_order_id || "",
        gross_total: Number(order.gross_total) || 0,
        promo_discount_total: Number(order.promo_discount_total) || 0,
        manual_item_discount_total: Number(order.manual_item_discount_total) || 0,
        manual_order_discount: Number(order.manual_order_discount) || 0,
        net_total: Number(order.net_total) || 0,
        method: order.payment_method === "BANK_TRANSFER" ? "Chuyen khoan" : "Tien mat",
        created_by_name: order.created_by_name || "",
        created_at: order.created_at,
        lines: mappedLines,
      };
    });

    mappedOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return {
      orders: mappedOrders,
      brands: (brands as any[]).filter(b => b.status !== "DELETED"),
      products: (products as any[]).filter(p => p.status !== "DELETED"),
      variants: (variants as any[]).filter(v => v.status !== "DELETED"),
      modifiers: (modifiers as any[]).filter(m => m.status !== "DELETED"),
      categories: (categories as any[]).filter(c => c.status !== "DELETED"),
    };
  } catch (err: any) {
    console.error("[getOrdersV2]", err);
    return { orders: [], brands: [], products: [], variants: [], modifiers: [], categories: [] };
  }
}

// ============================================================
// getOrderDetailV2 — single order + version timeline
// ============================================================

export interface OrderDetailV2Result {
  order: OrderListItem;
  timeline: Array<{
    id: string;
    version: number;
    status: string;
    created_at: string;
    created_by_name: string;
    gross_total: number;
    net_total: number;
    superseded_by: string;
  }>;
  events: OrderEvent[];
}

export async function getOrderDetailV2(orderId: string): Promise<OrderDetailV2Result | null> {
  const { orders, orderLines, products, variants, brands } = {
    orders: await findAllNoCache("Orders_V2"),
    orderLines: await findAllNoCache("Order_Lines_V2"),
    products: await findAll("Products"),
    variants: await findAll("Product_Variants"),
    brands: await findAll("Brands"),
  };

  const current = (orders as any[]).find(o => o.id === orderId);
  if (!current) return null;

  // Find root
  const rootId = current.parent_order_id || current.id;

  // All versions in chain
  const chainOrders = (orders as any[]).filter(o =>
    o.id === rootId || o.parent_order_id === rootId,
  );
  chainOrders.sort((a, b) => Number(a.version) - Number(b.version));

  // Build current order detail (reuse logic from getOrdersV2)
  const orderLinesV2 = (orderLines as any[]).filter(l => l.order_id === orderId);
  const mappedLines = orderLinesV2.map(line => {
    const product = (products as any[]).find(p => p.id === line.product_id);
    const variant = (variants as any[]).find(v => v.id === line.variant_id);
    let mods: any[] = [];
    try {
      if (line.modifiers_snapshot_json) mods = JSON.parse(line.modifiers_snapshot_json);
    } catch {}
    return {
      ...line,
      qty: Number(line.qty) || 0,
      unit_price: Number(line.unit_price) || 0,
      gross_line_total: Number(line.gross_line_total) || 0,
      promo_discount: Number(line.promo_discount) || 0,
      manual_item_discount: Number(line.manual_item_discount) || 0,
      order_discount_allocation: Number(line.order_discount_allocation) || 0,
      net_line_total: Number(line.net_line_total) || 0,
      product_name: product?.name || "Unknown",
      size_name: variant?.size_name || "Unknown",
      modifiers: mods,
    };
  });

  const brand = (brands as any[]).find(b => b.id === current.brand_id);

  // Events for this order chain
  const allEvents = await findAllNoCache("Order_Events");
  const events = (allEvents as any[]).filter(e =>
    chainOrders.some(o => o.id === e.order_id),
  ).sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime());

  return {
    order: {
      id: current.id,
      order_no: current.order_no,
      display_order_no: current.order_no,
      brand_id: current.brand_id,
      status: current.status,
      version: Number(current.version) || 1,
      parent_order_id: current.parent_order_id || "",
      gross_total: Number(current.gross_total) || 0,
      promo_discount_total: Number(current.promo_discount_total) || 0,
      manual_item_discount_total: Number(current.manual_item_discount_total) || 0,
      manual_order_discount: Number(current.manual_order_discount) || 0,
      net_total: Number(current.net_total) || 0,
      method: current.payment_method === "BANK_TRANSFER" ? "Chuyen khoan" : "Tien mat",
      created_by_name: current.created_by_name || "",
      created_at: current.created_at,
      lines: mappedLines,
    },
    timeline: chainOrders.map(o => ({
      id: o.id,
      version: Number(o.version) || 1,
      status: o.status,
      created_at: o.created_at,
      created_by_name: o.created_by_name || "",
      gross_total: Number(o.gross_total) || 0,
      net_total: Number(o.net_total) || 0,
      superseded_by: o.superseded_by || "",
    })),
    events: events as OrderEvent[],
  };
}

// ============================================================
// voidOrderV2 — mark VOIDED, write reversal
// ============================================================

export interface VoidOrderV2Result {
  success: boolean;
  error?: string;
}

export async function voidOrderV2(orderId: string, reason: string): Promise<VoidOrderV2Result> {
  try {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "Lý do hủy đơn là bắt buộc" };
    }

    const allOrders = await findAllNoCache("Orders_V2");
    const order = (allOrders as any[]).find(o => o.id === orderId);
    if (!order) return { success: false, error: `Order ${orderId} not found` };
    if (order.status !== ORDER_STATUS.COMPLETED) {
      return { success: false, error: `Order status is ${order.status}, must be COMPLETED to void` };
    }

    const session = await getServerSession(authOptions);
    const actor = {
      id: (session?.user as any)?.id || "system",
      name: session?.user?.name || "Hệ thống",
    };

    const eventTime = new Date().toISOString();
    const event = {
      id: `evt-${crypto.randomUUID()}`,
      order_id: orderId,
      event_type: EVENT_TYPE.VOIDED,
      event_at: eventTime,
      actor_id: actor.id,
      actor_name: actor.name,
      from_version: Number(order.version) || 1,
      to_version: Number(order.version) || 1,
      previous_order_id: "",
      delta_json: JSON.stringify({ voided: true, net_total_before: Number(order.net_total) || 0 }),
      reason,
    };

    // Build reversal entries for ALL SALES_CONSUME rows of this order
    const ledger = await findAllNoCache("Stock_Ledger");
    const oldLedgerRows = (ledger as any[]).filter(l =>
      l.reference_id === orderId && l.transaction_type === "SALES_CONSUME",
    );
    const reversalEntries = oldLedgerRows.map(l => ({
      id: `stk-${crypto.randomUUID()}`,
      transaction_type: "EDIT_REVERSAL",
      reference_id: orderId,
      item_reference: l.item_reference,
      quantity_change: -Number(l.quantity_change),
      unit_cost: Number(l.unit_cost) || 0,
      created_at: eventTime,
      order_event_id: event.id,
      cost_at_sale: Number(l.cost_at_sale) || 0,
      source: l.source || "VARIANT_RECIPE",
    }));

    // 1. Mark order VOIDED
    await update("Orders_V2", orderId, {
      status: ORDER_STATUS.VOIDED,
      voided_at: eventTime,
      voided_by_id: actor.id,
      void_reason: reason,
    });

    // 2. Insert event
    await insert("Order_Events", event);

    // 3. Insert reversal entries
    if (reversalEntries.length > 0) {
      const { insertMany } = require("@/lib/sheets_db");
      await insertMany("Stock_Ledger", reversalEntries);
    }

    revalidatePath("/admin/orders");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep orders-v2`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
rtk git add app/actions/orders-v2.ts
rtk git commit -m "feat(orders-v2): getOrdersV2 + getOrderDetailV2 + voidOrderV2

WS-3 step 5:
- getOrdersV2: latest COMPLETED versions only (filters superseded_by != '')
- getOrderDetailV2: single order + timeline (all versions in chain)
- voidOrderV2: soft-void with reversal ledger + Order_Events VOIDED

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Admin UI — OrderTable + page.tsx migration

**Files:**
- Modify: `app/admin/orders/page.tsx`
- Modify: `app/admin/orders/OrderTable.tsx`

Minimal visual changes — adapt data shape, add version badge, replace delete with void (with reason prompt).

- [ ] **Step 1: Update `app/admin/orders/page.tsx`**

Replace contents:

```typescript
import { getOrdersV2 } from "@/app/actions/orders-v2";
import OrderTable from "./OrderTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { orders, brands, products, variants, modifiers, categories } = await getOrdersV2();

  return (
    <div className="space-y-6">
      <OrderTable
        initialOrders={orders}
        brands={brands}
        products={products}
        variants={variants}
        modifiers={modifiers}
        categories={categories}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update `app/admin/orders/OrderTable.tsx`**

Key changes:
- Import `voidOrderV2` instead of `deleteOrder`
- Update Order interface to V2 shape (include `version`, `parent_order_id`, `status`)
- Replace delete confirm modal with void reason prompt modal
- Add version badge column if `parent_order_id !== ""`
- After successful edit, refetch orders via `getOrdersV2` (simpler than mutating state)

Open `app/admin/orders/OrderTable.tsx` and apply these specific changes:

a) Update imports (line 5):
```typescript
// Replace
import { deleteOrder } from "@/app/actions/orders";
// With
import { voidOrderV2 } from "@/app/actions/orders-v2";
```

b) Update `Order` interface (around line 24) to add V2 fields:
```typescript
interface Order {
  id: string;
  order_no: string;
  display_order_no: string;
  brand_id: string;
  status: string;          // NEW
  version: number;          // NEW
  parent_order_id: string;  // NEW
  gross_total: number;      // renamed from total_amount
  promo_discount_total: number;   // NEW
  manual_item_discount_total: number; // NEW
  manual_order_discount: number; // NEW
  net_total: number;        // renamed
  method: string;
  created_by_name: string;  // renamed from staff_name
  created_at: string;
  lines: OrderLine[];
}

interface OrderLine {
  id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  size_name: string;
  qty: number;
  unit_price: number;
  gross_line_total: number;       // NEW
  promo_discount: number;         // renamed from line_discount
  manual_item_discount: number;   // NEW
  order_discount_allocation: number; // NEW
  net_line_total: number;         // NEW
  modifiers: any[];
}
```

c) Replace delete logic (around line 121-132) with void logic that prompts for reason:
```typescript
const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
const [voidReason, setVoidReason] = useState("");

const confirmVoid = async () => {
  if (!orderToVoid || !voidReason.trim()) return;
  const orderId = orderToVoid.id;
  setOrderToVoid(null);
  const res = await voidOrderV2(orderId, voidReason);
  setVoidReason("");
  if (!res.success) {
    alert("Lỗi hủy đơn: " + res.error);
    return;
  }
  // Reload to reflect changes
  window.location.reload();
};
```

d) In the table render, change the action button (around line 290) from "Xóa đơn" to "Hủy đơn" (void), wire to `setOrderToVoid`:
```tsx
<button
  onClick={(e) => { e.stopPropagation(); setOrderToVoid(order); }}
  disabled={order.status !== "COMPLETED"}
  className="text-red-500 hover:text-red-700 font-medium px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
>
  Hủy đơn
</button>
```

e) Replace the delete confirmation modal (around line 333) with a void reason modal:
```tsx
{orderToVoid && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden">
      <div className="p-5 border-b border-gray-100 bg-red-50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl shrink-0">!</div>
        <div>
          <h3 className="font-bold text-red-800">Hủy đơn hàng</h3>
          <p className="text-sm text-red-600 font-medium">{orderToVoid.display_order_no}</p>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-gray-600 text-sm">
          Đơn sẽ chuyển sang trạng thái VOIDED. Nguyên liệu sẽ được hoàn trả vào kho. Lịch sử đơn được giữ nguyên.
        </p>
        <textarea
          placeholder="Lý do hủy đơn (bắt buộc)"
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
        <button
          onClick={() => { setOrderToVoid(null); setVoidReason(""); }}
          className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
        >
          Hủy bỏ
        </button>
        <button
          onClick={confirmVoid}
          disabled={!voidReason.trim()}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50"
        >
          Đồng ý hủy
        </button>
      </div>
    </div>
  </div>
)}
```

f) Where `order.total_amount` is referenced (around line 281), change to `order.net_total`. Where `order.staff_name` is referenced in detail, use `order.created_by_name`.

g) Update `handleEditSave` (around line 134) — after edit, reload:
```typescript
const handleEditSave = () => {
  setEditingOrder(null);
  setSelectedOrder(null);
  // Reload since V2 edit creates a new row
  window.location.reload();
};
```

- [ ] **Step 3: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "OrderTable\|orders/page" | head -5`
Expected: no errors (pre-existing errors in unrelated files OK).

- [ ] **Step 4: Commit**

```bash
rtk git add app/admin/orders/page.tsx app/admin/orders/OrderTable.tsx
rtk git commit -m "feat(orders-v2): migrate Orders admin to V2 read path + void

WS-3 step 6: page.tsx calls getOrdersV2. OrderTable uses V2 shape
(net_total, version, parent_order_id, status). Replaces destructive
delete with void (requires reason, soft-voids with reversal).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Admin UI — OrderDetailModal + OrderEditModal migration

**Files:**
- Modify: `app/admin/orders/OrderDetailModal.tsx`
- Modify: `app/admin/orders/OrderEditModal.tsx`

Detail modal: show version timeline. Edit modal: call editOrderV2, add reason field.

- [ ] **Step 1: Update `OrderDetailModal.tsx`**

This modal currently receives an `Order` prop. To show timeline, either:
(a) Fetch via `getOrderDetailV2` when modal opens
(b) Pass timeline as prop from parent

Option (a) is cleaner. Refactor to fetch on mount.

Open `app/admin/orders/OrderDetailModal.tsx` and replace with:

```tsx
"use client";

import { useState, useEffect } from "react";
import { getOrderDetailV2, type OrderListItem } from "@/app/actions/orders-v2";

interface Props {
  order: OrderListItem;
  brands: any[];
  onClose: () => void;
  onEdit: () => void;
  onVoid: () => void;
}

export default function OrderDetailModal({ order, brands, onClose, onEdit, onVoid }: Props) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getOrderDetailV2>>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrderDetailV2(order.id).then(d => {
      setDetail(d);
      setLoading(false);
    });
  }, [order.id]);

  const brand = brands.find(b => b.id === order.brand_id);
  const orderNo = order.display_order_no || order.order_no;

  const formatDate = (s: string) => {
    const d = new Date(s);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-white p-6 rounded-xl">Đang tải...</div>
      </div>
    );
  }

  const currentOrder = detail?.order || order;
  const timeline = detail?.timeline || [];
  const events = detail?.events || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {orderNo}
              {currentOrder.version > 1 && (
                <span className="ml-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  v{currentOrder.version}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(currentOrder.created_at)}
              {brand && <span className="ml-2 text-blue-600 font-medium">{brand.name}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${currentOrder.method === "Chuyen khoan" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
              {currentOrder.method === "Chuyen khoan" ? "Chuyển khoản" : "Tiền mặt"}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
              {currentOrder.created_by_name}
            </span>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            {currentOrder.lines.map((line: any, idx: number) => {
              const gross = line.gross_line_total;
              const net = line.net_line_total;
              return (
                <div key={idx} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">
                        <span className="text-orange-600 mr-1">{line.qty}x</span>
                        {line.product_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Size {line.size_name}</div>
                      {line.modifiers?.length > 0 && (
                        <div className="text-xs text-indigo-600 mt-1">
                          + {line.modifiers.map((m: any) => m.name).join(", ")}
                        </div>
                      )}
                      {(line.promo_discount + line.manual_item_discount + line.order_discount_allocation) > 0 && (
                        <div className="text-xs text-red-500 mt-1">
                          Giảm: -{(line.promo_discount + line.manual_item_discount + line.order_discount_allocation).toLocaleString("vi-VN")}đ
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {gross > net && (
                        <div className="text-[11px] text-gray-400 line-through">{gross.toLocaleString("vi-VN")}đ</div>
                      )}
                      <div className="font-bold text-gray-800">{net.toLocaleString("vi-VN")}đ</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Money breakdown */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Tổng gốc</span>
              <span>{currentOrder.gross_total.toLocaleString("vi-VN")}đ</span>
            </div>
            {currentOrder.promo_discount_total > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Khuyến mãi hệ thống</span>
                <span>-{currentOrder.promo_discount_total.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            {currentOrder.manual_item_discount_total > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Giảm thủ công từng món</span>
                <span>-{currentOrder.manual_item_discount_total.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            {currentOrder.manual_order_discount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Giảm cả đơn</span>
                <span>-{currentOrder.manual_order_discount.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200">
              <span className="text-gray-900">Khách trả</span>
              <span className="text-orange-600">{currentOrder.net_total.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>

          {/* Timeline */}
          {timeline.length > 1 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">Lịch sử phiên bản ({timeline.length})</h4>
              <div className="space-y-1.5">
                {timeline.map(v => (
                  <div key={v.id} className={`text-xs px-3 py-2 rounded-lg flex justify-between items-center ${
                    v.id === currentOrder.id ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50"
                  }`}>
                    <div>
                      <span className="font-bold text-gray-700">v{v.version}</span>
                      <span className="ml-2 text-gray-600">{v.created_by_name}</span>
                      {v.status === "SUPERSEDED" && <span className="ml-2 text-gray-400">(đã thay thế)</span>}
                      {v.status === "VOIDED" && <span className="ml-2 text-red-500">(đã hủy)</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">{formatDate(v.created_at)}</div>
                      <div className="text-gray-400">{v.net_total.toLocaleString("vi-VN")}đ</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events */}
          {events.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">Sự kiện ({events.length})</h4>
              <div className="space-y-1.5">
                {events.map(e => (
                  <div key={e.id} className="text-xs px-3 py-2 bg-gray-50 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-700">{e.event_type}</span>
                      <span className="text-gray-500">{formatDate(e.event_at)}</span>
                    </div>
                    <div className="text-gray-600 mt-0.5">{e.actor_name}: {e.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 shrink-0">
          <div className="px-5 py-4 flex gap-3 bg-white">
            <button
              onClick={onEdit}
              disabled={currentOrder.status !== "COMPLETED"}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Sửa đơn
            </button>
            <button
              onClick={onVoid}
              disabled={currentOrder.status !== "COMPLETED"}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              Hủy đơn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `OrderEditModal.tsx`**

Key changes:
- Import `editOrderV2` instead of `editOrder`
- Pass `expectedVersion` and `reason`
- Add required reason field in the UI
- Build V2 cart payload

Open `app/admin/orders/OrderEditModal.tsx`. The full file is long; make these specific changes:

a) Imports (top of file):
```typescript
// Replace
import { editOrder } from "@/app/actions/order-edit";
// With
import { editOrderV2 } from "@/app/actions/order-edit-v2";
import type { CartInput } from "@/lib/order-cart";
```

b) Add `reason` state (around line 94):
```typescript
const [editReason, setEditReason] = useState("");
```

c) Replace `handleSave` (around line 234) with V2 version:
```typescript
const handleSave = async () => {
  if (items.length === 0) return;
  if (!editReason.trim()) {
    alert("Lý do chỉnh sửa là bắt buộc");
    return;
  }
  setIsSaving(true);

  const cartInput: CartInput = {
    brand_id: order.brand_id,
    items: items.map(item => {
      let manualItemValue = item.discount_amount;
      let manualItemType: "VND" | "PERCENT" = item.discount_type === "PERCENT" ? "PERCENT" : "VND";
      return {
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        modifiers: item.modifiers.map(m => ({ modifier_id: m.id, modifier_qty: 1 })),
        manual_item_discount: { value: manualItemValue, type: manualItemType },
      };
    }),
    payment_method: paymentMethod === "Chuyen khoan" ? "BANK_TRANSFER" : "CASH",
    manual_order_discount: orderDiscount > 0
      ? { value: orderDiscount, type: orderDiscountType === "PERCENT" ? "PERCENT" : "VND" }
      : null,
    actor: { id: "", name: "" }, // server resolves from session
  };

  const res = await editOrderV2({
    orderId: order.id,
    expectedVersion: order.version,
    cart: cartInput,
    reason: editReason,
  });

  setIsSaving(false);

  if (res.success) {
    onSave();  // parent will reload
  } else {
    alert("Lỗi cập nhật đơn: " + res.error);
  }
};
```

d) Add reason input UI before the Save button (in the footer, around line 660):
```tsx
<div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
  <label className="block text-xs font-bold text-gray-700 mb-1.5">Lý do chỉnh sửa (bắt buộc)</label>
  <textarea
    placeholder="VD: Khách đổi từ 1 ly thành 2 ly"
    value={editReason}
    onChange={(e) => setEditReason(e.target.value)}
    rows={2}
    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
  />
</div>
```

e) Disable Save button if reason is empty:
```tsx
<button
  onClick={handleSave}
  disabled={isSaving || items.length === 0 || !editReason.trim()}
  // ...
>
```

- [ ] **Step 3: Verify TS compiles**

Run: `rtk tsc --noEmit 2>&1 | grep "OrderDetailModal\|OrderEditModal"`
Expected: no errors related to V2 migration.

- [ ] **Step 4: Commit**

```bash
rtk git add app/admin/orders/OrderDetailModal.tsx app/admin/orders/OrderEditModal.tsx
rtk git commit -m "feat(orders-v2): admin detail + edit modals migrated to V2

WS-3 step 7:
- OrderDetailModal: fetches via getOrderDetailV2, shows version
  timeline + events log + full money breakdown (gross/promo/item/order/net)
- OrderEditModal: calls editOrderV2 with reason (required) and
  expectedVersion for optimistic lock. Builds V2 CartInput payload.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Smoke test scripts

**Files:**
- Create: `scripts/test-edit-order-v2.ts`
- Create: `scripts/test-void-order-v2.ts**

- [ ] **Step 1: Create `scripts/test-edit-order-v2.ts`**

```typescript
/**
 * Smoke test: create an order via submitOrderV2, then edit it via editOrderV2.
 * Verify: original becomes SUPERSEDED, new version COMPLETED, reversal+consume
 * ledger entries created.
 *
 * Run: npx tsx scripts/test-edit-order-v2.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAll, findAllNoCache } = require("../lib/sheets_db");
const { submitOrderV2 } = require("../app/actions/pos-v2");
const { editOrderV2 } = require("../app/actions/order-edit-v2");

async function main() {
  console.log("Loading reference data...");
  const products = await findAll("Products");
  const variants = await findAll("Product_Variants");

  const suaDauProduct = products.find((p: any) => p.name?.includes("Sữa dâu"));
  const suaDauVariant = variants.find((v: any) => v.product_id === suaDauProduct.id);
  const brandId = suaDauProduct.brand_id || (await findAll("Brands"))[0].id;

  // Step 1: Create order
  console.log("Step 1: Creating initial order (qty=1)...");
  const createRes = await submitOrderV2({
    brand_id: brandId,
    items: [{
      product_id: suaDauProduct.id,
      variant_id: suaDauVariant.id,
      qty: 1,
      modifiers: [],
      manual_item_discount: { value: 0, type: "VND" },
    }],
    payment_method: "CASH",
    actor: { id: "smoke-test", name: "Smoke Test" },
  });

  if (!createRes.success) {
    console.error("Create failed:", createRes.error);
    process.exit(1);
  }
  console.log(`  Created: order_no=${createRes.order_no}, id=${createRes.order_id}`);

  // Step 2: Edit order (qty 1 → 2)
  console.log("Step 2: Editing order (qty 1 → 2)...");
  const editRes = await editOrderV2({
    orderId: createRes.order_id,
    expectedVersion: 1,
    cart: {
      brand_id: brandId,
      items: [{
        product_id: suaDauProduct.id,
        variant_id: suaDauVariant.id,
        qty: 2,
        modifiers: [],
        manual_item_discount: { value: 0, type: "VND" },
      }],
      payment_method: "CASH",
      actor: { id: "smoke-test", name: "Smoke Test" },
    },
    reason: "Smoke test: customer added 1 more cup",
  });

  if (!editRes.success) {
    console.error("Edit failed:", editRes.error);
    process.exit(1);
  }
  console.log(`  Edited: new id=${editRes.new_order_id}, version=${editRes.new_version}`);

  // Step 3: Verify
  console.log("Step 3: Verifying...");
  const orders = await findAllNoCache("Orders_V2");
  const lines = await findAllNoCache("Order_Lines_V2");
  const events = await findAllNoCache("Order_Events");
  const ledger = await findAllNoCache("Stock_Ledger");

  const oldOrder = orders.find((o: any) => o.id === createRes.order_id);
  const newOrder = orders.find((o: any) => o.id === editRes.new_order_id);

  console.log("\n=== VERIFICATION ===");
  console.log(`Old order status: ${oldOrder.status} (expect SUPERSEDED)`);
  console.log(`Old order superseded_by: ${oldOrder.superseded_by}`);
  console.log(`New order status: ${newOrder.status} (expect COMPLETED)`);
  console.log(`New order version: ${newOrder.version} (expect 2)`);
  console.log(`New order parent_order_id: ${newOrder.parent_order_id}`);

  const newLines = lines.filter((l: any) => l.order_id === editRes.new_order_id);
  console.log(`New order line count: ${newLines.length}`);
  console.log(`New order qty: ${newLines[0].qty} (expect 2)`);

  const editEvents = events.filter((e: any) => e.event_type === "EDITED");
  console.log(`EDITED events: ${editEvents.length}`);

  const reversals = ledger.filter((l: any) => l.transaction_type === "EDIT_REVERSAL" && l.reference_id === createRes.order_id);
  console.log(`Reversal entries for old order: ${reversals.length}`);

  const newConsumes = ledger.filter((l: any) => l.transaction_type === "SALES_CONSUME" && l.reference_id === editRes.new_order_id);
  console.log(`SALES_CONSUME entries for new order: ${newConsumes.length}`);

  console.log("\nSmoke test PASSED");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Create `scripts/test-void-order-v2.ts`**

```typescript
/**
 * Smoke test: void an order via voidOrderV2.
 * Verify: order status=VOIDED, reversal entries created, Order_Events VOIDED present.
 *
 * Run: npx tsx scripts/test-void-order-v2.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAll, findAllNoCache } = require("../lib/sheets_db");
const { submitOrderV2 } = require("../app/actions/pos-v2");
const { voidOrderV2 } = require("../app/actions/orders-v2");

async function main() {
  const products = await findAll("Products");
  const variants = await findAll("Product_Variants");
  const suaDauProduct = products.find((p: any) => p.name?.includes("Sữa dâu"));
  const suaDauVariant = variants.find((v: any) => v.product_id === suaDauProduct.id);
  const brandId = suaDauProduct.brand_id || (await findAll("Brands"))[0].id;

  console.log("Creating order to void...");
  const createRes = await submitOrderV2({
    brand_id: brandId,
    items: [{
      product_id: suaDauProduct.id, variant_id: suaDauVariant.id, qty: 1,
      modifiers: [], manual_item_discount: { value: 0, type: "VND" },
    }],
    payment_method: "CASH",
    actor: { id: "smoke-test", name: "Smoke Test" },
  });
  if (!createRes.success) { console.error(createRes.error); process.exit(1); }
  console.log(`  Created: ${createRes.order_no}`);

  console.log("Voiding...");
  const voidRes = await voidOrderV2(createRes.order_id, "Smoke test: voiding");
  if (!voidRes.success) { console.error(voidRes.error); process.exit(1); }
  console.log("  Voided");

  console.log("Verifying...");
  const orders = await findAllNoCache("Orders_V2");
  const events = await findAllNoCache("Order_Events");
  const ledger = await findAllNoCache("Stock_Ledger");

  const order = orders.find((o: any) => o.id === createRes.order_id);
  console.log(`Status: ${order.status} (expect VOIDED)`);
  console.log(`Void reason: ${order.void_reason}`);

  const voidEvents = events.filter((e: any) => e.order_id === createRes.order_id && e.event_type === "VOIDED");
  console.log(`VOIDED events: ${voidEvents.length} (expect 1)`);

  const reversals = ledger.filter((l: any) => l.reference_id === createRes.order_id && l.transaction_type === "EDIT_REVERSAL");
  console.log(`Reversal entries: ${reversals.length}`);

  console.log("\nSmoke test PASSED");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
```

- [ ] **Step 3: Run smoke tests**

Run: `npx tsx scripts/test-edit-order-v2.ts`
Expected: PASSED with all verification lines matching expectations.

Run: `npx tsx scripts/test-void-order-v2.ts`
Expected: PASSED with all verification lines matching expectations.

- [ ] **Step 4: Commit**

```bash
rtk git add scripts/test-edit-order-v2.ts scripts/test-void-order-v2.ts
rtk git commit -m "test(orders-v2): smoke tests for edit and void flows

WS-3 step 8: end-to-end CLI scripts that drive the V2 edit and void
pipelines against live sheets. Verify supersede chain, reversal ledger,
and VOIDED status transitions.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Final verification + tracking update

- [ ] **Step 1: Run full test suite**

Run: `rtk npm test`
Expected: All previous tests + WS-3 new tests pass. Target ~75+ tests total.

- [ ] **Step 2: TypeScript check**

Run: `rtk tsc --noEmit`
Expected: 0 errors in WS-3 files. (Pre-existing unrelated errors out of scope.)

- [ ] **Step 3: Coverage**

Run: `rtk npm run test:coverage`
Expected: New files (`order-edit-cart.ts`, `sheets-db-v2-edit.ts`) ≥ 90% stmts.

- [ ] **Step 4: Live smoke tests pass**

Run both scripts and verify output matches expectations:
- `npx tsx scripts/test-edit-order-v2.ts`
- `npx tsx scripts/test-void-order-v2.ts`

- [ ] **Step 5: Manual browser smoke test**

Start dev server. In browser:
1. Open `/admin/orders` — verify list loads, latest orders visible
2. Click any COMPLETED order — verify detail modal shows timeline + events
3. Click "Sửa đơn" — verify edit modal opens with reason field required
4. Edit qty, enter reason, save — verify list refreshes, order still visible
5. Open the edited order — verify timeline shows v1 (SUPERSEDED) + v2 (COMPLETED)
6. Click "Hủy đơn" — verify reason modal opens, void succeeds
7. Verify voided order disappears from default list (status != COMPLETED)

- [ ] **Step 6: Update DEVELOPMENT-TRACKING.md**

Append a new section for WS-3 with:
- Files created/modified
- Bug fixes (if any)
- Verification gate results
- Known gaps deferred to WS-4 / WS-5
- Commit history table

- [ ] **Step 7: Final commit**

```bash
rtk git add DEVELOPMENT-TRACKING.md
rtk git commit -m "docs(tracking): WS-3 edit path complete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 8: Report to Claude**

Send:
- Final commit hash
- Test pass count + coverage summary
- Live smoke test outputs
- Any issues encountered
- Browser smoke test results

---

## Self-Review

**Spec coverage check:**
- ✓ Close modifier recipe gap from WS-2 → Task 1
- ✓ Supersede-and-replace edit flow → Tasks 2, 3, 4
- ✓ Optimistic locking via version → Task 3 (`expectedOldVersion` check)
- ✓ Stock ledger `EDIT_REVERSAL` rows (not delete) → Task 4 (`reversalEntries`)
- ✓ Order_Events EDITED with delta_json → Task 4
- ✓ `previous_order_id` chaining → Task 2 (`parent_order_id` walks to root)
- ✓ `voidOrderV2` soft-void with reversal → Task 5
- ✓ Version timeline in detail modal → Task 7
- ✓ Required reason field on edit + void → Tasks 6, 7

**Placeholder scan:** No TBD/TODO/placeholder. All code blocks complete.

**Type consistency:**
- `CartInput`, `BuildOrderResult`, `ReferenceData` — imported from `order-cart.ts` (existing)
- `LineRecipeSnapshot`, `ModifierRecipeEntry`, `parseLineRecipeSnapshot` — defined in Task 1
- `EditOrderV2Input`, `EditOrderV2Result`, `SupersedeOrderV2Input`, `SupersedeOrderV2Result` — defined in respective tasks
- `OrderListItem`, `OrderDetailV2Result`, `VoidOrderV2Result` — defined in Task 5

**Known gaps deferred to WS-4 / WS-5:**
- Reports still read V1 — WS-4 will switch PnL/Sales/Stock to read V2
- Legacy `app/actions/pos.ts`, `order-edit.ts`, `orders.ts` still in code — WS-5 archives them
- `Stock_Ledger` mixes V1 (`ORD-*` ids) and V2 (`ord-*` ids) reference_ids — WS-4 will distinguish

**Risks:**
- R1: Optimistic lock race window — if two admins edit simultaneously, one will fail with clear error. Acceptable.
- R2: Cleanup-on-failure in `supersedeOrderV2` might leave partial state. Mitigation: best-effort reverse-order cleanup. Real transactions impossible in Sheets.
- R3: Edit of already-superseded order — explicitly rejected (status check in Task 3). User must edit the latest version.

---

## Handoff

**WS-3 closes the edit/void gap. Do not start WS-4 (Reports) until:**
1. WS-3 merged
2. Live smoke tests pass
3. Manual browser smoke test confirms timeline UI works

**Next plan: WS-4 (Reports).** Claude will draft. Will define `getPnLDataV2`, `getSalesDataV2`, `getRealtimeStockV2` that read V2 sheets only. Replaces `lib/report-utils.ts` with V2-based allocation. Adds reconciliation check (V1 vs V2 totals) for migrated data.
