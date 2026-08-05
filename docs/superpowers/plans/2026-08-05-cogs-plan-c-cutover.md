# Issue-Based COGS — Plan C: Cutover and Deletion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The reports carry one cost figure, computed from goods issued. The
recipe-driven cost path and the data that served it are gone.

**Architecture:** Plan B built the engine, the issue records, and the count that
produces them, and changed no report. This plan switches the reports over, then
removes what the old method needed. Deletion follows the switch, not the other
way round — there is nothing to gain from a window where neither method works.

**Tech Stack:** TypeScript, Vitest, Supabase Postgres migrations, `vite-node`.

**Spec:** `docs/superpowers/specs/2026-08-02-issue-based-cogs-design.md`
**Depends on:** `docs/superpowers/plans/2026-08-04-cogs-plan-b-parallel-path.md`,
complete through Task 3. Its Task 4 — the one-off old-versus-new comparison —
was cancelled by the owner on 2026-08-05, so no comparison gates this plan.
Task 4's sort-column check moved into Task 2 here.

## The decision this plan carries out, and what the owner was told first

Owner decision 2026-08-04, recorded as `BR-COGS-005`. The owner asked for the
old cost figure to be deleted rather than kept beside the new one.

Before deciding, the owner was shown these measured figures and the consequence:

| Month | Revenue | COGS today | After this plan |
|---|---|---|---|
| 2026-06 | 22.157.000đ | re-measure | **0đ** |
| 2026-07 | 18.661.000đ | re-measure | **0đ** |
| 2026-08 | 2.564.000đ (open month) | re-measure | **0đ until a first count exists** |

**These replace wrong figures, and how they were wrong is the durable lesson.**
The first version of this plan carried 32.416.000đ / 19.124.000đ / 1.763.000đ,
produced by summing `order_lines_v2` by hand. That skipped every filter
`getPnLDataV2` applies: COMPLETED orders only
(`app/admin/reports/actions.ts:75,138`), the latest version of each order only
(`:136` — an edited order leaves an earlier version behind, and both were
counted), and the order's date rather than the line's. June was overstated by
about ten million dong.

The data did not move: a snapshot restored from the 2026-08-02 drill returns the
same 793 completed June orders and the same total as production today. The
measurement was wrong from the start.

**Rule for every figure in this plan: call `getPnLDataV2`. Never sum the
tables.** The per-month cost figures are marked "re-measure" rather than
carried forward, because they came from the same discredited method and no
substitute has been produced by the authoritative path yet. Task 1 produces
them, and no later task may quote a number this plan has not re-measured.

June and July are closed with no stock count taken. The new method derives cost
from what a count shows is missing, so it can produce **one** figure for the
whole elapsed period and cannot split it by month — month-level restatement
needs month-end counts, and those moments have passed. Those two months will
report gross profit equal to full revenue, permanently.

The owner accepted this and chose deletion. This is recorded so a later reader
sees a decision, not an accident.

**On reversibility, stated precisely rather than reassuringly.** `cost_at_sale`
could in principle be recomputed from the recipe snapshots each order line still
carries, for as long as `lib/full-history-recompute.ts` and
`lib/inventory-consumption.ts` remain in the repository — which Task 6 keeps.
But recomputing it would reproduce recipe-derived cost, the method being
abandoned. Treat the numbers as gone.

## Global Constraints

- Code and comments in English. User-facing strings Vietnamese.
- `npx tsc --noEmit` — 0 errors. Full suite green before each commit.
- **A verified-restorable backup exists before any deletion step runs.** Not a
  backup taken — a backup restored somewhere and checked. Spec section 10.
- Every deleting or updating script: dry-run by default, `--apply` to write,
  exact counts and the affected objects printed before writing, owner approves
  each apply. (`CLAUDE.md` section 2.)
- **Revenue must not move**, and only a closed month can say so. June 2026
  **22.157.000đ** and July 2026 **18.661.000đ**, from `getPnLDataV2` on
  2026-08-05. August is an open month — it rises with every sale, so it is not a
  gate and never was one; the earlier version of this plan wrongly listed it as
  a fixed figure. This plan touches cost only. Any movement in June or July is a
  defect — stop.
