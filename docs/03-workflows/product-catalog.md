# Product catalogue flow

```flow-decl
routes: /admin/products, /admin/products/categories, /admin/products/modifiers, /admin/products/toppings
files: app/admin/products/actions.ts, lib/products/product-save-transaction.ts, lib/products/product-erase-transaction.ts, app/admin/products/categories/actions.ts, app/admin/products/modifiers/actions.ts, app/admin/products/toppings/actions.ts, lib/products/topping-price-sync.ts, lib/products/create-standalone-topping.ts
tables: Products, products, Product_Variants, product_variants, product_price_history, recipes, Product_Categories, Modifiers
brCodes: BR-CATALOG-001, BR-CATALOG-003, BR-ACCESS-003
```

**A topping with no standalone món can grow one, 2026-09-08 (`BR-CATALOG-003`,
plan `docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md`, migration
`0100`, applied on the server — `supabase migration list`, 2026-09-11).** The Topping & Tuỳ chọn screen's
"Bán độc lập" switch used to only toggle an *already-linked* product's
active flag. On a modifier with no linked product yet (`MOD-009` today), the
same switch now asks for confirmation and, if confirmed, creates the
`CAT-007` product, its single `"1 phần"` variant priced at the modifier's own
price, that price's launch `product_price_history` row, and the
`modifiers.product_id` link — one transaction
(`lib/products/create-standalone-topping.ts` calling
`create_standalone_topping_product_atomic`), or none of it. The RPC re-checks
under the modifier row's own lock that it is `ACTIVE`, still unlinked, in the
*Thêm Topping* group, and priced above zero, so a stale client render (a
second tab, a double click) can never create a duplicate product; it also
refuses a name collision with an existing `ACTIVE` product
(`ux_products_active_name`, `BR-CATALOG-001` level 1) rather than letting a
raw database error through. Level 1 only — the near-duplicate warning level 2
uses elsewhere on this flow is deliberately not wired into this single
switch-and-confirm interaction; see the migration's own header for why, and
treat it as an open design question if the owner wants it here too. Editing
the name/price of an already-standalone topping still goes through
`sync_topping_price_atomic` (migration `0098`) as described below — this is
only the *first* link, made once.

**Reviewed, no behaviour change — 2026-09-08:** `app/admin/products/modifiers/actions.ts`
changed -- its three writers now also call `revalidateTag(getCacheTag("Modifiers"))`
(code review finding, since `Modifiers.product_id` now drives the report
merge and POS quick-add exclusion). No table write was added or removed;
this is cache-freshness only, which this doc does not describe.
**Reviewed, no behaviour change — 2026-09-07 (Task 11):** a declared source file's import path only -- lib/auth.ts moved to `lib/auth/auth.ts`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 10):** a declared source file's import path only -- cross-cutting lib/ helpers (action-error, datetime, dialog, duplicate-name-guard, use-filter-form, nav-completeness, client-error-report, report-time) moved to `lib/shared/`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 9):** a declared source file's import path only -- sheets_db.ts/supabase.ts/shared-actions.ts/backup-restore.ts moved to `lib/db/` (spec D6), rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07:** a declared source file's comments only — dead `CLAUDE.md` section-number pointers replaced with section headings; no logic changed. (Lands together with the source files in this commit.)

This flow covers the sellable catalogue: the products the POS offers, their
variants (sizes), the categories that group them, the modifiers a customer can
pick, and the toppings that add to a drink. A product is created and edited from
`/admin/products`; its save runs through the atomic function in
`lib/products/product-save-transaction.ts`. Categories, modifiers, and toppings each have
their own screen and server action. Names must be unique among live rows, with a
near-match warning rather than a hard refusal (`BR-CATALOG-001`).

Saving a product is not a single-table write. The save transaction writes the
product row and its variants, and as a side effect it also writes the product's
**recipe snapshot** (`recipes`) and a new **price-history** row
(`product_price_history`) so the price in force at each moment is preserved.
Toppings are themselves stored as products, which is why
`app/admin/products/toppings/actions.ts` writes the `Products` table too.

**A topping's price has one edit point (`BR-CATALOG-003`, added 2026-09-07,
migration `0098`, applied on the server — `supabase migration list`, 2026-09-11).** A topping is sold two
ways — as an add-on (`modifiers.price`) and, if linked, standalone as a
`CAT-007` product's own variant (`product_variants.price`). Editing the
price on the Topping & Tuỳ chọn screen now writes both, plus a
`product_price_history` row, in one transaction
(`lib/products/topping-price-sync.ts` calling `sync_topping_price_atomic`) —
the owner can no longer forget the second screen. A modifier with no linked
product (`MOD-009` today) updates only itself.

