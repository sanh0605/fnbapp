# Topping Standalone Sales — Design

**Date**: 2026-06-27
**Author**: Claude (Coordinator)
**Status**: Approved by user, ready for implementation plan
**Brands affected**: Phin Đi (BR-001) + Uchako (BR-002), shared

## Context

Currently the FNB app models toppings as `Modifiers` — add-ons that attach to a `Variant` (drink size) at order time. The cart schema (`CartInput` in `lib/order-cart.ts`) requires every item to have a `variant_id`, so a customer cannot purchase a topping without also selecting a drink.

The owner wants to sell toppings independently for customers who only want toppings (e.g. a child buying only Trân châu trắng, or someone buying Dâu sấy as a snack).

Today's catalog has 7 active toppings (Modifiers, group "Thêm Topping"):

| ID | Name | Price (VND) |
|---|---|---:|
| MOD-001 | 20ml cốt cà phê | 5.000 |
| MOD-002 | Kem muối | 4.000 |
| MOD-003 | Kem dẻo | 5.000 |
| MOD-004 | Trân châu trắng | 5.000 |
| MOD-005 | Kem muối phô mai | 6.000 |
| MOD-006 | Đào miếng | 10.000 |
| MOD-008 | Dâu sấy | 10.000 |

## Goals

1. Customer can buy any of the 7 toppings as a standalone line item (no drink required).
2. Toppings appear in POS as a distinct catalog section (new category tab).
3. Standalone topping sales flow through the existing order pipeline (`buildOrderFromCart` → `insertOrderV2Records`) with correct COGS, ledger entries, and reports.
4. Admin UI lets the owner toggle each topping's standalone visibility on/off without affecting the modifier's add-on use.

## Non-goals (deferred)

- Auto-sync Modifier recipe → standalone Variant recipe when the modifier recipe changes (manual sync for now).
- Auto-sync Modifier price → Variant price when the modifier price changes (manual sync for now).
- Per-brand topping overrides (toppings are shared across PHD + UCK per owner decision).
- Cashier-facing quick-toggle in POS (admin-only management).
- Migration script to retroactively reclassify historical sales as standalone-topping sales.

## Architecture

Approach A from the brainstorm: each topping becomes its own Product in a new "Topping" category. This reuses the entire existing pipeline with no schema change to `OrderLineV2` or cart logic.

### Data model (no schema change, only new rows)

```
Product_Categories:
  + CAT-007 | Topping | status=ACTIVE

Products (per topping, 7 rows):
  + PROD-029..035 | name=<topping name> | category_id=CAT-007 | status=ACTIVE | brand_id="" | migration_notes="topping-standalone::mod_id=MOD-XXX"

Product_Variants (per product, 7 rows):
  + VAR-038..044 | product_id=<new> | size_name="1 phần" | price=<modifier price> | status=ACTIVE

Recipes (per variant, 7 rows):
  + target_type="PRODUCT_VARIANT" | target_id=<new variant> | ingredients_json=<copy of modifier recipe ingredients>
```

The `migration_notes` field traces each standalone product back to its source modifier for future audit/sync scripts.

### POS catalog filter fix

`app/pos/page.tsx` lines 42-45 currently filter `status !== "DELETED"`. Per `docs/domain-dictionary.md`, `INACTIVE` is supposed to mean "Hidden from new transactions". The current filter is wrong: it shows INACTIVE items in POS.

Change to `status === "ACTIVE"` for both categories and products. This is a targeted correctness fix that also enables the toggle semantics.

### Admin toggle UI

New page `app/admin/products/toppings/page.tsx` with component `components/ToppingsManager.tsx`. Lists every product in CAT-007 with an ON/OFF toggle:

- ON → `update("Products", id, { status: "ACTIVE" })`
- OFF → `update("Products", id, { status: "INACTIVE" })`

Server action `toggleToppingStandalone(productId, enabled)` in `app/admin/products/toppings/actions.ts`.

Toggle only affects standalone visibility — the underlying Modifier remains available as a drink add-on.

## Data setup script

**File**: `scripts/setup-topping-standalone.ts`

Pattern: same as `scripts/import-june-2026-sales.ts` — dry-run default, `--apply` for writes, idempotency via `migration_notes` prefix.

For each `MOD-XXX` in `[MOD-001, MOD-002, MOD-003, MOD-004, MOD-005, MOD-006, MOD-008]`:

1. Load the modifier's recipe: `Recipes.target_type="MODIFIER" AND target_id=MOD-XXX`.
2. Skip if already set up (existing Product with `migration_notes="topping-standalone::mod_id=MOD-XXX"`).
3. Allocate next IDs: PROD-NNN, VAR-NNN (max existing + 1).
4. Build rows:
   - Product row (category=CAT-007, status=ACTIVE, brand_id="")
   - Variant row (size_name="1 phần", price=modifier.price)
   - Recipe row (target_type=PRODUCT_VARIANT, target_id=variant, ingredients copied from modifier recipe)
5. In dry-run: print planned rows. In apply: insert via `insert()` from `lib/sheets_db`.

Also creates CAT-007 if missing.

### Idempotency