- Sales orders, purchase orders, and recipes are not deleted, not edited, and
  not reordered. Only `cost_at_sale` is reset, in place, to the column's own
  default.
- Master data is never deleted. Nothing here removes an ingredient, product,
  recipe, order, or supplier.
- Re-measure every row count at execution time before deleting. The counts below
  were taken 2026-08-02 and 2026-08-04; data has moved since and will move again.
- Migrations continue from `0054`.
- Do not push.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/backup-verify-restore.ts` (create or reuse) | Prove the backup restores before anything is deleted | 1 |
| `app/admin/reports/actions.ts` (modify) | `totalCOGS` comes from issues, not `cost_at_sale` | 2 |
| `app/admin/orders/actions.ts` (modify) | Order-level cost stops claiming a per-order figure | 2 |
| `app/pos/actions.ts` (modify) | Checkout stops computing a sale cost | 3 |
| `scripts/reset-cost-at-sale.ts` (create) | Dry-run/`--apply` reset of 2.699 stored values | 4 |
| `scripts/delete-derived-stock-rows.ts` (create) | Dry-run/`--apply` deletion of the derived ledger and the recovery log | 5 |
| `supabase/migrations/0054_retire_cost_machinery.sql` (create) | Drop the triggers and jobs that maintained the old figure | 6 |
| `CLAUDE.md` (modify) | Section 7 rewritten | 7 |
| `docs/BUSINESS-RULES.md` (modify) | `BR-SALE-001`, `BR-COGS-002` retired | 7 |

---

### Task 1: Prove the backup restores

**Files:**
- Create or reuse: `scripts/backup-verify-restore.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a recorded restore result. No application code depends on this task;
  every later task depends on it having passed.

`docs/BUSINESS-RULES.md` `BR-BACKUP-005` and `BR-U-004` both say the same thing
in different words: a backup is a recovery input, not proof of recoverability.
This plan destroys roughly 24,9 million dong of cost history — measured
2026-08-05 as **24.877.232đ across 2.507 completed order lines**. Task 1 Step 3
re-measures it rather than trusting that figure. The proof happens first.

- [ ] **Step 1: Take a full backup and record its identifier and size**

- [ ] **Step 1b: Bring the restore target's schema up to date first**

Confirmed reachable in the challenge round, and the mechanism has genuinely run
once — the 2026-08-02 drill, `VERDICT PASS` in
`docs/audits/2026-08-02-restore-drill.md`. So this step is real work, not
theory.

But the target is **two migrations behind**: `0052` and `0053`, the two Plan B
added. Run `supabase db push` against it before restoring, or the restore lands
in a schema with no `stock_issues` table and the old `item_type` constraint, and
proves nothing about the database this plan is about to change.

- [ ] **Step 2: Restore it somewhere that is not production**

- [ ] **Step 3: Verify the restore by counting the things this plan destroys**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  Đo trên production NGAY TRƯỚC khi sao lưu, rồi đo lại y hệt trên bản phục
  hồi. Hai con số phải khớp tới từng đồng.
  Mốc đo 2026-08-05 để nhận ra sai lệch bất thường: 2.507 dòng, 24.877.232đ.
  Lệch nhỏ so với mốc này là bình thường (quán vẫn đang bán).
  Production và bản phục hồi lệch nhau -> bản sao lưu không dùng được.
  DỪNG. Không xoá gì cả.
