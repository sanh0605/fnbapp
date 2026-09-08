# Plan — one table for Topping & Tùy chọn

Owner feedback 2026-09-08, typed in chat with three screenshots of
`/admin/products/modifiers` (not through the Góp ý tool — `UI-FEEDBACK.md` does
not exist). Two asks, verbatim: the *Bán độc lập* column *"nên nằm trong tab của
Tuỳ chọn (Modifiers) luôn thì nó sẽ tiện hơn"*, and *"khi bấm sửa thì trong sửa
cũng có thể set toppings đó có thể bán độc lập hay không"*.

## Hiện trạng

`ModifiersClient.tsx` renders two tabs from one page. The **Tùy chọn** tab is a
table of `modifiers` rows (`status !== "DELETED"`, 8 today). The **Bán độc lập**
tab renders `ToppingsManager`, a separate table of `CAT-007` products (7 today)
whose only control flips `products.status` between `ACTIVE` and `INACTIVE` via
`toggleToppingStandalone`. The two tables have never been joined in the UI, and
before migration `0097` they could not be: `modifiers.product_id` did not exist.

The count mismatch the owner can see in his own screenshots — 8 rows against 7 —
is *Hộp sữa chua* (`MOD-009`), the one modifier with no linked product.

1. **Có mấy trạng thái, đặt mỗi trạng thái bằng cách nào?** Three per row.
   **(a) có món riêng, đang bán** — `product_id` set, that product `ACTIVE`.
   **(b) có món riêng, đang tắt** — `product_id` set, product `INACTIVE`.
   **(c) chưa có món riêng** — `product_id` null. Today: 7 rows in (a), 0 in (b),
   1 in (c). A fourth, **(d) không áp dụng**, covers modifiers outside the
   *Thêm Topping* group — see question 5.
2. **Có những nút nào, mỗi nút làm gì, nút nào không nên hiện khi nào?** The
   row switch (states a/b toggle directly; state c asks first, then creates).
   The same switch inside *Sửa Tùy Chọn*. The switch is disabled while its own
   write is in flight, and absent entirely in state (d). The **Bán độc lập** tab
   button and the tab strip both disappear — with the column merged there is
   nothing left in that tab, and leaving an empty tab is worse than none.
3. **Danh sách chứa gì, loại cái gì ra, vì lý do gì?** Unchanged from the
   Tùy chọn tab today: modifiers with `status !== "DELETED"`. That is what keeps
   `MOD-007` (*Dâu sấy*, DELETED) out while `MOD-008` (*Dâu sấy*, ACTIVE) stays —
   both point at `PROD-035`, and showing both would put two switches on one món.
4. **Mỗi ô nhập nhận giá trị nào, nhập ngoài khoảng thì sao?** The confirm is
   yes/no only. The created món takes the modifier's own name and price — no free
   text, nothing for the owner to retype and get wrong. A modifier priced 0 or
   negative must be refused rather than made into a 0đ món; state the refusal in
   Vietnamese.
5. **Phục vụ loại dữ liệu nào, cố ý không phục vụ loại nào?** Serves the
   *Thêm Topping* group only. **Deliberately not served:** *Chọn Size*,
   *Chọn Đường*, *Chọn Đá*. Those are choices within a drink, not things anyone
   sells alone; a món called "Size L" on the POS menu would be a bug wearing a
   feature's clothes. All 8 current modifiers are *Thêm Topping*, so this guard
   changes nothing visible today and exists to stop tomorrow's mistake. **My
   call, not the owner's — reported to him as decided.**

## Thiết kế rút gọn

One table, columns: Nhóm · Tên Tùy Chọn · Giá Thêm · **Bán độc lập** · Thao Tác.
Rows come from `modifiers` left-joined to `products` on `modifiers.product_id`.

**Drop the `PROD-029` column.** `ToppingsManager` shows the product id in its own
column. Beside the topping's real name it adds nothing, and the owner does not
read codes (`CLAUDE.md`, "Nói chuyện với chủ quán"). It goes.

