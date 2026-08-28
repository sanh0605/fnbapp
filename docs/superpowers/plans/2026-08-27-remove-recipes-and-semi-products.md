# Remove recipes and semi-products

**Written 2026-08-27 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1).

**This deletes master data, which `CLAUDE.md` §2 forbids.** It proceeds on an
explicit owner decision made after the objection was put to him in full —
*"Anh cho rằng xoá vẫn là phương án phù hợp để sau này làm lại sẽ tốt hơn đi
chữa những cái đã sai trong quá khứ."* §7 records what that costs.

---

## 1. The conflict that started it

Trái tắc and Trái chanh carry the base unit **trái**. He buys them by **kg**. A
base ingredient takes one unit, so the two cannot both be right, and 21 active
recipes are written in *trái*.

**That conflict alone has a one-number fix** (§6) and did not require this. The
owner's reason for going further is that early-stage F&B recipes change faster
than anyone can maintain them, and rebuilding later on a clean base beats
repairing a record that was never accurate.

## 1b. What the owner actually needs the system to hold

Stated by him 2026-08-27, and it is the clearest scope this project has been
given: *"Anh chỉ cần có thể lưu trữ được đã bán sản phẩm gì, đã nhập kho cái gì,
đã xuất kho cái gì để có báo cáo bán hàng, báo cáo lãi lỗ và báo cáo dòng
tiền."*

Three reports, and what each is built from:

| Report | Reads |
|---|---|
| Bán hàng | `orders_v2` + `order_lines_v2` |
| Lãi lỗ | revenue from orders, cost from `stock_issues` and `is_non_inventory` purchases, expenses from batch 4 |
| Dòng tiền | money in from orders, money out from `purchase_orders` and expenses |

**A recipe appears in none of them.** Verified rather than asserted: the sales
report's only allocator import is `breakdownRevenueByProduct`, and that function
reads no recipe — checked line by line inside its body, not by its name.

This is the strongest argument for the deletion and it is the owner's, not mine.

## 2. Measured before agreeing, 2026-08-27

| | Count |
|---|---:|
| `recipes` — 96 product variant, 29 semi-product, 9 modifier | **134** |
| `semi_products` | **17** |
| `production_orders` — the manufacturing flow, **never used once** | **0** |
| `production_items` | **0** |
| Order lines whose cost came from a recipe | **0** |
| Order lines carrying their own `recipe_snapshot_json` | **3.402 of 3.403** (was 3.363 of 3.364 on 2026-08-27 — he keeps selling, and every new line still gets one) |
| `purchased_items` referencing a semi-product | **0** |
| `stock_ledger` rows for a semi-product | **0** |
| `inventory_balances` rows for a semi-product, **all `0.00`** | **11** |

**Nothing computes money from a recipe.** COGS has been issue-based since the
2026-08-07 cutover (`BR-COGS-005`), and `cost_at_sale` is 0 on every line.
`breakdownCOGSByIngredientFifoLegacy` — the one function that *requires* a
semi-product recipe — **is called from nowhere**; verified by grep across
`app/` and `lib/`.

**Nothing blocks a sale for want of a recipe.** The POS path has no such guard.

**Foreign keys do not obstruct this.** `purchased_items.semi_product_id` and
`production_orders.semi_product_id` are both `RESTRICT`, and both have **0
rows**. `recipes` has **no foreign key pointing at it at all**.

**An objection I raised and the data refused.** I told the owner recipes were
the only record of what goes into a drink. They are not: **3.363 of 3.364 order
lines carry their own snapshot**, so the history of what was actually sold
survives deletion untouched. That argument should not be repeated.

## 3. Phase 1 — export first, delete nothing

Write `recipes` (all 134, every column), `semi_products` (17), and the 11
`inventory_balances` rows to `docs/audits/2026-08-27-recipes-semi-products-backup.json`.

`CLAUDE.md` §11 already protects that directory: *"File `.json` trong đó là dữ
liệu, có cái là bản sao lưu duy nhất của dữ liệu đã xoá — không đụng vào."*
**After this phase that file is exactly that.**