```

- [ ] **Step 4: Record the result in `DEVELOPMENT-TRACKING.md` before proceeding**

A restore that was performed but not written down cannot be relied on later.

---

### Task 2: The reports read the new figure

**Files:**
- Modify: `app/admin/reports/actions.ts`
- Modify: `app/admin/orders/actions.ts`

**Interfaces:**
- Consumes: `computeIssueCosting` (Plan B Task 1), `stock_issues` (Plan B).
- Produces: a `totalCOGS` derived from issues. The field name does not change,
  so the 59 files referencing cost keep compiling.

`app/admin/reports/actions.ts:181` currently reads:

```ts
const totalCOGS = typedLines.reduce((s, l) => s + l.cost_at_sale, 0);
```

It becomes the sum of `issued_value` over the period's issues. Keep the name and
the type; only the source changes.

Load purchases the way Plan B Task 1 pins: join `purchase_order_lines` to
`purchase_orders`, filter `status = 'COMPLETED'`, and order by
`transaction_date` (fallback `created_at`). `purchase_order_lines` has no status
column, and 57 of 62 completed orders were entered on a different day from the
one they happened. Reuse Plan B's loader rather than writing a second one.

**This task inherits Plan B Task 4's sort-column check**, because cancelling
that task made this the first real caller of `computeIssueCosting`.
`computeIssueCosting` is pure and takes `at` as given, so nothing upstream can
catch a caller that fills it from the wrong column.

- [ ] **Step 1b: Prove the sort column is the right one**

Sort the same purchases both ways and compare `issued_value` per item.

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  62 đơn nhập đã hoàn tất, 57 đơn có ngày giao dịch lệch ngày ghi sổ quá 12 giờ,
  lệch xa nhất 66,8 ngày (PO-008).
  Sắp theo hai cột khác nhau phải cho ra kết quả KHÁC NHAU ở ĐÚNG 1 mặt hàng
  (trong số 30 mặt hàng có từ 2 lần nhập trở lên).
  Nếu ra giống hệt nhau -> đang lấy cùng một cột cho cả hai lần sắp, phép kiểm
  không chứng minh được gì. DỪNG và sửa phép kiểm trước.
```

**The figure this task switches to will be 0đ, and that is expected.** Measured
2026-08-05: `stock_issues` holds 0 rows and no stocktake session has ever been
committed. Until a first count happens, the new COGS is zero for every month —
including the current one, not only the closed months the owner accepted on
2026-08-04. Do not treat a zero here as a defect and do not patch around it;
report it and let the count fix it.

**Two consequences that are not optional to think about:**

`actions.ts:318-324` forces the rounding remainder onto the first row of
`cogsDetails` so the detail table sums to `totalCOGS`. `cogsDetails` is a
breakdown **by ingredient consumed**, which the new method does not produce — it
knows what left stock, not which drink used it.

**Decided 2026-08-05: delete it. Do not build a replacement.** The earlier
"replace or remove" wording broke this plan's own no-placeholders rule by
leaving the choice to whoever executes it.

Two findings settle it. First, `cogsDetails` is built by
`breakdownCOGSByIngredient` (`lib/report-v2-allocators.ts:156`), which runs
`FIFOTracker` / `computeLineCostFIFO` (`lib/fifo-tracker.ts`,
`lib/order-cogs-fifo.ts`) directly over `SALES_CONSUME`, `PRODUCTION_CONSUME`
and `EDIT_REVERSAL` — the exact rows Task 5 deletes. There is no light edit that
keeps it alive.

Second, a purchased-item replacement is buildable but not truthful.
`issued_value` is already per `purchased_item_id`, so the table would render —
but `stock_issues` rows are not attributable to a month. One count covers
everything since the previous count, possibly spanning months. Splitting that
into a June column needs an allocation rule with nothing behind it, which is the
same problem this design already refused to solve for the total. Building it
would mean solving at line level what the plan declared unsolvable at total
level.

Leaving the block untouched is the one thing that must not happen: it would then
force the whole recipe-versus-issue discrepancy onto a single ingredient row.

Per-product margin is gone by design (spec section 9). `actions.ts:722-726`
allocates cost to product variants from `cost_at_sale`. With that value at 0,
every product shows 100% margin. Either remove that breakdown or label it
plainly in Vietnamese as no longer available — do not ship a screen showing
every drink at 100% margin with no explanation.

- [ ] **Step 1: Write the failing test for the new `totalCOGS` source**

- [ ] **Step 2: Switch the source**

- [ ] **Step 3: Decide and implement what happens to the two breakdowns above**

- [ ] **Step 4: Confirm revenue did not move**

Read the P&L for June and July, the two closed months. Revenue must read
22.157.000đ and 18.661.000đ. If either moved, the change reached beyond cost —
stop. Do not gate on August; it is open and rises with every sale.

