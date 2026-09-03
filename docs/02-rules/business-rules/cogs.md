# COGS and reporting rules

### BR-COGS-001 — MAC is the primary valuation method

**Status:** `APPROVED`

Moving Average Cost (MAC) is the COGS standard for order valuation and P&L reporting. FIFO remains an audit/debug aid and is not the primary P&L contract.

### BR-COGS-002 — Reports use pinned sale cost

**Status:** `RETIRED`, effective 2026-08-07 — successor `BR-COGS-005`

P&L and order COGS use the stored `cost_at_sale` for the affected sale. A replay difference can be informational without meaning that stored money is wrong.

Superseded by `BR-COGS-005` (owner decision 2026-08-04). Plan C Task 4 applied the cutover on 2026-08-07: `order_lines_v2.cost_at_sale` reset to `0` for every row. No report has read this column since Tasks 2/3; there is nothing left for this rule to describe.

### BR-COGS-005 — Cost is measured when goods leave stock, and there is only one cost figure

**Status:** `APPROVED` — owner decision 2026-08-04

COGS for a period is the value of goods recorded as issued from stock in that period, each issue valued at the weighted average cost of that purchased item at the moment of issue. Sales do not move stock and recipes do not drive cost.

The report carries **one** cost figure, not an old and a new one side by side. The owner declined a parallel display on 2026-08-04.

The owner was shown, before deciding, that June 2026 and July 2026 are closed with no stock count taken, that the new method can never produce a figure for them — a single count yields one figure for the whole elapsed period, and month-level restatement needs month-end counts that were never taken — and that those months will therefore report gross profit equal to full revenue. The owner accepted this and chose deletion.

**Correction 2026-08-05: the figures quoted to the owner on 2026-08-04 were wrong, and are corrected here rather than rewritten above.** They were 32.416.000đ / 19.124.000đ / 1.763.000đ revenue and 16.688.133đ / 7.711.264đ / 605.743đ cost. They came from summing `order_lines_v2` by hand, which skipped all three filters `getPnLDataV2` applies: COMPLETED orders only (`app/admin/reports/actions.ts:138`), the latest version of each order only (same file, line 136 — an edited order leaves an earlier version behind, and both were counted), and the order's date rather than the line's. June was overstated by roughly ten million dong.

Measured by calling `getPnLDataV2` directly: June revenue **22.157.000đ**, July **18.661.000đ**. Cost across all completed order lines is **24.877.232đ over 2.507 lines**, against the 25.005.141đ over 2.699 lines quoted before.

Data did not move. A snapshot restored from the 2026-08-02 drill returns the same 793 completed June orders and the same 22.157.000đ as production does today.

The decision stands: it turned on those months having no count and no way to acquire one, which the corrected figures do not change. **Any figure used as a verification gate must come from calling `getPnLDataV2`, never from summing the tables.**

**Reaffirmed 2026-08-05 on changed grounds.** Once the report was switched to the issue-based figure, no screen or calculation read the stored `cost_at_sale` any longer, so erasing it no longer changed anything visible — its only remaining effect was destroying the record, irreversibly once the ledger goes. The owner was told this and chose deletion again.

Supersedes `BR-SALE-001` and `BR-COGS-002`, both `RETIRED` effective 2026-08-07 — the cutover applied that day (Plan C, Task 4).

### BR-COGS-003 — Rounding and allocation must reconcile

**Status:** `APPROVED`

Line/order allocations, discounts, COGS, and report totals must reconcile at the stored currency precision. Relevant audits must report both count and signed monetary delta.

### BR-COGS-004 — Historical drift is classified before action

**Status:** `APPROVED`

Audit output distinguishes locked matches, stored-value violations, informational replay shifts, known-not-locked items, and new investigation needs. Replay drift alone does not authorize recomputation.

### BR-COGS-007 — Cost of sales, direct materials and shrinkage are three separate lines, and shrinkage has a precondition

**Status:** `APPROVED` — owner decision 2026-08-19 (Plan J).

The P&L separates three things that were previously one:

