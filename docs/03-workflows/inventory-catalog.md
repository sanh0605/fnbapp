# Inventory catalog flow

```flow-decl
routes: /admin/inventory/items, /admin/inventory/categories, /admin/inventory/units, /admin/inventory/conversions, /admin/inventory/items/new, /admin/inventory/items/[id]/edit, /admin/inventory/items/[id]/history, /admin/inventory/categories/new, /admin/inventory/categories/[id]/edit, /admin/inventory/units/new, /admin/inventory/units/[id]/edit, /admin/inventory/conversions/new, /admin/inventory/conversions/[id]/edit
files: app/admin/inventory/actions.ts, app/admin/inventory/items/actions.ts, app/admin/inventory/conversions/actions.ts
tables: Purchased_Items, Item_Categories, Units, UOM_Conversions
brCodes: BR-CATALOG-001, BR-CATALOG-002
```

**Behaviour change — 2026-09-28:** `deleteUnit`'s in-use check no longer queries
`Base_Ingredients`, a table dropped by migration `0090` on 2026-09-01. Since then,
deleting a unit that no conversion or purchased item uses failed with a
missing-table error; it now deletes. Found by the review of the 0105 plan.
**Reviewed, no behaviour change — 2026-09-28:** `app/admin/inventory/actions.ts`'s
`deleteUnit` unit-in-use check stopped querying `Semi_Products` and
`Production_Items` (Task 3, `docs/superpowers/plans/2026-09-28-go-10-bang-bo-hoang.md`
-- their tables are being dropped in migration 0105). Both were always
0 rows in production, so this changes nothing a real delete could hit; the
`semi_products`/`production_items` refusal messages are also removed from
`lib/catalog/unit-delete-restriction.ts` (not one of this flow's declared
files).
**Reviewed, no behaviour change — 2026-09-07 (Task 16):** a declared source file's import path only -- stock lib helpers (manual-issue-transaction, stock-adjustment-transaction, stocktake-transaction, stocktake-package-lines, issue-slip-onhand-display, issue-slip-warnings, purchased-item-onhand, conversion-countability) moved to `lib/stock/`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 14):** a declared source file's import path only -- purchasing lib helpers (purchase-order-transaction, purchase-order-edit-gate, purchase-order-write-plan, purchase-line-base-quantity, item-purchase-history) moved to `lib/purchasing/`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 11):** a declared source file's import path only -- lib/auth.ts moved to `lib/auth/auth.ts`, rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-07 (Task 9):** a declared source file's import path only -- sheets_db.ts/supabase.ts/shared-actions.ts/backup-restore.ts moved to `lib/db/` (spec D6), rewritten by the move helper; no logic changed.
**Reviewed, no behaviour change — 2026-09-04:** Phase 6 dead-reference cleanup touched a declared source file's comments only (dead docs/... citations repointed or stripped); no logic changed.

This flow covers the reference data behind everything the shop buys and stores:
the purchased items (ingredients, consumables, tools), the categories that group
them, the units of measure, and the unit-of-measure conversions that translate a
purchase unit into a base counting unit. These are owner-editable reference
tables — the owner adds and edits them from the admin inventory screens rather
than waiting on a code change. The writes run through the server actions in
`app/admin/inventory/actions.ts`, `app/admin/inventory/items/actions.ts`, and
`app/admin/inventory/conversions/actions.ts`.

## Five-question current-state description

1. **States, and how each is set.** A purchased item carries a `status` of
   `ACTIVE` or `INACTIVE` (`lib/shared/duplicate-name-guard.ts`). A new item is
   created `ACTIVE`; an item taken out of use is set `INACTIVE` rather than
   removed, so historical purchases and issues that reference it still resolve.
   A UOM conversion carries a `status` too and is set to `INACTIVE` when it is
   superseded rather than deleted (`app/admin/inventory/items/actions.ts`).
   Categories and units are plain reference rows with no lifecycle state — they
   exist or they do not.
2. **Buttons per screen, and when to hide them.** The items screen at
   `/admin/inventory/items` creates, edits, and (attempts to) delete a purchased
   item. The categories screen at `/admin/inventory/categories` and the units
   screen at `/admin/inventory/units` each add, edit, and delete their reference
   rows. The conversions screen at `/admin/inventory/conversions` adds, edits, and
   deletes a conversion. Delete on all four screens is ADMIN-only per
   `BR-ACCESS-003` (owner decision 2026-09-08, `requireOwner`): the button is
   hidden for anyone else (`canDelete` computed from `resolveActor()` in each
   `page.tsx`). A delete button that would strand referencing data must not
   succeed silently: deletion of a unit is checked first and refused with a
   plain-language reason when something still uses it
   (`lib/catalog/unit-delete-restriction.ts`).
3. **What each list contains, and what is excluded.** The item list shows the
   purchased-item catalogue. The duplicate-name guard only compares against
   `ACTIVE` rows, so an `INACTIVE` item does not block reusing a name
   (`BR-CATALOG-001`). Units flagged as deleted (name prefixed `DELETED_`) are
   filtered out of the unit picker (`app/admin/inventory/items/actions.ts`).
   The category list is the single catalogue tier — RAW / CONSUMABLE /
   EQUIPMENT — with no lower grouping tier beneath it (`BR-CATALOG-002`).
4. **Valid inputs, and what happens outside the range.** A purchased item needs
   a name unique among live rows; a near-duplicate warns and an exact live
   duplicate is refused (`BR-CATALOG-001`). A conversion needs a purchased item,
   a purchase unit, a base unit, and a conversion rate — a missing field is
   rejected before any write. Deleting a unit or a category that is still
   referenced is refused by the database RESTRICT foreign keys, surfaced to the
   owner as a readable message rather than a raw Postgres error.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   the catalogue reference data: purchased items, their categories, units, and
   unit conversions. It deliberately does not serve stock movement or cost —
   those live in the purchasing, stock-issue, and stocktake flows. The purchased
   item is never hard-removed while referenced; it is marked `INACTIVE`, because
   old purchase orders and stock issues still need it to explain their own numbers.

## Where it writes

The declared files write `Purchased_Items` (the catalogue rows),
`Item_Categories` (the single category tier), `Units` (units of measure), and
`UOM_Conversions` (purchase-unit to base-unit conversions). The generated map at
`docs/generated/system-map.md` confirms these write relations for the three
declared files.

**Cross-flow note:** `app/admin/inventory/actions.ts` also writes
`Purchase_Order_Lines`. That belongs to the purchasing flow and is documented
there; it is not one of this catalog flow's declared tables. Editing a conversion with history update
also rewrites the affected `Purchase_Order_Lines` units so past purchases stay
consistent with the corrected conversion (`app/admin/inventory/actions.ts`).

**Deletion is protected, not free.** Foreign keys from `uom_conversions`,
`purchase_order_lines` and `stock_issues` into `purchased_items` are set to
RESTRICT, so an item that a purchase or an issue still uses cannot be deleted out
from under it — the database refuses, and the owner is shown why. The intended pattern is to mark an item `INACTIVE` rather
than delete it.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
