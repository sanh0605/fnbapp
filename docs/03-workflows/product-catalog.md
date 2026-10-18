# Product catalogue flow

```flow-decl
routes: /admin/products, /admin/products/new, /admin/products/[id], /admin/products/[id]/edit, /admin/products/[id]/history, /admin/products/categories, /admin/products/categories/new, /admin/products/categories/[id], /admin/products/categories/[id]/edit, /admin/products/types, /admin/products/types/new, /admin/products/types/[id], /admin/products/types/[id]/edit, /admin/products/modifiers, /admin/products/modifiers/new, /admin/products/modifiers/[id], /admin/products/modifiers/[id]/edit, /admin/products/modifier-groups, /admin/products/modifier-groups/new, /admin/products/modifier-groups/[id], /admin/products/modifier-groups/[id]/edit
files: app/admin/products/actions.ts, lib/products/product-save-transaction.ts, lib/products/product-status-transaction.ts, lib/products/product-erase-transaction.ts, app/admin/products/categories/actions.ts, app/admin/products/types/actions.ts, app/admin/products/modifiers/actions.ts, lib/products/modifier-save-transaction.ts, lib/products/modifier-group-transaction.ts, app/admin/products/modifier-groups/actions.ts, lib/products/create-standalone-topping.ts
tables: Products, products, product_variants, product_price_history, Product_Categories, Product_Types, Modifiers, modifier_groups, modifier_group_products
brCodes: BR-CATALOG-001, BR-CATALOG-003, BR-CATALOG-005, BR-ACCESS-003, BR-SALE-007
```

**Behaviour change — 2026-10-15 (no "Đã xoá" status; pushed and migrations `0125`, `0126` run the same day):** "Xoá" on an option erases it for good, `ADMIN` only, and only if it was never sold; a sold option is refused and offers "Ngừng dùng"/"Dùng lại" on its page instead. "Xoá" on an empty dish group erases it, `ADMIN` only. The dish list loses its "Đã xoá" filter; the old dish refusal for that state goes with it. Sizes removed on Sửa món still take the old state until a later change of `save_product_atomic`. One live option per standalone dish: "Dùng lại" is refused while another option runs that dish, and stopping an option stops the dish only when no other live option runs it (`0126`).

**Behaviour change — 2026-10-15 (Bán hàng đợt 2, design in `docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md`):**
- Deleting an option whose standalone dish is on sale is refused, with the dish named. Turn "Bán độc lập" off first.
- The "Bán độc lập" switch pauses or resumes the dish with its sizes, through the same path as the dish page. The dead `/admin/products/toppings` address and `ToppingsManager` are gone.
- A Nhóm món name already used by a live group is refused.
- "Ngày áp dụng giá" is no longer read: a price change is dated when it is saved (Q8).
- Tạo món and Sửa món load only what they show, and the Món list no longer builds price history per row.

