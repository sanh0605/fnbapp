# Catalogue rules

### BR-CATALOG-001 — A catalogue name is unique among live rows; a near-match warns instead of refusing

**Status:** `APPROVED` — owner decision 2026-08-19.

Six catalogue tables (`purchased_items`, `semi_products`, `products`, `item_categories`, `units`, `suppliers`) each enforce their own name uniqueness, scoped **within the table only, never across tables** — a purchased item and the ingredient it becomes legitimately share a name (e.g. `SPM-005`/`ING-001`, both "Đá viên"). Uniqueness is scoped to `ACTIVE` rows: retiring a row (mark-inactive, never delete — `CLAUDE.md` "Luật dữ liệu") makes its name reusable.

**Two levels, found by asking what stripping diacritics actually costs, not by principle.** The owner asked for "Ca phe" to be caught as a duplicate of "Cà phê." Stripping diacritics does that — and also collapses "Dứa" and "Dừa" (pineapple vs coconut) into one word; this catalogue already holds "Thạch dừa" (`NNL-009`), so a blanket strip would one day refuse "Thạch dứa" on a drinks menu with no way to say "that is a real, different item."

| Level | Trigger | Behaviour |
|---|---|---|
| **1 — refuse** | Name matches an existing live row after normalising (non-breaking space → space, Unicode NFC, trim, whitespace collapse, case-fold — diacritics **not** stripped) | Blocked outright, both as a database partial unique expression index (unbypassable) and an application check naming the row |
| **2 — warn** | Only the **diacritic-stripped** forms match | Shown the existing row, asked *"đây có phải là một mặt hàng khác không?"*, proceeds only on confirmation |

**Level 2 lives in the application only** — it needs a human answer, so it cannot be an index. The confirmation is recorded as a field (`duplicate_warning_confirmed`, `_by`, `_at`), not a note — same reasoning as `Không nhớ` (Plan J section 9.3): "which items were created despite a warning" has to be answerable by a query.

**đ/Đ (U+0111/U+0110) do not decompose under NFD**, unlike ordinary Vietnamese diacritics — verified directly (`đ.normalize("NFD")` stays one codepoint; `á` splits into `a` + a combining acute). The diacritic strip replaces `đ`/`Đ` explicitly before the NFD step; missing this would make "Da vien" silently fail to warn against "Đá viên."

**Level 2 is wired into five of the seven tables**: `base_ingredients` (`0066_duplicate_name_warning_confirmation.sql`), plus `purchased_items`, `semi_products`, `products`, `suppliers` (Batch 1 follow-up, 2026-08-20, `0067_duplicate_name_warning_confirmation_more_tables.sql`). The level-2 comparison logic (`findDiacriticStrippedMatch`, `lib/shared/duplicate-name-guard.ts`) is table-agnostic; each of these five tables carries its own `duplicate_warning_confirmed`/`_by`/`_at` columns.

**The standalone-topping create path carries level 1 only — settled 2026-09-08, my call, reported to the owner rather than asked of him.** `create_standalone_topping_product_atomic` (migration `0100`) writes a `products` row, so on the letter of this rule it should ask the level-2 question too. It does not, for three reasons. The name is not free text — it is copied verbatim from a modifier the owner already named, so there is no typing moment for a warning to catch. There is no form to hold the answer: the interaction is one switch and one yes/no confirm, and level 2 needs a human reply mid-flow. And the new món is *deliberately* the same thing as an existing record — that is the whole point of `BR-CATALOG-003` — so "is this a different item?" is the wrong question to put in front of someone here. What is kept is level 1: the RPC catches `ux_products_active_name` and refuses with a message naming the món, instead of surfacing a raw `23505`. **The cost, stated rather than buried:** promoting a topping whose name merely resembles an existing món (the `Dứa`/`Dừa` case this rule was written around) creates the second row with no warning. Reachable only when a topping and a món have near-identical names; none do today, measured 2026-09-08 across 8 non-DELETED modifiers and 47 products. If that ever bites, the fix is a second confirm on this path, not a change to this rule.