## Five-question current-state description

1. **States, and how each is set.** A product is either **live** or **hidden**,
   set by an active flag on its row; hiding keeps it out of the POS without
   removing it. A **never-sold** product can additionally be **erased for real**
   through `lib/products/product-erase-transaction.ts`, which deletes its price history,
   then its variants, then the product itself, atomically. Only ADMIN may erase:
   `eraseProduct` checks `requireOwner()` first (`BR-ACCESS-003`), and the page
   hides the button for every other role. Whether a product has
   ever been sold is decided by Postgres RESTRICT foreign keys, not by
   application code: a product referenced by any order line cannot be deleted, so
   a **once-sold** product can only be hidden. Attempting to erase a sold product
   makes the database raise a Vietnamese sentence naming the product, which is
   surfaced to the owner unchanged. Categories exist or are removed/hidden
   through their own screen; a variant has its own price and belongs to one
   product. Modifiers and their "Bán độc lập" state live on one screen since
   2026-09-08 (plan `docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md`
   Task 1) — a modifier is either **linked** to a standalone `CAT-007` product
   (itself live or hidden, toggled by the same switch) or **unlinked**
   (`MOD-009`'s shape, until the switch is used to create the link — see
   above). `/admin/products/toppings` no longer has its own list; it redirects
   to the merged screen for old links/bookmarks.
2. **Buttons per screen, and when to hide them.** `/admin/products` offers create,
   edit/save, hide, and delete. Delete should be offered only for a never-sold
   product — for a product that has been sold, the RESTRICT foreign key would
   reject it, so the screen should present hide instead of delete. The category
   screen offers create, edit, and remove for its own rows; a row still in use
   by a live product should not be silently deleted. The modifier screen offers
   create, edit, remove, and (only inside the *Thêm Topping* group) the "Bán
   độc lập" switch — hidden entirely for every other group, since only a
   topping can be sold standalone.
3. **What each list contains, and what is excluded.** The product list shows the
   catalogue including hidden products (filterable), one row per product with its
   variants. The category list shows product categories only — it does not show
   the purchased-item categories of the ingredient catalogue, which are a
   separate flow. The modifier list shows every live modifier, with its
   standalone-sale state as a column rather than a second list. Purchased
   materials and ingredients are excluded from every list here; they belong to
   the inventory catalogue flow.
4. **Valid inputs, and what happens outside the range.** A product needs a name
   unique among live rows; a near-identical name warns but is allowed
   (`BR-CATALOG-001`). A variant needs a name and a price; the price is stored to
   `product_price_history` on each save so past prices stay readable. A category,
   modifier, or topping needs a name; a duplicate live name warns the same way.
   Out-of-range or empty required inputs are rejected before the save transaction
   runs.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   the sellable side of the catalogue — products, variants, categories,
   modifiers, toppings — and the price and recipe snapshots that a sale later
   reads. It deliberately does not serve purchased materials, units, or unit
   conversions (the inventory catalogue flow), and it does not recost past sales:
   editing a product changes the catalogue going forward, while historical order
   lines keep the recipe and price they were sold with.

## Where it writes

Per the generated map, the eight declared files write: `Products` and
`Product_Variants` (`app/admin/products/actions.ts`); `products`,
`product_variants`, `product_price_history`, and `recipes`
(`lib/products/product-save-transaction.ts`); `products`, `product_variants`, and
`product_price_history` (`lib/products/product-erase-transaction.ts`);
`Product_Categories` (`app/admin/products/categories/actions.ts`); `Modifiers`
(`app/admin/products/modifiers/actions.ts`, when creating or deleting a
modifier); `Products` (`app/admin/products/toppings/actions.ts`);
`modifiers`, `product_variants`, `product_price_history`
(`lib/products/topping-price-sync.ts`, called by
`app/admin/products/modifiers/actions.ts` on an edit — the price sync
described above); and `products`, `product_variants`, `product_price_history`,
`modifiers` (`lib/products/create-standalone-topping.ts`, called by the same
file's new `createStandaloneToppingAction` — the first-link RPC described
above).

**Two casings, one table.** `Products`/`products` and
`Product_Variants`/`product_variants` are each the same physical table seen
through two code paths — the `lib/db/tables.ts` adapter emits the capitalised name while
the RPC body uses the lowercase name. Both casings are listed above verbatim
because the map emits both; see `docs/01-system/SYSTEM-MAP.md` (and SYSTEM-OVERVIEW)
for the naming trap explained once.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