- [ ] **Step 5: Suite, type check, commit**

---

### Task 3: Checkout stops computing a sale cost

**Files:**
- Modify: `app/pos/actions.ts`
- Modify: `app/admin/orders/actions.ts`
- Modify: `app/admin/production/actions.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: order lines written with `cost_at_sale` at its column default, 0,
  and no sales-driven stock movement from any path.

Selling no longer moves stock and no longer determines cost. Checkout should
stop doing the work, not merely have its result ignored — the recipe lookup at
checkout is also latency on the till.

**Checkout is not the only path that moves stock at sale time.** This plan
originally named `app/pos/actions.ts` alone, which was wrong:
`app/admin/orders/actions.ts` also writes sales-driven ledger rows, including
the `EDIT_REVERSAL` rows Task 5 deletes.

That ordering matters. If the edit and void paths keep reversing sales
consumption after Task 5 has deleted every `SALES_CONSUME` row, an operator
editing an old order asks the system to reverse movement that no longer exists.
Retire both paths here, before anything is deleted, rather than discovering the
interaction afterwards.

**And a third path, found in the challenge round.**
`app/admin/production/actions.ts:104-117` writes `PRODUCTION_CONSUME` and
`PRODUCTION_YIELD` directly. This is the real "Sản xuất / Nấu Bếp" screen,
reachable from the live navigation (`app/admin/layout.tsx:44`) — not the
implicit production the spec describes.

The measurement that makes it urgent: `production_orders` holds **0** rows,
matching `CLAUDE.md` section 7's statement that no production order was ever
issued — yet **3.337** `PRODUCTION_CONSUME` / `PRODUCTION_YIELD` rows exist in
`stock_ledger`. The screen is live and reachable whether or not it has been used
deliberately.

Leave it and this plan's own verification bar breaks the first time somebody
opens that screen: `stock_ledger` would no longer hold purchase receipts only.
All three write paths retire in this task.

- [ ] **Step 1: Write the failing test — a checkout writes cost 0 and no ledger row**

- [ ] **Step 2: Remove the cost computation and the sale-time stock deduction**

- [ ] **Step 3: Ring up one real test sale and read back the row**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Bán thử một ly bất kỳ. Dòng đơn ghi ra phải có giá vốn = 0,
  và sổ kho phải KHÔNG có thêm dòng nào.
  Nếu sổ kho có thêm dòng -> còn đường trừ tồn cũ chưa gỡ, DỪNG.
```

- [ ] **Step 4: Suite, type check, commit**

---

### Task 4: Reset the stored cost values

**Files:**
- Create: `scripts/reset-cost-at-sale.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `order_lines_v2.cost_at_sale` at 0 for every row.

**Read `fnbapp-bulk-data-change` before writing this script.** It exists because
a change believed to be behaviour-neutral fired a trigger that scheduled an
automatic process to overwrite historical data.

The column is `cost_at_sale bigint not null default 0`
(`0001_init_schema.sql:262`). The column stays; its values return to the
default. Nothing is dropped, so nothing referencing it breaks.

- [ ] **Step 1: List every trigger on `order_lines_v2` and state what each does with these rows**

```sql
select tgname, pg_get_triggerdef(oid)
  from pg_trigger
 where tgrelid = 'public.order_lines_v2'::regclass
   and not tgisinternal;
```

`0011_hong_to_luc_idempotency_precision_fix.sql` compares `cost_at_sale` against
recorded before/after values in several places. Establish whether any of that is
still live before updating roughly 2.500 rows underneath it.

- [ ] **Step 2: Write the script, dry-run by default**

Dry run prints: rows affected, the current total, and the total after. Owner
approves the apply.

- [ ] **Step 3: Dry run, and check the printed total against the known figure**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  Chạy thử phải in ra: số dòng, tổng giá vốn hiện tại, và tổng sau khi ghi (0đ).
  Mốc đo 2026-08-05: 2.507 dòng, 24.877.232đ. Lệch nhỏ là bình thường vì quán
  vẫn đang bán; lệch lớn thì script đang nhắm sai tập dữ liệu.
  Con số in ra PHẢI khớp với chính con số Task 1 đã đo lúc sao lưu.
  Không khớp -> DỪNG, đừng chạy --apply.
```

