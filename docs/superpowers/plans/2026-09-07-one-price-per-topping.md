# One price per topping, edited in one place

> **For agentic workers:** REQUIRED SUB-SKILLS: `superpowers:executing-plans`, `superpowers:test-driven-development`. Challenge the plan first. The migration is written and lands with its reader; **running it on the live server is the owner's separate approval**, asked as its own question. No push, no deploy.

**Goal:** make a topping's price impossible to have two values. The owner edits it
once, on the Topping & Tuỳ chọn screen, and the standalone price follows.

**Owner decision 2026-09-07:** *"Luôn cùng giá, sửa một chỗ."* Asked with the
concrete case — Kem muối is 4.000đ on both sides today; raising it to 5.000đ
currently means remembering two screens, and forgetting one is silent.

**Rule this extends:** `BR-CATALOG-003` in
`docs/02-rules/business-rules/catalog.md` — a topping is one thing sold two ways.
This plan makes the price obey that sentence. Record the decision as an addition
to that rule, not a new one.

## Current state (five numbered questions)

Measured 2026-09-07 against production.

1. **States.** A topping's price has two independent stores today:
   `modifiers.price` (the add-on price) and the linked product's single
   `product_variants.price` (the standalone price). After: one input, both stores
   always equal. A topping with no linked product (`MOD-009`) keeps one store and
   nothing to sync.
2. **Buttons.** The Topping screen's save keeps working and does more. On the
   product edit form, the price field for a topping that has a linked modifier
   becomes read-only, with a line saying where to change it. No button is added
   or removed.
3. **Lists.** Changed: nothing listed changes. Not changed: the POS grid, the
   product list, every report, order history.
4. **Inputs.** One price field, on the Topping screen. Same validation it has
   today. The product form's topping price field stops accepting input.
5. **Data.** One new RPC and, on each price edit, a write to two tables plus a
   price-history row — in one transaction. No backfill: all 8 linked toppings
   already agree, measured below. No existing row is corrected because none is
   wrong.

Seen: `app/admin/products/modifiers/actions.ts` (`saveModifierAction`),
`lib/products/product-save-transaction.ts`, `supabase/migrations/0044_save_product_atomic_start_date.sql`
(how price history is written and locked), `supabase/migrations/0097_link_modifiers_to_products.sql`,
the live prices on both sides. Not seen: the modifier form component, the product
edit form component, `ProductsClient.tsx`.

## The state today, measured

All 8 linked toppings agree, so this plan prevents a divergence rather than
repairing one:

| Modifier | add-on | product | standalone | |
|---|---:|---|---:|---|
| `MOD-001` 20ml cốt cà phê | 5.000đ | `PROD-029` | 5.000đ | same |
| `MOD-002` Kem muối | 4.000đ | `PROD-030` | 4.000đ | same |
| `MOD-003` Kem dẻo | 5.000đ | `PROD-031` | 5.000đ | same |
| `MOD-004` Trân châu trắng | 5.000đ | `PROD-032` | 5.000đ | same |
| `MOD-005` Kem muối phô mai | 6.000đ | `PROD-033` | 6.000đ | same |
| `MOD-006` Đào miếng | 10.000đ | `PROD-034` | 10.000đ | same |
| `MOD-007` Dâu sấy (DELETED) | 10.000đ | `PROD-035` | 10.000đ | same |
| `MOD-008` Dâu sấy (ACTIVE) | 10.000đ | `PROD-035` | 10.000đ | same |
| `MOD-009` Hộp sữa chua | 10.000đ | — | — | no product |

## Two traps this design must not walk into

**Two modifiers, one product.** `MOD-007` and `MOD-008` are both *Dâu sấy* and
both point at `PROD-035`. Only `MOD-008` is ACTIVE, so today there is exactly one
live editor per product — but nothing enforces that. If a second ACTIVE modifier
ever links to the same product, two screens would write one price and the last
save would win silently. The RPC must refuse, not guess.

**More than one variant.** Every `CAT-007` product has exactly one ACTIVE variant
today, which is the only reason "the standalone price" is a single number. If a
topping ever gains a second size, the sync has no defined meaning. The RPC must
refuse, not pick one.

## Task 0: challenge the plan

Re-measure the nine rows above and the two traps: count ACTIVE modifiers per
`product_id`, and ACTIVE variants per `CAT-007` product. Report in English with
the counts. If either is already greater than one, stop — the design assumption
is wrong and that is an owner question, not something to code around.