**State (c): confirm, then create, then link — and never half of that.** Turning
the switch on for a modifier with no món asks first ("Tạo món *Hộp sữa chua* bán
riêng giá 10.000đ?"), then creates a `CAT-007` product with exactly one ACTIVE
variant at the modifier's price and sets `modifiers.product_id` to it. A product
created but left unlinked is the failure that must be impossible: the price sync
from `0098` keys off `product_id`, so an unlinked món silently becomes a second
place to edit a price — the exact thing the owner closed yesterday.

**Settled 2026-09-08: a dedicated RPC, not a wrapper around `saveProductAtomic`.**
The plan first left this open. Sonnet read `saveProductAtomic` and it is a general
multi-variant/recipe function that never touches `modifiers` — wrapping it and
then issuing `update modifiers set product_id = …` is two writes, and a crash
between them produces exactly the orphan this section forbids. Add
`create_standalone_topping_product_atomic(p_modifier_id, p_name, p_price)`
instead, following `0098`'s precedent (`sync_topping_price_atomic` is its own
function, not an extension of `save_product_atomic`). In one transaction: create
the product, create its single ACTIVE variant, set `modifiers.product_id`. Take
the modifier row `for update` and **re-check `product_id` is still null under the
lock** — a double-click or a second tab must not mint two products for one
topping, which would break `0098`'s 1:1 invariant.

**Caches.** A new món must appear on the POS immediately: revalidate
`sheets-Products` and `sheets-Product_Variants` by tag, not by path.
`toggleToppingStandalone`'s existing `revalidatePath("/pos")` has never worked —
POS reads through the tag-keyed cache (`app/admin/products/toppings/actions.ts`
says so in its own comment, OPEN-ITEMS 79). Do not copy that pattern.

## Tasks

- [ ] **Task 0 — measure.** Confirm the 8/7/1 shape still holds and that all 8
  modifiers are in the *Thêm Topping* group. If any is not, the guard in
  question 5 becomes visible and I want to know before it surprises the owner.
- [ ] **Task 1 — merge the column, test-first.** One table, tab strip removed,
  id column dropped. **Corrected 2026-09-08:** this plan first said to preserve
  `ToppingsManager`'s mobile card layout. Wrong framing — the Tùy chọn tab has no
  mobile layout at all today, only one `overflow-x-auto` table, a standing
  `.claude/rules/ui-devices.md` violation. So the phone layout is **built new**,
  and it carries more than `ToppingsManager`'s card did: nhóm, tên, giá, the
  switch, Sửa and Xóa. Design it as a card, not a narrowed table.
- [ ] **Task 2 — the create-and-link path.** Confirm dialog, atomic create+link,
  the price refusal, the *Thêm Topping* guard, and the two tag revalidations.
- [ ] **Task 3 — the switch inside *Sửa Tùy Chọn*.** Same three states, same
  confirm. **Settled 2026-09-08: the switch fires its own action on click and is
  never bundled into the form's Cập nhật submit.** Sonnet's recommendation,
  adopted — bundling it would need a third combined RPC or two sequential writes
  the user can half-complete, and every atomic write here stays single-purpose.
  The cost is that **Hủy does not undo a switch already flipped**, so the switch
  must not read as a form field: put it in its own labelled section, visually
  apart from Nhóm/Giá/Tên, and confirm the change in place so the owner sees it
  took effect. A switch that looks like it is waiting for Cập nhật, and is not,
  is worse than no switch in this dialog.
- [ ] **Task 4 — retire what the merge orphans.** `ToppingsManager` and the
  `/admin/products/toppings` redirect stub become dead once the tab is gone.
  **Report them, do not delete them** (`CLAUDE.md`, "Viết code"). The stub also
  has a `NAV_ALLOWLIST` entry already marked TODO for owner decision.
- [ ] **Task 5 — `buildStandaloneToppingMap` reads the link, not a dead regex.**
  Added 2026-09-08. `app/admin/reports/actions.ts:696` matches
  `topping-standalone::mod_id=MOD-\d+` against `products.migration_notes` — a
  column that has never existed on `products` (verified: 11 columns in
  `0001_init_schema.sql`, no later `alter table products add column`; the
  `migration_notes` at line 236 belongs to `orders_v2`). The writer script it
  names is gone. Rewrite it to read `modifiers.product_id` (migration `0097`).
  Scoped here, not separately: same link, same screen, and Task 2's create path
  becomes a new writer that would otherwise depend on the same dead thing.
  **Leave `app/pos/actions.ts` alone** — see cross-impacts.