**`units` and `item_categories` carry level 1 only, deliberately.** Neither accumulates its own stock or purchase history — they are labels referenced by other rows, not things bought, counted, or sold, so a near-duplicate there is cosmetic dropdown confusion, not the split-ledger harm level 2 exists to catch. Both populations are also small and do not grow under shelf-pressure (`item_categories` has held exactly 3 rows since 2026-06-28; a new unit is a rare, deliberate, admin-time event). Level 1 already covers the only collision risk either table has ever actually produced.

### BR-CATALOG-002 — The purchased-item catalogue has one tier, not two

**Status:** `APPROVED` — owner decision 2026-09-01, reversing an earlier reading of the owner's 2026-08-27 words that had this table staying on as a reporting-only label. Asked again directly 2026-09-01; his answer: *"Xóa trước, sau này cần thì dựng lại sau cho đúng chuẩn logic từ bây giờ trở đi."*

**One tier: Nguyên liệu (RAW) / Vật tư tiêu hao (CONSUMABLE) / Dụng cụ (EQUIPMENT)** — `item_categories`, referenced directly by every `purchased_items` row. There is no tier below it grouping several purchased items under one label for report roll-up. `base_ingredients` (`BR-CATALOG-001`'s "seven catalogue tables" is now six) was that lower tier — 46 rows, 52 of 146 purchased items linked to one — and it is gone by owner decision, not merged into `item_categories` or replaced by anything else.

**What this costs, accepted knowingly:** grouped purchase reporting ("tổng chi cho Sữa tươi across every brand of it") and the stocktake close's per-group variance summary (`apply_stocktake_session_atomic`'s aggregation loop) both go away. Neither fed a real money figure — `count_variance` on each counted line, which does drive `stock_issues`, is computed independently of this grouping and is unaffected.

**Not reversible by re-reading old data.** The owner declined a backup of the 46 groups or the 52-item mapping before deletion (his own words, same session): *"Anh sẽ tự nối lại và tự định nghĩa lại vào lúc đó, em không cần phải sao lưu lại dữ liệu trong NHÓM NGUYÊN LIỆU."* A future re-introduction of grouping is a new design, built fresh, not a restore.

**Both steps applied** — measured 2026-09-07 against the live database: the `base_ingredients` table (dropped by migration `0090`) and the `purchased_items.base_ingredient_id` column (dropped by `0095`) both answer "does not exist". Nothing in the schema or in any code path refers to the lower tier any more.


---

### BR-CATALOG-003 — A topping is one thing the shop sells two ways, and the two records must know each other

**Status:** `APPROVED` — owner decision 2026-09-07, asked and answered twice in the
same session. Asked whether topping-as-menu-item and topping-as-add-on are one
thing or two, he sent it back for evidence; shown the evidence, he chose to keep
both sale paths and link the records: *"Có, giữ cả hai đường."* **Not yet applied**
— the link does not exist in the schema as of 2026-09-07.

**The shop sells a topping two ways.** Added to a drink, it is a row in
`modifiers` and is written into `order_lines_v2.modifiers_snapshot_json` on the
parent line. Bought on its own, it is a row in `products` under category
`CAT-007` with its own variant and price, and becomes an ordinary order line.
Both paths are live and intended: `app/admin/products/toppings/actions.ts`
already carries `toggleToppingStandalone`, which turns the second path on and off
per topping by flipping the product's status.

**Measured 2026-09-07, the whole trading history:** 278 topping units sold as
add-ons for 1.385.000đ, against 2 sold standalone for 16.000đ — one *Kem muối
phô mai* at 6.000đ on 2026-07-14 and one *Đào miếng* at 10.000đ on 2026-07-24.
The rare path is real, not a mis-tap: both were rung at the listed price, ten
days apart. `modifiers` was populated 2026-06-01; the seven `CAT-007` products
were created 2026-06-26, twenty-five days later.

**The two records do not know each other, and that is the defect.** `modifiers`
has no `product_id` (schema `0001_init_schema.sql`). Nothing joins *Kem muối*
`MOD-002` to *Kem muối* `PROD-030` but the spelling of the name. The visible
consequence: the product list decides "never sold" from `order_lines_v2.product_id`
and `variant_id` alone, so five toppings that have really sold — *20ml cốt cà phê*
136 times, *Trân châu trắng* 75, *Kem muối* 17, *Dâu sấy* 6, *Kem dẻo* 1 — are
offered for permanent deletion. The two that are not offered escaped only by
having been sold standalone once each.