Verify the file re-reads and its row counts match before continuing. A backup
nobody opened is not a backup.

## 4. Phase 2 — remove the code, with the data still in place

Order matters: **code first, data second.** If removing a code path breaks
something, the rows are still there to restore behaviour.

- Screens and their nav entries: `app/admin/production/`,
  `app/admin/semi-products/`, and the recipe section of the product editor.
- The recipe machinery: `lib/recipe-selection.ts`, `lib/modifier-recipe.ts`,
  `lib/inventory-consumption.ts`, and the legacy cost paths
  (`lib/order-cogs.ts`, `lib/order-cogs-fifo.ts`, `lib/mac-cogs.ts`,
  `breakdownCOGSByIngredientFifoLegacy`) — **check each is genuinely unreachable
  before removing it**, the same grep that proved the legacy function dead.
- Stop writing `recipe_snapshot_json` on new order lines. **Leave the column and
  every existing value alone** — that is the history §2 says survives.

**Removing a nav entry must not break `nav-guard.test.ts`.** If it does, the
test is asserting the screen exists; update the test in the same commit as the
removal (`CLAUDE.md` §2: a rule and its test change together).

**Gate before phase 3:** `scripts/verify-revenue.ts` byte-identical, COGS
unmoved, full suite green, `npm run build` clean, and the POS completes a test
sale.

## 5. Phase 3 — delete the data

`recipes` (134), `semi_products` (17), and the 11 orphan `inventory_balances`
rows. `production_orders` and `production_items` are already empty.

`fnbapp-bulk-data-change` applies in full. Dry run, exact counts printed, owner
approves the apply. Report the trigger inventory for every table touched before
running — `inventory_balances` is fed by `trg_stock_ledger_inventory_balances`,
so confirm deleting a balance row directly does not re-trigger anything.

**Re-verify after:** revenue unmoved, COGS unmoved, 3.363 snapshots still
present, POS still sells.

## 6. Phase 4 — the original conflict

Set the purchase path for Trái tắc and Trái chanh to **kg**. With the recipes
gone, the *trái* base unit has nothing referencing it, so this is now a plain
choice rather than a conflict: make the base unit **kg** and buy in kg.

This is what the owner was blocked on. It ships last only because phases 2 and 3
remove what made it a conflict; if he needs to buy before then, a conversion row
of `1 kg = 1` unblocks him immediately at no cost, since the item is
`is_non_inventory` and no quantity is computed from it.

## 7. What this costs, stated plainly

- **30 of 96 product recipes cannot be recovered from order history.** Plus all
  29 semi-product and all 9 modifier recipes. **After phase 3 the backup file in
  `docs/audits/` is the only copy.**

  **This said 25 and 25 was the wrong question — Sonnet caught it, re-derived
  2026-08-28.** The 96 recipes cover only **58 distinct variants**, because a
  recipe is versioned over time. My figure asked *was this variant ever sold with
  any snapshot* — variant-level. The question that matters is *does any sale fall
  inside this version's own active window*, because a snapshot captures only the
  version live at that sale. Five more versions belong to variants that did sell,
  but under a different version, so those exact ingredient lists exist nowhere
  else. The semi-product and modifier recipes are backup-only under **either**
  definition: a snapshot records that a drink consumed them, never their own
  ingredient lists.
- **The consumption-versus-theft question closes.** `BR-COGS-007` keeps
  recipe-based expectation open as the way to split them, and August's issue
  slips ran at ~12% of revenue against a 30-40% norm. The 3.363 snapshots still
  support that analysis for drinks already sold; nothing supports it for drinks
  sold from now on until recipes are rebuilt.
- **`BR-COGS-007`'s closing paragraph becomes wrong** and must be rewritten in
  the same commit as phase 3 — it says coverage is complete and the option
  remains open.

## 8. Done means

`CLAUDE.md` §9 in full. Do not push. `CLAUDE.md` §2's never-delete rule needs
the exception recorded with its date and reason, or the next reader will treat
this as a violation of a rule that still reads absolute.