- [ ] **Step 4: Owner approves, then `--apply`**

- [ ] **Step 5: Confirm and commit**

Re-read the three months. Cost 0, revenue unchanged.

---

### Task 5: Delete the derived stock rows and the recovery log

**Files:**
- Create: `scripts/delete-derived-stock-rows.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `stock_ledger` holding purchase receipts only.

Counts measured 2026-08-02 — **re-measure before deleting**, they have moved:

| Data | Rows then | Why it goes |
|---|---|---|
| `SALES_CONSUME` | 6.874 | Stock deduction inferred from recipes at sale |
| `PRODUCTION_CONSUME` | 1.845 | Raw ingredients consumed by implicit production |
| `PRODUCTION_YIELD` | 1.454 | Semi-products created by implicit production |
| `STOCK_ADJUST` | 13 | Not made by the owner — phantom rows already on record |
| `EDIT_REVERSAL` | 72 | Reverses sales-driven movement that no longer exists |
| `data_recovery_changes` | ~46.000 (15,88 MB) | The correction machinery's log; the machinery retires |

`stock_ledger` is left holding the `PO_RECEIPT` rows — what was actually
purchased. That is the literal form of *nhập gì xuất đó*.

- [ ] **Step 1: List the triggers on both tables and state what each does**

`0038_materialize_inventory_balances.sql:64-68` fires on **delete** as well as
insert, subtracting each removed row from `inventory_balances`. Deleting the
derived rows therefore rewrites every balance — which is intended here, but it
must be named before it happens, not discovered after.

- [ ] **Step 2: Write the script, dry-run by default**

- [ ] **Step 3: Dry run and check the arithmetic on one named ingredient**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — đo trước đó:
  Sữa tươi: tồn hiện tại 50.750 g -> sau khi xoá phải thành 134.450 g.
  Sữa đặc:  tồn hiện tại 40.578 g -> sau khi xoá phải thành 104.114 g.
  Tăng lên là ĐÚNG: đã xoá phần trừ tồn suy ra, chỉ còn hàng đã nhập.
  Nếu tồn GIẢM -> script xoá nhầm dòng nhập hàng. DỪNG NGAY.
```

- [ ] **Step 4: Owner approves, then `--apply`**

- [ ] **Step 5: Confirm `stock_ledger` holds only `PO_RECEIPT`, and commit**

---

### Task 6: Retire the machinery, keep the means of reconstruction