**Behaviour change — 2026-10-15 (migration `0120`, ran on the server 2026-10-15 with the owner's approval):** every option must have a group (`modifiers.group_id` not null) and the old text column `modifiers.group_name` is dropped; `sync_topping_price_atomic` loses its group argument. The Topping & tuỳ chọn list shows the group's name, or "—" if the group is missing. Nothing visible changes in the till. A backup taken before this restores through a shim in `lib/db/backup-restore.ts` that maps the old name to its group.

**Behaviour change — 2026-10-14 (audit F5, owner "Dùng khung chuẩn"; migration `0119`, ran on the server 2026-10-15 with the owner's approval: 0 of 9 options without a group, 35 drink dishes ticked, 0 food or Topping dishes):** a new list `/admin/products/modifier-groups` "Nhóm tuỳ chọn" sits under Bán hàng next to Topping & Tuỳ chọn (`BR-CATALOG-005`).
- Each group is Chọn một or Chọn nhiều, with a display order, an optional cap on portions (Chọn nhiều), a "Cho bán riêng" box (Chọn nhiều), and the dishes it applies to. Dishes can also be ticked on Sửa món; both save through one Postgres function.
- The option form picks its group from that table, and has "Có sẵn" (Chọn một) and "Tối đa mỗi món" (Chọn nhiều); `save_modifier_atomic` clears the group's other default and syncs a linked topping's price in one transaction. The old one-purpose price-sync module is gone.
- The till shows only the groups ticked for the dish, in order, with the default lit and "+" greyed at a cap (`app/pos/components/OptionGroupPicker.tsx`); Sửa đơn only lists the options already on a line. A sale still stores only the picks that differ from the defaults.
- The Bán độc lập check reads the group's "Cho bán riêng" box instead of the name "Thêm Topping".

**Behaviour change — 2026-10-14 (audit F4, owner "Mặc định Topping, sửa được"):** the *Bán độc lập* switch on Topping & tuỳ chọn follows the topping's link (`modifiers.product_id`), not the dish group, so a standalone topping moved to another group from Sửa món keeps its switch; a product no topping links to is refused with a Vietnamese message naming the dish. A new standalone món still starts in "Topping" (`BR-CATALOG-003`).

**Behaviour change — 2026-10-14 (audit F2, F3, F6, F7; migration `0114`, ran on the server 2026-10-14 with the owner's approval):** editing a dish keeps its picture; "Xoá vĩnh viễn" is not offered on a dish linked to any topping, and the server names the topping when it refuses; a dish linked to an active topping cannot get a second size ("Thêm size" hidden, server refuses); Ngừng bán and Bán lại write the dish and its sizes in one Postgres function, `set_product_status_atomic`. Dates with a time show seconds (`BR-DATA-006`).

**Behaviour change — 2026-10-14 (Loại món, migration `0109`):** a new list `/admin/products/types` sits under Bán hàng, after Nhóm món.
- Each type has a name and a "Là thức uống (tính là ly)" mark.
- It starts with three types: Thức uống (marked), Thức ăn and Topping.
- Every Nhóm món now has a required "Loại món". The migration set Cà phê, Giải trí, Cacao, Trà and Yogurt to Thức uống, Thức ăn to Thức ăn, and Topping to Topping.
- A type can be deleted only by the owner (`requireOwner()`), and only while no group uses it. A refusal names the groups, for example "Loại món đang được dùng ở nhóm: Cà phê, Trà.".
- Tổng quan counts a cup by this mark (`BR-SALE-007`).

**Behaviour change — 2026-10-15 (Biểu tượng nhóm món, `BR-SALE-017`, migration `0130`, runs before the push):** the Nhóm món form has a "Biểu tượng" box. The emoji shows at the till (on the dish cards until 2026-10-17; since the till redo, on the dish-group tab); blank means no icon (no default cup). Trimmed; more than 8 characters is refused with "Biểu tượng tối đa 8 ký tự". The till no longer guesses an icon from the group name. The return-to links on the dish pages go through the shared `safeReturnTo`.

**Behaviour change — 2026-10-18 (audit fixes, merge `e08660b4`):** on screen only. The option detail page no longer carries the "Bán độc lập" switch, which looked like a read-only value; it shows "Có" (linked dish on sale), "Không", or "—" (group without standalone). The switch stays on the option edit form.

**Reviewed, no behaviour change — 2026-10-14:** `app/admin/products/modifiers/actions.ts` one message spelled "Thiếu mã tuỳ chọn" instead of "tùy" (`BR-UI-001`); no logic changed.

**Behaviour change — 2026-10-03 (list/detail template, wave 4):** on screen only; no server action, table or figure changes. A dish row opens `/admin/products/[id]`: its fields, its sizes and prices, and its price history as recorded, one row per change with the size named (the old timeline worked out "Đến" and "Đang áp dụng" across sizes, so a dish with three sizes showed one of them as current). "Chỉnh sửa", "Ngừng bán" or "Bán lại", and the ADMIN-only "Xoá vĩnh viễn" live on that page. The list keeps a "Ngừng bán" bin and multi-select, shown only while the filter is "Đang bán". `/admin/products/[id]/history` now redirects to the detail page. Nhóm món and Topping & tuỳ chọn rows open their own `[id]` pages, with "Chỉnh sửa" and "Xoá" there and a "Xoá" bin on the list. The "Bán độc lập" switch moved from the option list to the option detail page; the list shows "Có" or "Không".

**A topping with no standalone món can grow one, 2026-09-08 (`BR-CATALOG-003`,
migration `0100`, applied on the server — `supabase migration list`, 2026-09-11).** The Topping & Tuỳ chọn screen's
"Bán độc lập" switch used to only toggle an *already-linked* product's
active flag. On a modifier with no linked product yet (`MOD-009` today), the
same switch now asks for confirmation and, if confirmed, creates the
`CAT-007` product, its single `"1 phần"` variant priced at the modifier's own
price, that price's launch `product_price_history` row, and the
`modifiers.product_id` link — one transaction
(`lib/products/create-standalone-topping.ts` calling
`create_standalone_topping_product_atomic`), or none of it. The RPC re-checks
under the modifier row's own lock that it is `ACTIVE`, still unlinked, in a
group that allows standalone sale (today *Thêm topping*), and priced above
zero, so a stale client render (a
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
product row and its variants, and as a side effect it also writes a new
**price-history** row (`product_price_history`) so the price in force at each
moment is preserved. Toppings are themselves stored as products; the option
screen's "Bán độc lập" switch (`toggleToppingStandalone` in
`app/admin/products/modifiers/actions.ts`) pauses or resumes that product
through `lib/products/product-status-transaction.ts`, the dish and its sizes together.

**Reviewed, no behaviour change to the save path's own inputs/outputs beyond
this — 2026-09-28 (migration 0105):** `recipes` was dropped along with 9
other abandoned tables (owner decision 2026-09-28). Every new size
was still silently writing an empty recipe row (recipe *editing* had already
been removed from the UI on 2026-08-27); `save_product_atomic` no longer
touches `recipes` at all, and `recipe_count` is gone from its return.

**A topping's price has one edit point (`BR-CATALOG-003`, added 2026-09-07,
migration `0098`, applied on the server — `supabase migration list`, 2026-09-11).** A topping is sold two
ways — as an add-on (`modifiers.price`) and, if linked, standalone as a
`CAT-007` product's own variant (`product_variants.price`). Editing the
price on the Topping & Tuỳ chọn screen now writes both, plus a
`product_price_history` row, in one transaction
(`sync_topping_price_atomic`, since 0119 called by `save_modifier_atomic`) —
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
   2026-09-08 (`BR-CATALOG-003`) — a modifier is either **linked** to a standalone `CAT-007` product
   (itself live or hidden, toggled by the same switch) or **unlinked**
   (`MOD-009`'s shape, until the switch is used to create the link — see
   above). The old `/admin/products/toppings` address is gone (2026-10-15).
2. **Buttons per screen, and when to hide them.** Every row opens its detail
   page; edits happen only from there (list/detail template, wave 4). The
   product list offers create and, while the filter is "Đang bán", a "Ngừng
   bán" bin and multi-select. The product detail page offers edit, "Ngừng bán"
   or "Bán lại", and "Xoá vĩnh viễn" — the last only for a never-sold product and
   only for ADMIN; for a sold product the RESTRICT foreign key would reject it.
   The category list and detail offer create, edit, and remove; a category still
   used by a dish that is not deleted is refused with its dish count, not
   silently removed. The modifier list and detail offer create, edit, and
   remove; the "Bán độc lập" switch sits on the modifier edit form, only in a
   group that allows standalone sale (today *Thêm topping*), since only a topping
   can be sold standalone; the detail page shows it as "Có", "Không", or "—"
   in any other group.
3. **What each list contains, and what is excluded.** The product list shows the
   catalogue including hidden products (filterable), one row per product with its
   variants. The category list shows product categories only — it does not show
   the purchased-item categories of the ingredient catalogue, which are a
   separate flow. The modifier list shows every live modifier, with its
   standalone-sale state as a "Có"/"Không" column rather than a second list. Purchased
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
`product_variants`, and `product_price_history`
(`lib/products/product-save-transaction.ts`); `products`, `product_variants`, and
`product_price_history` (`lib/products/product-erase-transaction.ts`);
`Product_Categories` (`app/admin/products/categories/actions.ts`); `Modifiers`
(`app/admin/products/modifiers/actions.ts`, when creating or deleting a
modifier);
`modifiers`, `product_variants`, `product_price_history`
(`lib/products/modifier-save-transaction.ts`, called by
`app/admin/products/modifiers/actions.ts` on every save — the price sync
described above); `modifier_groups`, `modifier_group_products`
(`lib/products/modifier-group-transaction.ts`); and `products`, `product_variants`, `product_price_history`,
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

> Reviewed, no behaviour change — 2026-10-15: Next 16 upgrade only; page params became async, revalidateTag gained its expire argument, and a comment now points at clear-cache/actions.ts.
