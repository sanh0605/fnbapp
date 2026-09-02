# Product catalogue flow

```flow-decl
routes: /admin/products, /admin/products/categories, /admin/products/modifiers, /admin/products/toppings
files: app/admin/products/actions.ts, lib/product-save-transaction.ts, lib/product-erase-transaction.ts, app/admin/products/categories/actions.ts, app/admin/products/modifiers/actions.ts, app/admin/products/toppings/actions.ts
tables: Products, products, Product_Variants, product_variants, product_price_history, recipes, Product_Categories, Modifiers
brCodes: BR-CATALOG-001
```

This flow covers the sellable catalogue: the products the POS offers, their
variants (sizes), the categories that group them, the modifiers a customer can
pick, and the toppings that add to a drink. A product is created and edited from
`/admin/products`; its save runs through the atomic function in
`lib/product-save-transaction.ts`. Categories, modifiers, and toppings each have
their own screen and server action. Names must be unique among live rows, with a
near-match warning rather than a hard refusal (`BR-CATALOG-001`).

Saving a product is not a single-table write. The save transaction writes the
product row and its variants, and as a side effect it also writes the product's
**recipe snapshot** (`recipes`) and a new **price-history** row
(`product_price_history`) so the price in force at each moment is preserved.
Toppings are themselves stored as products, which is why
`app/admin/products/toppings/actions.ts` writes the `Products` table too.

## Five-question current-state description

1. **States, and how each is set.** A product is either **live** or **hidden**,
   set by an active flag on its row; hiding keeps it out of the POS without
   removing it. A **never-sold** product can additionally be **erased for real**
   through `lib/product-erase-transaction.ts`, which deletes its price history,
   then its variants, then the product itself, atomically. Whether a product has
   ever been sold is decided by Postgres RESTRICT foreign keys, not by
   application code: a product referenced by any order line cannot be deleted, so
   a **once-sold** product can only be hidden. Attempting to erase a sold product
   makes the database raise a Vietnamese sentence naming the product, which is
   surfaced to the owner unchanged. Categories, modifiers, and toppings each
   exist or are removed/hidden through their own screen; a variant has its own
   price and belongs to one product.
2. **Buttons per screen, and when to hide them.** `/admin/products` offers create,
   edit/save, hide, and delete. Delete should be offered only for a never-sold
   product — for a product that has been sold, the RESTRICT foreign key would
   reject it, so the screen should present hide instead of delete. The category,
   modifier, and topping screens each offer create, edit, and remove for their
   own rows; a row still in use by a live product should not be silently deleted.
3. **What each list contains, and what is excluded.** The product list shows the
   catalogue including hidden products (filterable), one row per product with its
   variants. The category list shows product categories only — it does not show
   the purchased-item categories of the ingredient catalogue, which are a
   separate flow. The modifier and topping lists show only their own catalogue
   rows. Purchased materials and ingredients are excluded from every list here;
   they belong to the inventory catalogue flow.
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

Per the generated map, the six declared files write: `Products` and
`Product_Variants` (`app/admin/products/actions.ts`); `products`,
`product_variants`, `product_price_history`, and `recipes`
(`lib/product-save-transaction.ts`); `products`, `product_variants`, and
`product_price_history` (`lib/product-erase-transaction.ts`);
`Product_Categories` (`app/admin/products/categories/actions.ts`); `Modifiers`
(`app/admin/products/modifiers/actions.ts`); and `Products`
(`app/admin/products/toppings/actions.ts`).

**Two casings, one table.** `Products`/`products` and
`Product_Variants`/`product_variants` are each the same physical table seen
through two code paths — the `sheets_db` adapter emits the capitalised name while
the RPC body uses the lowercase name. Both casings are listed above verbatim
because the map emits both; see `docs/01-system/SYSTEM-MAP.md` (and SYSTEM-OVERVIEW)
for the naming trap explained once.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