Re-running is safe. Script checks for:
- CAT-007 by name "Topping" — skip creation if exists.
- Each Product by `migration_notes` tag — skip creation if exists.

This supports the admin toggle: if a product is toggled to INACTIVE then back to ACTIVE, re-running setup does NOT re-create it.

## POS UI changes

**File**: `app/pos/page.tsx` lines 42-45

```typescript
// Before
const activeCategories = categories.filter(c => c.status !== "DELETED");
const activeProducts = products.filter(p => p.status !== "DELETED");
const activeVariants = variants.filter(v => v.status !== "DELETED");
const activeModifiers = modifiers.filter(m => m.status !== "DELETED");

// After
const activeCategories = categories.filter(c => c.status === "ACTIVE");
const activeProducts = products.filter(p => p.status === "ACTIVE");
const activeVariants = variants.filter(v => v.status === "ACTIVE");
const activeModifiers = modifiers.filter(m => m.status === "ACTIVE");
```

The `Modifiers` filter change is opportunistic: it aligns with the same domain-dictionary contract.

No other POS UI work needed — the "Topping" category tab and product cards render automatically from data.

## Admin UI

**New page**: `app/admin/products/toppings/page.tsx` (server component)

- Loads Products where `category_id === "CAT-007"`
- Loads linked Modifiers via `migration_notes` parsing (or by name match as fallback)
- Renders `<ToppingsManager>` client component

**New component**: `components/ToppingsManager.tsx` (client component)

```
┌───────────────────────────────────────────────────────────┐
│ Topping Standalone Management                             │
├───────────────────────────────────────────────────────────┤
│ Modifier            │ Standalone Product   │ Bán độc lập │
├───────────────────────────────────────────────────────────┤
│ 20ml cốt cà phê     │ PROD-029 / VAR-038   │ [●  ON ]   │
│ Kem muối            │ PROD-030 / VAR-039   │ [●  ON ]   │
│ Kem dẻo             │ PROD-031 / VAR-040   │ [●  ON ]   │
│ Trân châu trắng     │ PROD-032 / VAR-041   │ [●  ON ]   │
│ Kem muối phô mai    │ PROD-033 / VAR-042   │ [●  ON ]   │
│ Đào miếng           │ PROD-034 / VAR-043   │ [●  ON ]   │
│ Dâu sấy             │ PROD-035 / VAR-044   │ [●  ON ]   │
└───────────────────────────────────────────────────────────┘
```

Toggle calls `toggleToppingStandalone(productId, true|false)`. Page calls `revalidatePath("/pos")` so POS reflects the change on next load.

**New server action**: `app/admin/products/toppings/actions.ts`

```typescript
"use server";
export async function toggleToppingStandalone(
  productId: string,
  enabled: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  // Validate productId belongs to CAT-007
  // update("Products", productId, { status: enabled ? "ACTIVE" : "INACTIVE" })
  // revalidatePath("/pos")
  // revalidatePath("/admin/products/toppings")
}
```

## Verification

After data setup script runs with `--apply`:

1. `findAll("Products")` returns 35 rows (28 existing + 7 new).
2. `findAll("Product_Variants")` returns 44 rows (37 existing + 7 new).
3. `findAll("Recipes")` returns 7 new rows with `target_type="PRODUCT_VARIANT"` pointing at new variants.
4. Each new Product has `migration_notes` starting with `topping-standalone::`.

After POS filter change:

1. Open `/pos` — "Topping" category tab appears.
2. Click tab — 7 topping cards render with correct prices.
3. Click a topping — adds to cart as a regular line item (no modifier required).
4. Submit order — order succeeds; ledger entries generated based on the variant recipe.

After admin UI:

1. Open `/admin/products/toppings` — 7 rows render with current status.
2. Toggle one OFF — UI updates; reload POS — that topping no longer appears.
3. Toggle back ON — reload POS — topping reappears.

## Risk boundary / ownership

Per `docs/COLLABORATION.md`:

| Work | Owner | Reviewer | Notes |
|---|---|---|---|
| Design spec | Claude | — | This document. |
| Data setup script | Claude | Codex | Engine/data write — needs Codex review before `--apply`. |
| POS filter change | Antigravity | Codex | UI changing data flow (which items are sellable). |
| Admin toggle page + actions | Antigravity | Codex | Server action mutates data. |
| Recipe sync (modifier↔variant) | Deferred | — | Manual update for now. Future enhancement. |

## Open follow-ups (non-blocking)

- **Recipe drift**: if owner edits a Modifier's recipe (e.g. changes Trân châu trắng ingredient ratio), the standalone Variant recipe does NOT auto-update. Mitigation: add a "Sync from modifier" button in admin UI later.
- **Price drift**: same issue for prices. Manual sync.
- **CAT-007 brand_id**: like other categories, CAT-007 has no `brand_id`. Topping products also have no `brand_id`. Reports-by-brand may bucket these as "unbranded". Out of scope for this spec; same issue exists for PROD-027/028 (see 2026-06-27 tracking entry).
- **Catalog management UX**: owner may want to add/remove standalone toppings beyond the initial 7. Future: "Create standalone topping from modifier" button in admin.