**Files:**
- Create: `supabase/migrations/0054_retire_cost_machinery.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: a database with no scheduled process maintaining the old figure.

Retires: the backdated ledger and recipe-event machinery
(`lib/backdated-ledger/**`, `lib/backdated-recipe-events/**`) and its two review
screens, `app/api/cron/apply-backdated-corrections`, the 1.522 queued correction
events, and the drift audits and baseline-lock tables built to police per-line
cost.

**Keep in the repository, remove from the running path:**
`lib/full-history-recompute.ts` and `lib/inventory-consumption.ts`. Deleting both
the data and the means of regenerating it removes the only way back, and saves
nothing. Spec section 5.

**That sentence contradicted this plan until the challenge round caught it.**
`lib/reorder-suggestion.ts` calls `buildInventoryBalances` from
`lib/inventory-consumption.ts`, and feeds the low-stock warnings on the daily
dashboard (`app/admin/reports/daily/actions.ts:80`, `lowStockItems`). A file
cannot be both removed from the running path and called by the daily dashboard.

The deeper problem is not the import. `lib/reorder-suggestion.ts` derives
consumption speed from `SALES_CONSUME` and `PRODUCTION_CONSUME`. After Plan B
Task 3 nothing ever writes those again, so this is not history being deleted —
it is **the input drying up permanently**. The warning would not fail; it would
report "not enough data" forever, which is the quiet kind of broken this project
keeps finding.

**Owner decision 2026-08-05: switch the warning off and say so on the screen.**
Not rebuilt now, not deleted — the section in `app/admin/reports/daily/page.tsx`
renders a plain Vietnamese line explaining that a stock count is needed before
this warning can work again, and `lowStockItems` stops being computed.

What settled it was a number rather than a preference.
`MIN_CONSUMPTION_EVENTS = 3` over a `DEFAULT_LOOKBACK_DAYS = 14` window
(`lib/reorder-suggestion.ts:95-106`). Rebuilt on `stock_issues`, a weekly count
produces two events in fourteen days — below the threshold, so every item would
report "not enough data" anyway. Rebuilding it today would ship a feature that
cannot fire until counting is frequent enough, and nobody yet knows how often
the owner will count.

Remove the call to `buildInventoryBalances` here too, which is what lets
`lib/inventory-consumption.ts` actually leave the running path as this task
claims.

Item 33 stays open for the rebuild decision, now with the threshold arithmetic
attached to it.

**On `getMacUnitCostWithRecipeFallback`, decided rather than left open:**
relabel it, do not repoint it. Repointing changes a number the owner reads when
setting prices, and he has not asked for that. Relabelling in Vietnamese makes
it honest about being an average purchase price without moving anything he
prices against.

**The cost-estimate screen keeps working, and by how much it drifts is
determined, not guessed.** `app/admin/products/cogs-estimate/page.tsx` estimates
a product's cost as recipe times ingredient unit cost. Recipes survive, purchase
orders survive, and semi-products explode their recipe fresh
(`computeSemiProductUnitCost`), so both inputs remain.

Deleting consumption rows barely moves the number, for an exact reason.
`lib/mac-cogs.ts:118-127` removes consumed quantity at `latestKnownMac`, the
running average itself. Removing q units at m from (Q, V) where m = V/Q leaves
(V − qm)/(Q − q) = V/Q = m. Consumption never moves the average; only receipts
do. With `stock_ledger` reduced to `PO_RECEIPT` rows, the figure becomes the
weighted average of every purchase ever made.

**The one case where it does move** is an item that fully depleted and was then
repurchased at a different price. With consumption rows, quantity reached zero
and the next receipt set the average alone; without them, the older cheaper
stock never leaves and keeps dragging the average down. So the estimate stops
forgetting old stock and leans toward a lifetime average — understating items
that ran out and came back dearer.

Relabelling is therefore the honest minimum, not a fudge. **Repointing becomes
the better answer once counts exist**: `closing_value / closing_quantity` from
`computeIssueCosting` knows what actually left, which is more accurate than
today's figure rather than less. Recorded here so the option is not lost —
it belongs with item 33, after counting frequency is known.

**And when it is repointed, it must stay at the ingredient level.** Owner
decision 2026-08-05, in answer to his own question, and the screen already
behaves this way: it prices `base_ingredients` ids, and raw purchase receipts
write `item_reference = base_ingredient_id`, so estimation is already per
ingredient group rather than per brand.

That must survive the repoint, because **recipes speak in generic
ingredients**. A recipe says "20g bột cà phê" and names no brand. Costing the
estimate per purchased item would force an arbitrary brand choice, and the
brands are not close: measured 2026-08-02, Bột cà phê spans roughly 358đ per
unit for Phin Đậm against 1.030đ for MR.PHIN Robusta Dak Mil — a near-threefold
swing on the same recipe line.

So `computeIssueCosting` output, which is per purchased item, must be rolled up
into its `base_ingredient_id` and averaged by quantity on hand before the
estimate uses it.

**The limitation to state rather than hide:** that roll-up weights by what is
held, not by what is actually poured. Holding mostly cheap Phin Đậm while
brewing with Robusta understates the estimate. The only cure is recipes naming
brands, which is not proposed — it would mean rewriting every recipe and binding
each to one supplier.

**Also changing meaning without changing code:**
`getMacUnitCostWithRecipeFallback` (`lib/mac-cogs.ts`) feeds the "current cost"
shown for pricing decisions on `app/admin/products/page.tsx` and
`app/admin/products/cogs-estimate/page.tsx`. With consumption rows deleted it
stops netting off what was used and quietly becomes "average purchase price over
all history" while still returning a plausible number. It is outside Task 3
because it touches neither `cost_at_sale` nor checkout, which is exactly why it
would have been missed. Either relabel it in Vietnamese or point it at the new
average — decide in this task, do not leave it mislabelled.

**Checked and cleared, not a hole:** `lib/cogs-drift-audit.ts` reads those row
types but is reached only from `scripts/audit-cogs-drift.ts`, run by hand. No
live import in `app/` or `lib/`.

- [ ] **Step 1: Confirm the cron has not run and record that fact**

`docs/OPEN-ITEMS.md` items 2b and 19 record that it never started in
production: 132 PENDING events, `is_anomalous = 0` after two nights. Confirm
this still holds — a job that started running between then and now changes what
retiring it means.

- [ ] **Step 2: Remove the scheduled job and the triggers that fed it**

Name the trigger's **function**, not only the trigger. A migration on 2026-07-31
targeted the name instead and applied cleanly while doing nothing.

- [ ] **Step 3: Prove it is gone by querying, not by reading the migration**

- [ ] **Step 4: Confirm the two reconstruction files still exist and still compile**

- [ ] **Step 5: Suite, type check, commit**

---

### Task 7: Make the written rules true again

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/BUSINESS-RULES.md`
- Modify: `docs/OPEN-ITEMS.md`
- Modify: `DEVELOPMENT-TRACKING.md`

**Interfaces:**
- Consumes: every preceding task being complete.
- Produces: rule documents that describe the system that now exists.

`CLAUDE.md` section 7 is the inventory ground-truth rule every agent reasons
from. It currently says recipes plus sales orders determine stock deduction, and
describes implicit production. **This plan makes all of that false.** Rewrite it
to state the new ground truth: purchases are what entered, recorded issues are
what left, recipes describe drinks and no longer touch money.

The 2026-07-31 decision to keep semi-product stock tracking also needs
revisiting, since its stated rationale was serving the inference chain now
removed.

- [ ] **Step 1: Rewrite `CLAUDE.md` section 7**

Keep the file under its 130-line ceiling.

- [ ] **Step 2: Retire `BR-SALE-001` and `BR-COGS-002`**

Status `RETIRED`, successor `BR-COGS-005`, effective date = the date Task 4
applied. Both already carry a supersession note pointing here; convert it.

- [ ] **Step 3: Run the drift checker**

Run: `npx vite-node scripts/check-rules-current.ts`
Expected: 3 PASS. It catches dangling references, and this task creates the
conditions for several.

- [ ] **Step 4: Update `docs/OPEN-ITEMS.md` and `DEVELOPMENT-TRACKING.md`**

Items 2b and 19 (the correction queue) close as moot rather than fixed. Say
which, and why — a closed item that does not say how it closed will be
reopened by someone later.

- [ ] **Step 5: Commit**

---

## Verification bar

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — green. Tests asserting recipe-derived cost will fail
  legitimately; rewrite them to assert the new rule, and say in the commit which
  ones and why. Do not delete a test without stating the reason.
- `npx vite-node scripts/check-rules-current.ts` — 3 PASS.
- Revenue reads 22.157.000đ for June and 18.661.000đ for July — before and after
  every task, from `getPnLDataV2`, never from a hand-rolled sum. August is open
  and is not a gate.
- Purchase orders, sales orders, and recipes byte-identical to their pre-plan
  state.
- `stock_ledger` holds `PO_RECEIPT` rows only.
- The reconstruction files still exist and still compile.
- A verified restore was performed and recorded before any deletion ran.
- No screen shows a cost breakdown that silently reads 0 without saying so.
- No push.

## Out of scope

- The quick-issue button at the counter — deferred 2026-08-04, its own plan.
- Historical restatement of June and July. The owner accepted 2026-08-04 that
  these months carry no cost figure. Nothing in this plan should be read as
  leaving room to reconstruct them later.
- The repository restructure (`docs/OPEN-ITEMS.md` item 27) and phase 2 of the
  rules programme (item 26), both deferred behind this work.
