# Inventory catalog flow

```flow-decl
routes: /admin/inventory/items, /admin/inventory/categories, /admin/inventory/units, /admin/inventory/conversions
files: app/admin/inventory/actions.ts, app/admin/inventory/items/actions.ts, app/admin/inventory/conversions/actions.ts
tables: Purchased_Items, Item_Categories, Units, UOM_Conversions
brCodes: BR-CATALOG-001, BR-CATALOG-002
```

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
   `ACTIVE` or `INACTIVE` (`lib/duplicate-name-guard.ts`). A new item is
   created `ACTIVE`; an item taken out of use is set `INACTIVE` rather than
   removed, so historical purchases and recipes that reference it still resolve.
   A UOM conversion carries a `status` too and is set to `INACTIVE` when it is
   superseded rather than deleted (`app/admin/inventory/items/actions.ts`).
   Categories and units are plain reference rows with no lifecycle state — they
   exist or they do not.
2. **Buttons per screen, and when to hide them.** The items screen at
   `/admin/inventory/items` creates, edits, and (attempts to) delete a purchased
   item. The categories screen at `/admin/inventory/categories` and the units
   screen at `/admin/inventory/units` each add, edit, and delete their reference
   rows. The conversions screen at `/admin/inventory/conversions` adds and edits
   a conversion. A delete button that would strand referencing data must not
   succeed silently: deletion of a unit is checked first and refused with a
   plain-language reason when something still uses it
   (`lib/unit-delete-restriction.ts`).
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
   old purchase orders and recipes still need it to explain their own numbers.

## Where it writes

The declared files write `Purchased_Items` (the catalogue rows),
`Item_Categories` (the single category tier), `Units` (units of measure), and
`UOM_Conversions` (purchase-unit to base-unit conversions). The generated map at
`docs/generated/system-map.md` confirms these write relations for the three
declared files.

**Cross-flow note:** `app/admin/inventory/actions.ts` also writes
`Stock_Adjustments` and `Purchase_Order_Lines`. Those belong to the stock-issue
and purchasing flows respectively and are documented there; they are not part of
this catalog flow's declared tables. Editing a conversion with history update
also rewrites the affected `Purchase_Order_Lines` units so past purchases stay
consistent with the corrected conversion (`app/admin/inventory/actions.ts`).

**Deletion is protected, not free.** Foreign keys into `products` and
`product_variants` are set to RESTRICT, so an ingredient a recipe still uses
cannot be deleted out from under that recipe — the database refuses, and the
owner is shown why. The intended pattern is to mark an item `INACTIVE` rather
than delete it.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