**What deletion would actually cost, measured, not assumed:** the erase RPC
(`0075_erase_never_sold_product.sql`) removes the product, its variants and its
price history. Past orders keep their own snapshot of name and price, and the
`modifiers` row survives, so no sale, no revenue figure and no add-on stops
working. What is lost is the catalogue record and the price history of a topping
the shop genuinely sells. The error is a screen stating a falsehood about
trading history, not money going missing.

**Not a costing gap.** Toppings carry no recipe and every `order_lines_v2` row
has `cost_at_sale = 0`, but that is `BR-COGS-005` working as decided on
2026-08-07, not an omission: cost is measured by counting stock at a stocktake,
not per cup. Topping revenue is inside `gross_line_total` — a 22.000đ drink with
a 5.000đ topping stores 27.000đ — which is why `verify-revenue` reconciles.

**Open, deliberately not decided here:** *Hộp sữa chua* (`MOD-009`, created
2026-08-28) has no `CAT-007` product, so it cannot be sold standalone and has
nothing to link to. `Dâu sấy` has two modifier rows, `MOD-007` (DELETED) and
`MOD-008` (ACTIVE), which must both point at `PROD-035`. And `CAT-007` is
hard-coded in `toggleToppingStandalone` rather than being a column a screen can
edit, against the rule that anything the owner may want to change belongs in
data.

**A linked topping's price has one edit point.** Owner decision 2026-09-07,
asked with the concrete case — *Kem muối* at 4.000đ on both sides, raising it
currently means remembering two screens: *"Luôn cùng giá, sửa một chỗ."*
`sync_topping_price_atomic` (migration `0098`, applied to production
2026-09-08) writes `modifiers.price` and the linked product's single ACTIVE
variant's price, plus a `product_price_history` row, in one transaction.
Refuses rather than guesses on the two conditions that would make "the
standalone price" ambiguous: more than one ACTIVE modifier pointing at the
same product, and a product with other than exactly one ACTIVE variant.
Measured 2026-09-07: 0 products violate either condition today; all 8
linked toppings already agree. A modifier with no linked product (`MOD-009`)
updates only itself. Order history, the POS, and the two names (renaming a
modifier does not rename its product) are untouched.

**The link is the join, not the name — settled 2026-09-08.** Reports merged a
topping's add-on revenue with its standalone revenue by **name equality**, not
by the link: `buildStandaloneToppingMap` matched
`topping-standalone::mod_id=MOD-\d+` against `products.migration_notes`, a
column that has never existed on `products` (11 columns in `0001_init_schema.sql`,
no later `alter` adds it; the `migration_notes` at that file's line 236 belongs
to `orders_v2`), so the regex never matched and the code fell through to a
name lookup. Measured 2026-09-08: 7 of 7 linked modifiers name-match their
product exactly, which is the only reason the Bán hàng report reads correctly.
Combined with the rule above — renaming a modifier does not rename its product —
the first rename would have split that topping into two report rows silently.
`modifiers.product_id` (migration `0097`) is the join from now on. The name is
a label, never a key.

**Toppings do not appear among the POS quick-add best-sellers, owner decision
2026-09-08.** `getPOSBestSellerProductIds` always intended to exclude standalone
toppings and never did, for the same dead-regex reason, so they have been
eligible for those buttons all along. Asked whether to keep the behaviour the
shop actually runs on or the one the code intended, the owner chose to exclude
them: the quick-add strip holds 8 slots and a topping there costs a drink its
place. This is a visible change for staff from the first shift after deploy.

**A topping with no standalone món can grow one from the Topping screen.**
Turning *Bán độc lập* on for an unlinked modifier (`MOD-009`, *Hộp sữa chua*, is
the only one today) asks first, then creates the `CAT-007` product, its single
ACTIVE variant at the modifier's price, and the link — one transaction, or none
of it. A product created without its link would be a second place to edit a
price, which is exactly what the rule above exists to prevent. Only the
*Thêm Topping* group may do this: *Chọn Size*, *Chọn Đường* and *Chọn Đá* are
choices inside a drink, and a món called "Size L" on the menu would be a defect.