## Worked example, real data

*Hộp sữa chua*, `MOD-009`, group *Thêm Topping*, 10.000đ, `product_id` null —
today the only row in state (c). Owner switches it on, confirms, and the system
creates a `CAT-007` product named *Hộp sữa chua* with one ACTIVE variant at
10.000đ (id from the existing generator — do not assume `PROD-036`), then sets
`MOD-009.product_id` to it. After that the row is state (a), the món is on the
POS menu at 10.000đ, and editing its price on either screen moves both, because
`0098`'s `sync_topping_price_atomic` now finds a linked product.

Counter-example that must refuse: two ACTIVE modifiers may never point at one
product — `0098` raises on it. Creating a fresh product per modifier keeps 1:1,
so the create path cannot produce that state. Prove it rather than assert it.

## Cross-impacts

- **Turning the switch off pulls a món off the POS menu.** It sets the product
  `INACTIVE`. It does **not** remove the topping from drinks — the modifier is a
  separate row and keeps working. True today; the merged table makes it easier
  to hit by accident, so the label must not read as "delete this topping".
- **`CAT-007` is hard-coded in six places** (`modifiers/page.tsx:11`,
  `toppings/actions.ts:19`, and four tests). This plan adds a seventh unless the
  create path reads the category some other way. Not in scope to fix; flagged so
  it is a known cost, not a discovery.
- **`MOD-007`/`MOD-008` share `PROD-035`.** Only the ACTIVE one is listed, so one
  switch governs that món. Nothing here changes it; do not "fix" it.
- **Renaming a topping splits its revenue in two, today.** This is why Task 5 is
  here. With the regex dead, `actions.ts:513-515` falls through to
  `canonicalModifiers.byName.get(normalizeModifierName(product_name))` — so the
  add-on row and the standalone row merge **by name equality**, not by the link.
  Measured 2026-09-08: 7 of 7 linked modifiers still name-match their product
  exactly, which is the only reason the Bán hàng report reads correctly. But
  `0098`'s header records the deliberate decision that renaming a modifier does
  **not** rename its linked product. So the first rename through *Sửa Tùy Chọn*
  silently splits that topping into two report rows with no error — a trap
  reachable from the dialog this plan is editing. Task 5 removes it by making
  the merge structural.
- **`app/pos/actions.ts:187-197` depends on the same dead regex, and is
  deliberately out of scope.** `getPOSBestSellerProductIds` builds
  `standaloneToppingIds` the same way to exclude standalone toppings from the
  POS quick-add buttons. The regex never matches, so that exclusion has never
  fired and standalone toppings **can** appear as quick-add best-sellers today.
  Fixing it would start excluding them — a visible change to what staff see
  while taking orders. **Owner decided 2026-09-08: exclude them.** The quick-add
  strip holds 8 slots and a topping there costs a drink its place. So this file
  IS in scope: give it the same `modifiers.product_id` join as Task 5 rather
  than a second copy of the logic, and expect staff to notice from the first
  shift after deploy. Recorded in `BR-CATALOG-003`.

## Chưa xem

Đã xem: `ModifiersClient.tsx`, `ModifierForm.tsx`, `modifiers/actions.ts`,
`toppings/actions.ts`, `ToppingsManager.tsx`, `modifiers/page.tsx`,
`nav-allowlist.ts`. **Chưa xem:** `saveProductAtomic`'s signature and what it
requires, the POS side that renders standalone toppings, and whether any report
counts `CAT-007` products in a way a newly created one would disturb
(`app/admin/reports/actions.ts` has a `buildStandaloneToppingMap` with a
production bug in its history — check it).

## Nghiệm thu

Owner opens `/admin/products/modifiers` after deploy: one table, 8 rows, 7
switches on, *Hộp sữa chua* offering to create its món. He switches it on,
confirms, and finds *Hộp sữa chua* on the POS at 10.000đ. `curl` proves nothing
here (`CLAUDE.md`, "Viết code").