## Task 1: the sync, as one transaction

**Files:** new `supabase/migrations/0098_sync_topping_price.sql`,
`app/admin/products/modifiers/actions.ts`, tests.

The migration and its reader land in the **same commit**.

- [ ] **Step 1:** Read `superpowers:fnbapp-bulk-data-change` before writing the
      RPC — it writes production rows. Inventory the triggers on `modifiers`,
      `product_variants` and `product_price_history`, and say what each does.
      Note there is **no backfill** in this plan, so the skill's per-row
      neutrality proof does not apply; say that explicitly rather than skipping
      the step silently.

- [ ] **Step 2: `sync_topping_price_atomic(p_modifier_id text, p_price bigint)`**

  One transaction. It must:
  1. Update `modifiers.price` for the given id.
  2. If that modifier has no `product_id`, stop there and report zero variants touched — that is `MOD-009`'s normal path, not an error.
  3. Otherwise resolve the linked product's ACTIVE variants. **Raise** if there is not exactly one. **Raise** if more than one ACTIVE modifier points at that product.
  4. Update that variant's price and insert a `product_price_history` row, taking the same `pg_advisory_xact_lock(hashtext('product_price_history:id'))` and the same `PPH-<n>` id derivation `save_product_atomic` uses (`0044_save_product_atomic_start_date.sql`). Do not invent a second id scheme.
  5. Return the modifier id, the variant id or null, and the price-history rows written, so the caller can assert on it.

  Revoke from `public`, `anon`, `authenticated`; grant execute to `service_role`,
  matching `0097`.

- [ ] **Step 3:** `saveModifierAction` calls the RPC on edit instead of
      `update(MODIFIER_SHEET, ...)` for the price. Name and `group_name` keep
      their existing path unless that forces two writes — if it does, widen the
      RPC rather than writing twice. Revalidate the product caches too: a price
      that moved must not sit stale behind `getCacheTag("Product_Variants")` or
      `getCacheTag("Products")`.

- [ ] **Step 4: Tests, red first.** Cover: a linked modifier updates both and
      writes one history row; `MOD-009` updates only itself; two ACTIVE
      modifiers on one product raises; two ACTIVE variants raises; the price
      history id follows the existing `PPH-` sequence. State for each whether it
      was red for a wrong value or a missing function.

- [ ] **Step 5:** Gates plus `npm run build`. Commit. **Do not run the
      migration.**

## Task 2: the product form stops being a second editor

**Files:** the product edit form component, tests.

- [ ] **Step 1:** For a product whose id is the `product_id` of any ACTIVE
      modifier, render the variant price read-only with one Vietnamese line
      telling the owner it is set on the Topping & Tuỳ chọn screen. Everything
      else on the form stays editable.
- [ ] **Step 2:** A test that the field is read-only for `PROD-030` and normal
      for an ordinary product.
- [ ] **Step 3:** Gates, build, commit.

## Task 3: prove it, then stop

- [ ] **Step 1: Stop and ask** for approval to run `0098`. It is its own
      question and does not travel with a push or a deploy.
- [ ] **Step 2:** On his word, `npx supabase db push`. Expect exactly one
      migration. Anything else: stop and report.
- [ ] **Step 3:** Read-only proof against production: all 8 linked toppings still
      agree; then hand the owner one thing to do by hand, because it cannot be
      proved without logging in — change *Kem muối* from 4.000đ to 5.000đ on the
      Topping screen, confirm the Món screen shows 5.000đ without being touched,
      and change it back. Report with denominators.

## Cross-impact

- **Order history is untouched.** Past lines carry their own price snapshot; a
  price change today never rewrites what was charged.
- **The POS is untouched.** It keeps reading `modifiers.price` for add-ons and
  the variant price for standalone. Both still exist; they just cannot disagree.
- **`MOD-009` stays unlinked.** Giving *Hộp sữa chua* a `CAT-007` product so it
  can be sold standalone is a separate owner decision, still unasked.
- **This does not make the two names sync.** Renaming a modifier will not rename
  the product. Nobody has been asked whether it should; do not build it.

## Out of scope

Deleting the duplicate *Dâu sấy* modifier; the hard-coded `CAT-007` in
`toggleToppingStandalone`; anything about recipes or cost.