| Line | Source | Why separate |
|---|---|---|
| **Giá vốn** | `stock_issues` with `source = 'MANUAL'` — what staff recorded leaving stock | Goods that actually went into what was sold |
| **Nguyên liệu mua dùng ngay** | purchases of `is_non_inventory` ingredients or purchased items | Consumed the day they are bought, or never sits on a shelf to be counted at all; stock-managing them costs more than the error (`BR-INV-007`'s judgement) |
| **Hao hụt** | `stock_issues` with `source = 'STOCKTAKE'` — what a count finds missing beyond what was issued | Merging it into cost of sales hides it: *"nếu ghi vào giá vốn thì sẽ không biết thất thoát thực tế"* |

**Widened 2026-08-21:** `is_non_inventory` originally existed only on `base_ingredients` (đá viên, khoai lang, trái tắc, trái chanh, muối hồng, nước, nước sôi). A CONSUMABLE purchased item (a straw, a plastic spoon) has no `base_ingredient_id`, so that flag had nowhere to sit for one — `purchased_items.is_non_inventory` (migration `0068`) closes that gap. **The discriminator is still `BR-INV-007`** (does a sealed pack of it sit on the shelf to be counted), not the item's category: both straws and carrier bags are bought by the kilo and split opposite ways, because one arrives in sealed countable bags and the other does not. Excluded from stocktake when either the linked ingredient is flagged or the purchased item's own flag is set (additive, `app/admin/inventory/stocktake/actions.ts`). Not yet reached by the expense line itself — batch 5 of Plan J is what makes this column feed money; today it only controls stocktake eligibility.

**The precondition, and the reason this is not an exception anyone has to remember:**

**A count's difference is shrinkage only if issue slips were being recorded through that period.** A variance measures departure from a baseline; with no issues recorded there is no baseline, and the difference is simply consumption nobody wrote down.

The first count (2026-08-09, **34.864.627đ**) falls exactly there: **zero issue slips existed before it**, because the feature had not been used since the shop opened in April. That figure is four months of unrecorded consumption, not loss, and it is reported where it falls (`BR-SALE-005`'s sibling decision in Plan J §3b) rather than as shrinkage.

**The rule carries its own validity check.** Any period whose issue-slip count is zero, or implausibly low against sales, produces a variance that must not be read as shrinkage. The report shows the period's slip count beside the figure so the reader can see this without being told.

**Worked example, real data.** From 2026-08-09 to 2026-08-18 staff issued **1.127.515đ** across 17 slips — whole packages opened (Sữa tươi Mlekovita 1.000 ml, Bột cà phê 500 g, Trân châu 2.000 g), which is `BR-INV-007` working as designed. Against roughly 9,5 million đồng of August revenue that is about 12%, where an F&B norm is 30-40%. **The second count resolves which explanation is right:** either staff are not issuing everything, or goods are being lost. Until it happens, neither can be asserted.

**Recipes are not used to compute any of these figures.** Recipe-based expectation was considered as a way to split consumption from loss and set aside: this system measures cost from goods that physically left stock (`BR-COGS-005`), and a recipe states intent, not fact. Coverage is complete (96 active variant recipes cover 3.988 of 3.988 drinks sold), so the option remains open, but nothing in this rule depends on it.

### BR-COGS-006 — A purchase is valued at what was paid, shipping and discounts included

**Status:** `APPROVED` — owner decision 2026-08-09. **Implemented 2026-08-09** (Plan D D11, `lib/purchase-order-cost-allocation.ts`).

The cost of a purchased item is the line amount **plus its share of shipping and tax, minus its share of vouchers and discounts**, allocated across the order's lines in proportion to line value. An item worth 20% of an order absorbs 20% of its shipping and 20% of its discount.

**Found by the owner refusing a figure.** Told the first stocktake would book 52.773.374đ of purchases, he replied that it could not possibly be that much. It could not: that is the sum of line subtotals, while **49.149.880đ** is what was paid. The difference is +648.200đ shipping, −4.049.790đ vouchers, −221.904đ discounts.

**The gap was not a reporting slip, it was in the engine.** `buildIssueCostingPurchases` feeds `purchase_order_lines.subtotal` into the costing replay, and shipping, vouchers and discounts are recorded only on the order header, so they reached no unit cost. Every figure the issue-based engine would have produced was overstated by **3.623.494đ, about 7,4%**. **18 of 63** completed orders carry a voucher, 19 carry shipping, 10 carry a discount — not an edge case.

**Worked example, `PO-031` (2026-06-12), a single-line order:** 10.000 g of `Bột cà phê MR.PHIN Robusta Dak Mil` recorded at 3.140.000đ, paid at 2.417.800đ after shipping, voucher and discount. The engine valued it at **314 đ/g**; the correct figure is **241,78 đ/g** — 23% high on an item used daily.

**Multi-line worked example, `PO-059` (2026-07-28):** three coffee lines totalling 3.415.000đ, +64.400đ shipping, −610.800đ voucher, paid 2.868.600đ. The −546.400đ splits 502.400 / 29.280 / 14.720 across the three lines, reconciling to the dong; unit costs move from 314 / 366 / 184 đ/g to 263,76 / 307,44 / 154,56 đ/g — all 16% high today.

**Method — corrected same day, 2026-08-09.** First implementation reused `allocateOrderDiscount` (`lib/order-math.ts`); the owner asked why not divide each line directly against the order total instead, and was right on both counts he checked: on all 20 real orders carrying a header charge, the direct form and the running-remainder form give identical numbers with 0 residue either way, so the running-remainder's theoretical advantage does not exist in this data; and the adjustment is not always a discount — `PO-056` carries **+40.000đ** (shipping, no voucher), the other 19 are negative — while `allocateOrderDiscount` is shaped for a positive amount to *subtract*, capped per line so nothing goes below zero. A cost-*increasing* adjustment does not fit that shape.

**Current method: direct proportional division, one rounding guard.** `share(line) = round(adjustment × line.subtotal ÷ sum_of_line_subtotals)`, computed independently per line; if the rounded shares do not sum to the adjustment, the residue goes on the line with the largest subtotal. Satisfies `BR-COGS-003` (the parts must sum to the whole) for either sign, without a capacity-capped allocator built for a different problem — and is checkable on a calculator, which matters in a system the owner checks by hand.

**A second, separate bug fixed 2026-08-22 (`OPEN-ITEMS 56`), not this rule's allocation itself.** `lib/purchase-ledger-rebuild.ts`'s `buildPurchaseReceipt` decided whether to convert a purchase into base units by checking `base_ingredient_id` ("is this RAW") instead of whether the item actually had a conversion — correct until batch 1 gave CONSUMABLE items their own conversions too. A consumable purchase would have recorded quantity in *purchase* units (e.g. `2` for "2 Bao") while every stocktake and issue slip records *base* units, corrupting on-hand and `unit_cost` by the conversion factor the moment the first consumable purchase was entered. Fixed before that happened — verified against all 164 real purchase lines (all RAW today), 0 changed.

**The adjusted value is derived and is never stored** — it is computed where the engine reads (`buildIssueCostingPurchases`), consistent with the rule that no rounded or derived money is persisted.

**Correction 2026-08-09: the urgency stated when this rule was written was wrong, and is corrected here rather than rewritten above.** It said the error would be "baked into a number no later correction could reach without counting again". It would not. **No cost is ever persisted** — `stock_issues` carries `base_quantity` and no money column, and every figure is recomputed from `purchase_order_lines` and the issue replay each time a report is read. Fixing the valuation therefore corrects every past period retroactively, including any count taken before the fix.

What is true is narrower: a count taken first would have been *reviewed* against wrong figures, and the owner would have been asked to accept a first-ever cost number that was 7,4% high. That is a good reason to land the fix first, and not the same as irreversibility. The overstatement is recorded because a rule that overstates its own stakes is harder to trust on the points where it is right.

### BR-COGS-008 — Equipment is depreciated straight-line, banded by its own unit price, frozen at purchase

**Status:** `APPROVED` — owner decisions 2026-08-19/22 (Plan J §8; Plan batch 3, asset register).

**No minimum threshold.** *"cái nào cứ cầm nắm để sử dụng được thì đều phải có tính khấu hao"* — everything purchased under an `EQUIPMENT` category is depreciated; there is no expense-it-outright tier.

**Term bands are chosen by unit price, not line total** (owner 2026-08-22: *"Anh cũng nghiêng về giá một cái"*) — eight identical pumps bought on one line at 95.150đ each are eight small 12-month assets, not one 761.200đ 36-month asset. Bands live in `asset_depreciation_bands` (editable, addable, and deletable in a screen, `/admin/inventory/asset-bands` — `CLAUDE.md` §8's rule that a flexible thing without a screen is a hardcoded thing wearing a table), seeded at under 200.000đ → 12 months, 200.000đ–500.000đ → 24, 500.000đ and above → 36 (Vietnamese CCDC practice caps allocation at 36 months).

**Bounds are half-open, fixed 2026-08-23.** `min_unit_price` is inclusive, `max_unit_price` is exclusive (null still means unbounded) — the original inclusive-inclusive design plus integer-adjacency validation only closed the number line when every price was a whole đồng; 199.999,05đ and 500.000,50đ matched no band at all, unreachable in practice only because the allocation step rounded to whole đồng before the band lookup ever saw the number. A price of exactly 500.000đ now falls in the 36-month band, not the 24-month one.

**`validateBands` requires the bands to cover the entire price line, not just be internally consistent, fixed 2026-08-23.** The original check only verified no gap or overlap AMONG whichever bands existed — it never required the lowest band to start at 0đ or that an unbounded band exist at all. Once delete became possible (same fix), removing the first or last band would have passed every other check while leaving a real coverage hole at one edge, surfacing later only as an opaque refusal the first time someone bought something priced in the now-uncovered range. Deleting a band is a hard delete, not a soft one — `assets.term_months` is frozen at creation (below) and carries no reference back to the band that produced it, so nothing depends on a retired band continuing to exist.

**The term is frozen at the moment an asset is created, never re-derived.** *"anh chỉ thay đổi luật chứ không đồng nghĩa luật đó phải áp dụng lại cho tất cả những gì đã được áp dụng trước đó."* Editing a band's term or boundaries affects only assets created after the edit; `assets.term_months` is a stored value, not a live lookup.

**The register answers "what does the shop own," not "what still has value."** An asset whose term has ended stays listed at 0đ; only marking it broken or disposed (`asset_disposals`, insert-only, never a delete or a downward mutation of `assets.quantity`) removes it from what is owned, charging whatever value remained to that month.

**One row per purchase line, not per physical unit.** Eight pumps bought together share a price, a date and a term; partial disposal is handled by `quantity` on the asset minus the sum of its disposals, not by giving each physical unit its own identity. `lib/asset-depreciation.ts`'s schedule builder settles each disposal's own cohort of units exactly (the remaining undepreciated value of exactly the disposed units, computed from first principles each time), so the schedule sums to cost exactly regardless of how many separate disposals one asset accumulates.

**The schedule's basis is the real allocated total, not quantity × unit price, fixed 2026-08-23.** `assets.unit_cost` is `round(total ÷ quantity)` — multiplying that rounded figure back up does not reproduce what was paid. Measured across the owner's 72 real equipment items: 11 drift, up to +48đ on one line (`Hủ đựng topping liền nắp`, 200 units at 80.352đ paid: `200 × round(80352÷200)` = 80.400đ, +48đ over). `assets.total_cost` now stores the unrounded allocated line total and is what the depreciation schedule actually apportions; `unit_cost` remains for the band lookup and for display only.

**Purchasing an equipment item creates the asset automatically.** Completing a NEW purchase order with an `EQUIPMENT`-category line inserts the corresponding `assets` row, `unit_cost`/`total_cost` taken from the same `allocatePurchaseOrderCost` allocation the COGS report uses (BR-COGS-006) — never recomputed independently. **Known limitation:** editing an already-completed purchase order does not touch any asset it already created; what should happen there is unaddressed by the plan and left for a future decision rather than guessed at.

**Not yet consumed anywhere.** The monthly charge this rule computes feeds no P&L line yet — that is batch 4/5's job. This rule governs the register and the schedule only.

