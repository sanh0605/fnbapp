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
**Depends on:** `docs/superpowers/plans/2026-08-04-cogs-plan-b-parallel-path.md`
complete, including its Task 4 output read by the owner.

## The decision this plan carries out, and what the owner was told first

Owner decision 2026-08-04, recorded as `BR-COGS-005`. The owner asked for the
old cost figure to be deleted rather than kept beside the new one.

Before deciding, the owner was shown these measured figures and the consequence:

| Month | Revenue | COGS today | After this plan |
|---|---|---|---|
| 2026-06 | 32.416.000đ | 16.688.133đ | **0đ** |
| 2026-07 | 19.124.000đ | 7.711.264đ | **0đ** |
| 2026-08 | 1.763.000đ | 605.743đ | new figure, from counts |

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
- **Revenue must not move.** 32.416.000đ / 19.124.000đ / 1.763.000đ for June,
  July, August 2026, measured 2026-08-04. This plan touches cost only. Any
  revenue movement is a defect — stop.
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
This plan destroys 25.005.141đ of cost history. The proof happens first.

- [ ] **Step 1: Take a full backup and record its identifier and size**

- [ ] **Step 2: Restore it somewhere that is not production**

- [ ] **Step 3: Verify the restore by counting the things this plan destroys**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  Bản phục hồi phải có ĐÚNG 2.699 dòng đơn bán có giá vốn đã chốt,
  và tổng giá vốn ba tháng phải ra ĐÚNG 25.005.141đ.
  Lệch một đồng -> bản sao lưu không dùng được. DỪNG. Không xoá gì cả.
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
knows what left stock, not which drink used it. That table cannot survive as a
per-ingredient cost breakdown. Replace it with a breakdown by purchased item
issued, or remove it. Do not leave it summing recipe-derived numbers against an
issue-derived total; that block would then quietly force the entire discrepancy
onto one ingredient row.

Per-product margin is gone by design (spec section 9). `actions.ts:722-726`
allocates cost to product variants from `cost_at_sale`. With that value at 0,
every product shows 100% margin. Either remove that breakdown or label it
plainly in Vietnamese as no longer available — do not ship a screen showing
every drink at 100% margin with no explanation.

- [ ] **Step 1: Write the failing test for the new `totalCOGS` source**

- [ ] **Step 2: Switch the source**

- [ ] **Step 3: Decide and implement what happens to the two breakdowns above**

- [ ] **Step 4: Confirm revenue did not move**

Read the P&L for June, July and August. Revenue must read 32.416.000đ,
19.124.000đ, 1.763.000đ. If any moved, the change reached beyond cost — stop.

- [ ] **Step 5: Suite, type check, commit**

---

### Task 3: Checkout stops computing a sale cost

**Files:**
- Modify: `app/pos/actions.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: order lines written with `cost_at_sale` at its column default, 0.

Selling no longer moves stock and no longer determines cost. Checkout should
stop doing the work, not merely have its result ignored — the recipe lookup at
checkout is also latency on the till.

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
still live before updating 2.699 rows underneath it.

- [ ] **Step 2: Write the script, dry-run by default**

Dry run prints: rows affected, the current total, and the total after. Owner
approves the apply.

- [ ] **Step 3: Dry run, and check the printed total against the known figure**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  Chạy thử phải in ra ĐÚNG: 2.699 dòng, tổng hiện tại 25.005.141đ, sau khi
  ghi 0đ.
  Ra số khác -> script đang nhắm sai tập dữ liệu. DỪNG, đừng chạy --apply.
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
- Revenue reads 32.416.000đ / 19.124.000đ / 1.763.000đ for June, July, August
  2026 — before and after every task.
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
