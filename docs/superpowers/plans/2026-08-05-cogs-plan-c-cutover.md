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
| `app/admin/orders/actions.ts` (modify) | Stops computing a cost when an order is edited | 3 |
| `app/pos/actions.ts` (modify) | Checkout stops computing a sale cost | 3 |
| `scripts/reset-cost-at-sale.ts` (create) | Dry-run/`--apply` reset of 2.590 stored values, every order status, measured 2026-08-08 — this row's original 2.699 did not match any query this plan's own baseline defines; see Task 4 findings | 4 |
| `scripts/delete-derived-stock-rows.ts` (create) | Dry-run/`--apply` deletion of the derived ledger and the recovery log | 5 |
| `supabase/migrations/0054_retire_cost_machinery.sql` (create) | Drop the triggers and jobs that maintained the old figure | 6 — **runs before 4** |
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

- [x] **Step 1: Take a full backup and record its identifier and size**

Per the 2026-08-02 drill's own documented deviation: the actual mechanism is
`buildDatabaseSnapshot`, a fresh read-only snapshot taken at run time, not a
named Drive file. Same artefact this time: **40 tables** (`BACKUP_TABLES`,
counted in `supabase/functions/backup-to-drive/core.ts`), captured immediately
before restoring. **38 of those 40 matched exactly**; the earlier wording here
said "38 tables" and conflated the total with the number that matched.

The two that diverged are `backdated_ledger_events` and
`backdated_recipe_events` — known trigger noise, and both belong to the
correction machinery Task 6 retires, so the divergence sits entirely inside what
this plan is removing.

- [x] **Step 1b: Bring the restore target's schema up to date first**

Confirmed reachable in the challenge round, and the mechanism has genuinely run
once — the 2026-08-02 drill, `VERDICT PASS` in
`docs/audits/2026-08-02-restore-drill.md`. So this step is real work, not
theory.

But the target is **two migrations behind**: `0052` and `0053`, the two Plan B
added. Run `supabase db push` against it before restoring, or the restore lands
in a schema with no `stock_issues` table and the old `item_type` constraint, and
proves nothing about the database this plan is about to change.

Applied both via `supabase db push --db-url` against the target directly.
Target's stale 2026-08-02-drill data cleared first (reverse `BACKUP_TABLES`
order) so the fresh restore did not collide with leftover rows.

- [x] **Step 2: Restore it somewhere that is not production**

- [x] **Step 3: Verify the restore by counting the things this plan destroys**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  Đo trên production NGAY TRƯỚC khi sao lưu, rồi đo lại y hệt trên bản phục
  hồi. Hai con số phải khớp tới từng đồng.
  Mốc đo 2026-08-05 để nhận ra sai lệch bất thường: 2.507 dòng, 24.877.232đ.
  Lệch nhỏ so với mốc này là bình thường (quán vẫn đang bán).
  Production và bản phục hồi lệch nhau -> bản sao lưu không dùng được.
  DỪNG. Không xoá gì cả.
```

Actual: 2.507 dòng, 24.877.232đ trên production ngay trước khi sao lưu, và
**y hệt** trên bản phục hồi — khớp tới từng đồng. Chạy thêm
`scripts/verify-restore-drill.ts`: 38/40 bảng khớp tuyệt đối; 2 bảng lệch
(`backdated_ledger_events`, `backdated_recipe_events`) là nhiễu trigger đã
biết từ đợt 02/08, không phải mất dữ liệu. Ba phép đối chiếu nội dung
(PO-037, một đơn thanh toán chia đôi, 1.729 dòng `stock_ledger` của Sữa đặc)
đều khớp. **VERDICT: PASS.**

- [x] **Step 4: Record the result in `DEVELOPMENT-TRACKING.md` before proceeding**

Recorded. Commit `ebf2e08` (bundled with a concurrent, unrelated commit from
another session editing this same plan file at nearly the same moment — git's
shared staging area merged both; content of both is intact, verified by
reading the file back, not just trusting the diff stat).

A restore that was performed but not written down cannot be relied on later.

---

### Task 1c: Put `stock_issues` inside the backup before it holds anything

**Files:**
- Modify: `supabase/functions/backup-to-drive/core.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `BACKUP_TABLES` covering the table this plan is about to make the
  sole source of cost.

Found during Task 1 and recorded as item 34. `BACKUP_TABLES` predates migration
`0052` and never gained `stock_issues`. Harmless today at 0 rows, which is
exactly why it must be fixed today.

**Why it outranks its own row count.** After Task 5, `stock_ledger` holds
purchase receipts only, and `stock_issues` becomes the single input that turns
purchases into a cost figure. A table in that position sitting outside the
backup means losing it loses every cost figure — and unlike a ledger row, an
issue cannot be recovered by re-deriving, because the goods are already gone and
the count that measured them cannot be retaken.

The mitigation is partial, not sufficient: `stocktake_sessions` and
`stocktake_lines` **are** backed up, so the raw counts survive and issues could
in principle be regenerated. That is re-running the apply logic against
historical state, not restoring.

- [x] **Step 1: Add it in an order the restore can follow**

`lib/backup-restore.ts:72` restores in `BACKUP_TABLES` order so foreign keys
resolve parent-first. `stock_issues` references `purchased_items` and
`stocktake_sessions`, so it must appear after both — placing it immediately
after `stocktake_lines` satisfies this.

Also updated `EXPECTED_TABLES` in `scripts/apps-script/backup-to-drive.gs` —
a second, independent copy of this list. Not fixing it would not have broken
the daily backup (`validateBundle_` treats an unrecognized table as
non-fatal drift by design), but it would have alerted every day until
someone noticed.

- [x] **Step 2: Prove the list is actually longer**

`BACKUP_TABLES` holds 40 entries today. Assert 41, and assert `stock_issues` is
present rather than trusting the diff.

Added to `lib/drive-backup-contract.test.ts`: length 41, membership, and FK
order (after both `purchased_items` and `stocktake_sessions`) — plus fixed
three pre-existing tests that hardcoded the old count of 40.

- [x] **Step 3: Run the backup and confirm the table appears in the bundle**

An entry in a list is not proof the dump ran. Read the bundle.

Called `buildDatabaseSnapshot` against production directly: 41 tables came
back, `stock_issues` among them, `{ rows: [], count: 0 }` — matching
production.

- [x] **Step 4: Close item 34, suite, type check, commit**

970/970 tests, `tsc --noEmit` clean. Commit `5290f30`.

---

### Task 2: The reports read the new figure

**Files:**
- Modify: `app/admin/reports/actions.ts`

`app/admin/orders/actions.ts` was listed here and does not belong. Checked
2026-08-05: its only cost site is line 558, which *computes* a cost when an
order is edited — Task 3's business, not this task's. Nothing under
`app/admin/orders/**` renders `cost_at_sale`; line 753 is row coercion, and the
only components that display cost live under `components/backdated-ledger/**`,
which Task 6 retires. The original entry assumed the order screen showed a cost
figure. It does not.

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

**Write the loader here; there is nothing to reuse.** This plan said "reuse Plan
B's loader", which was stale — the loader would have been written by Plan B Task
4, and the owner cancelled that task. `computeIssueCosting` has had no real
caller since. Write it once, in this task, following the convention Plan B Task
1 pinned: join `purchase_order_lines` to `purchase_orders`, filter
`status = 'COMPLETED'`, take `at` from `transaction_date` with `created_at` as
fallback. `purchase_order_lines` has no status column, and 57 of 62 completed
orders were entered on a different day from the one they happened.

#### Getting one month's cost out of a cumulative engine

`computeIssueCosting` returns cumulative totals per item, not per issue event.
A month's figure therefore comes from **two runs and a subtraction**:

```
truoc thang 6 = computeIssueCosting(mua: TAT CA, xuat: truoc 01/06)
den het th. 6 = computeIssueCosting(mua: TAT CA, xuat: den het 30/06)
gia von thang 6 = (den het th.6) - (truoc thang 6), cong theo tung mat hang
```

This is the only correct method, and the reason is the design itself: an issue's
value depends on the weighted average at the moment it happened, which depends
on every event before it. There is no way to price June's issues without
replaying everything that preceded them.

**Both runs must use an identical purchase set — pass every completed purchase
to both.** The subtraction is only valid because the two replays share an
identical prefix; varying the purchase set between them breaks that. Passing all
purchases is safe regardless of period: the replay is chronological, so a
purchase dated after the last issue cannot change any issue's value, it only
lands in `closing_value`.

- [x] **Step 1c: Prove the months add up to the whole**

The invariant that catches an error in the differencing:

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Cộng giá vốn từng tháng (tháng 6 + tháng 7 + tháng 8) PHẢI bằng đúng
  một lần chạy duy nhất lấy toàn bộ phiếu xuất từ đầu tới hết tháng 8.
  Lệch -> phép trừ sai, hoặc hai lần chạy không dùng cùng tập đơn nhập. DỪNG.

  Trước lần đếm đầu tiên, cả hai vế đều bằng 0đ. Bằng nhau vì cùng rỗng
  KHÔNG chứng minh được gì — phép kiểm này chỉ có nghĩa sau khi có phiếu
  xuất thật. Ghi rõ điều đó trong test, đừng để nó xanh giả.
```

Proven as a unit test (`computePeriodIssuedValue` describe block,
`app/admin/reports/actions.test.ts`), not a live script — production
currently holds 0 real issues, so a live run would be exactly the false-green
case this step warns against. Synthetic fixture: three months of real,
distinct, non-zero issues; asserts `june + july + august === wholePeriod`
**and** `wholePeriod > 0`, so the invariant cannot pass by both sides being
empty.

**This task inherits Plan B Task 4's sort-column check**, because cancelling
that task made this the first real caller of `computeIssueCosting`.
`computeIssueCosting` is pure and takes `at` as given, so nothing upstream can
catch a caller that fills it from the wrong column.

- [x] **Step 1b: Prove the sort column is the right one**

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

Proven live against production, 2026-08-05. Direct replay (matches the
example's exact method — no synthetic issue, purchase order only): **63**
completed purchase orders now (58 skewed >12h, still max 66,8 days), **1 of
30** multi-purchase items reorders relative to itself — `SPM-043`, matching
this figure exactly. Broader check (one synthetic issue per item, to measure
actual downstream impact on `issued_value` rather than just reordering):
**20 of 30** items' computed value changes under the wrong column, several by
the engine throwing "issue precedes any purchase" outright — a stronger,
not contradictory, result answering the same question this step asks.

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

- [x] **Step 1: Write the failing test for the new `totalCOGS` source**

`computePeriodIssuedValue` unit tests in `app/admin/reports/actions.test.ts`,
written and confirmed failing (`is not a function`) before the function
existed.

- [x] **Step 2: Switch the source**

Wrote the loader (`buildIssueCostingPurchases`, `buildIssueCostingIssues`)
and the two-run-subtraction (`computePeriodIssuedValue`) fresh, per the
corrected Files note above — there was no Plan B Task 4 loader to reuse.

- [x] **Step 3: Decide and implement what happens to the two breakdowns above**

`cogsDetails` deleted entirely — data, the rounding-remainder block, the type
field, and its whole UI section. Per-product/topping `cogs`/`grossProfit`/
`marginPct` kept in the type (two pre-existing scripts still read them) but
always `0` / `revenue` / `100`; the P&L page drops those columns from both
breakdown tables (product and topping) and explains why in Vietnamese rather
than showing a false 100% margin. Also deleted `scripts/audit-pnl-mac-consistency.ts`
and `scripts/check-cogs-table.ts` — both audited a three-way MAC consistency
that no longer exists, neither had a live caller, and two operations
playbooks' dangling references to the first one are fixed.

- [x] **Step 4: Confirm revenue did not move**

Read the P&L for June and July, the two closed months. Revenue must read
22.157.000đ and 18.661.000đ. If either moved, the change reached beyond cost —
stop. Do not gate on August; it is open and rises with every sale.

Actual, via a live `getPnLDataV2` call: June 22.157.000đ, July 18.661.000đ —
identical. `totalCOGS` reads 0đ for both, as this task's own note above
predicts (`stock_issues` still holds 0 rows).

- [x] **Step 5: Suite, type check, commit**

971/971 tests, `tsc --noEmit` clean, rule checker clean. Commit `f5ba76e`.

---

### Task 2b: Remove the P&L screen, keep the engine behind it

**Files:**
- Delete: `app/admin/reports/pnl/page.tsx`
- Modify: the navigation entry that links to it
- **Do not touch:** `getPnLDataV2` in `app/admin/reports/actions.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: one fewer screen. No function is removed.

Owner decision 2026-08-05: the report is being redesigned as a real financial
statement (item 31), so rather than maintain a version whose cost column reads
zero, remove it and rebuild from nothing when that discussion happens.

**Checked before agreeing, because deleting a report screen is not obviously
free.** It is free here:

- Revenue does not live on this page. `app/admin/reports/sales/page.tsx`
  ("Báo cáo Bán hàng") computes revenue independently through `getSalesDataV2` —
  order-level gross revenue, discounts, payment split, best sellers, time
  analysis. Removing the P&L costs the owner no revenue reporting.
- The only thing the P&L still contributes is gross profit, which currently
  equals revenue exactly, because cost is zero. It adds no information.
- Task 2 fitted this page with honest Vietnamese notes. That work is not wasted —
  it is what made the page safe to leave standing until now.

**`getPnLDataV2` must survive the deletion of its only screen.** It is this
plan's revenue gate: June 22.157.000đ and July 18.661.000đ are read through it
before and after every remaining task, including the deletions. It is also the
one function this plan trusts, after hand-summed figures proved wrong on
2026-08-05.

That leaves a server action with no page calling it, which normally invites
removal. It is retained deliberately, for the gate and for the rebuild. Say so
in a comment on the function itself, not only here — a plan is not where someone
tidying dead code will look.

- [x] **Step 1: Confirm nothing else renders the page's data**

`getPnLDataV2` is imported by `app/admin/reports/pnl/page.tsx` and the test file,
and nothing else. Re-verify rather than trusting this line.

**This line was wrong.** Re-verified by grep, not trusted: three more files
call `getPnLDataV2` directly through `actions.ts`, never through the page —
`scripts/audit-admin-read-guards.test.ts` (asserts it requires admin auth),
`scripts/audit-lock-bypass-history.ts`, `scripts/verify-pnl-patterns.ts`.
None import the page component, so deleting the page breaks none of them.

- [x] **Step 2: Delete the page and its navigation entry**

A link to a deleted route is worse than no link.

Deleted `app/admin/reports/pnl/page.tsx` and its sibling `loading.tsx`.
Navigation entry removed from `app/admin/layout.tsx` — no other reference to
`reports/pnl` remained anywhere in the repo.

- [x] **Step 3: Add the retention comment to `getPnLDataV2`**

State that it has no caller by design, names the plan and item 31, and is the
revenue gate.

- [x] **Step 4: Prove the gate still works without the page**

Read June and July through the function. Both figures unchanged.

Actual: June 22.157.000đ, July 18.661.000đ — both identical, read live
through `getPnLDataV2` after the page and its `loading.tsx` were gone.

- [x] **Step 5: Suite, type check, commit**

Tests referencing the deleted page are rewritten or removed with a stated
reason. Tests for `getPnLDataV2` itself stay — they now guard the gate.

No dedicated test file existed for the page component, so nothing needed
rewriting. `app/admin/reports/actions.test.ts` untouched. 971/971 tests,
`tsc --noEmit` clean, rule checker clean (fixed one dangling reference to the
deleted page in `docs/OPEN-ITEMS.md` item 31 along the way). Commit `a1c0ad0`.

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

**The production path refuses the operation outright — owner decision
2026-08-05, `BR-INV-006`.** `save_production_order_atomic` hard-validates that
`p_ledger` carries exactly `items.length + 1` rows, so unlike the other two
paths it cannot simply stop writing without a migration to relax it.

It does not get one. Making a batch is refused entirely — no `production_orders`
row, no `production_items`, no ledger row — with a Vietnamese message saying the
ledger now records purchases and periodic counts only.

This is not merely the cheap option. Semi-products stop having stock at all:
measured 2026-08-05, 16 active semi-products hold 3.919 ledger rows and **every
one is a type Task 5 deletes**, none a purchase receipt. Raw ingredients survive
deletion because purchases sit underneath them; semi-products have no floor and
fall to zero with nothing able to add to them. Recording a batch would be
recording an asset whose ingredients were already expensed when they left stock
— the same money twice.

Because that ends semi-product tracking rather than merely disabling a screen,
it was put to the owner rather than decided here. He chose to drop it.

Consequences to carry through this plan: `BR-INV-003` retires with
`BR-SALE-001` and `BR-COGS-002` in Task 7; `CLAUDE.md` section 7's implicit-
production rule goes with them; and the `SEMI_PRODUCT` count type left legal by
Plan B's migration `0052` becomes vestigial — leave the constraint alone, but
the count list must not offer it.

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

- [x] **Step 1: Write the failing test — a checkout writes cost 0 and no ledger row**

- [x] **Step 2: Remove the cost computation and the sale-time stock deduction**

  All three paths retired: `app/pos/actions.ts` (`submitOrderV2`),
  `app/admin/orders/actions.ts` (`editOrderV2` — the OLD version's reversal via
  `buildVoidReversalRows`/`voidOrderV2` is unchanged, only the NEW version's
  cost/consumption computation was removed), `app/admin/production/actions.ts`
  (`saveProductionOrder` refuses outright per `BR-INV-006`). Stocktake's count
  list also stops offering `SEMI_PRODUCT` (`app/admin/inventory/stocktake/actions.ts`),
  the third consequence of the same owner decision.

- [x] **Step 3: Ring up one real test sale and read back the row**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu:
  Bán thử một ly bất kỳ. Dòng đơn ghi ra phải có giá vốn = 0,
  và sổ kho phải KHÔNG có thêm dòng nào.
  Nếu sổ kho có thêm dòng -> còn đường trừ tồn cũ chưa gỡ, DỪNG.
```

  Đo thật 2026-08-05, `scripts/verify-task3-live.ts`, ba lần đếm liên tiếp
  trên dữ liệu thật, tất cả `stock_ledger` = 10.684 dòng trước và sau:
  - Bán một ly (Trà đào dầm, PROD-001/VAR-001, đơn PHD001310): giá vốn dòng
    đơn ghi ra = 0, sổ kho không thêm dòng nào.
  - Sửa chính đơn vừa bán (v1 -> v2): sổ kho không thêm dòng nào (đơn mới sau
    khi bán không có dòng sổ kho cũ nào để đảo).
  - Thử nấu một mẻ (BTP-009): bị từ chối đúng thông điệp tiếng Việt của
    `BR-INV-006`, sổ kho không thêm dòng nào.
  Dọn sạch sau khi đo: huỷ đơn thử (`voidOrderV2`), sổ kho vẫn không đổi.
  Không suy luận từ code — cả ba đếm trên dữ liệu thật.

- [x] **Step 4: Suite, type check, commit**

  `npx tsc --noEmit`: 0 lỗi. `npx vitest run`: 970/970 xanh (165 file test).
  `npx vite-node scripts/check-rules-current.ts`: sạch cả ba rule.

---

### Task 3b: Put a safety catch on the live verification script

**Files:**
- Modify: `scripts/verify-task3-live.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the same proof, reachable only on purpose.

Task 3's verification was the right method — three real counts around a real
sale, a real edit and a refused batch, 10.684 rows unchanged each time, nothing
inferred from reading code. Keep the script; it is the only proof that selling
does not touch the ledger *against the real database*, and Task 5 will want it
again after the deletions.

But it was committed with **no guard**. Running it writes a real sale, a real
edit and a real void into the shop's books immediately, with no dry run and no
confirmation. `CLAUDE.md` section 2 requires the opposite: dry-run by default,
`--apply` to write, exact objects printed first, owner approval per apply.

That run was authorised — the coordinator asked for it explicitly. Leaving it
unguarded is the problem: the next person re-verifying Task 3, agent or human,
creates another order in real sales data without meaning to.

- [x] **Step 1: Default to dry run**

Without `--apply`, print exactly what it *would* do — which product, which
order, which counts it would take — and write nothing.

Confirmed by running without `--apply` on 2026-08-05: printed "1x Cà phê đá
(500ml, VAR-001)" and "Lục trà (BTP-009)" by real name, printed the current
count (10.684) three times as the expected unchanged value, wrote nothing.

- [x] **Step 2: Under `--apply`, print the objects before writing**

Name the product and the order id as they are created, so the audit trail exists
in the console output as well as the database.

- [x] **Step 3: State the cleanup in the output, not only in the code**

The script already voids the order it creates. Say so on screen, and print the
resulting statuses — `SUPERSEDED` for the original, `VOIDED` for the edited
version — so the reader can see the test left nothing countable behind rather
than trusting that it did.

Both statuses are read back from the database after voiding, not assumed from
the call's return value.

- [x] **Step 4: Commit**

`npx tsc --noEmit`: 0 lỗi. `npx vitest run`: 970/970 xanh. `check-rules-current.ts`:
sạch. Not re-run with `--apply` here — Task 3's live proof already stands
(commit `967b157`); running it again would create another real order for no
new information.

---

### Task 6b: Repair the backup that Task 6 broke — blocks Task 4

**Files:**
- Modify: `supabase/functions/backup-to-drive/core.ts` (`BACKUP_TABLES`)
- Modify: `scripts/apps-script/backup-to-drive.gs` (`EXPECTED_TABLES`)
- Modify: whichever tests name the three tables (`lib/drive-backup.test.ts`,
  `lib/backup-restore.test.ts`)
- Redeploy: the `backup-to-drive` Edge Function; repaste the Apps Script

**Interfaces:**
- Consumes: nothing.
- Produces: a Drive backup bundle that completes again.

**Found during review of Task 6 on 2026-08-05, verified against production.**
Migration 0054 dropped three tables that both copies of the backup table list
still name. `dumpTable` throws on any non-2xx
(`supabase/functions/backup-to-drive/core.ts:145-147`), and PostgREST answers a
dropped table with **HTTP 404** — measured directly:
`audit_baseline_locks -> 404`, `stock_issues -> 200`. So the nightly backup
now aborts at the first dropped table it reaches and produces no bundle at all.

It fails loudly rather than silently — `runDailyDriveBackup` re-throws through
`alertFailure_` — so this is an outage, not silent data loss. But Task 4 and
Task 5 both require a fresh backup taken immediately before the apply, and
there is currently no way to take one.

**Both copies must be fixed; fixing one is not enough, and the asymmetry
decides nothing here.** `validateBundle_`
(`scripts/apps-script/backup-to-drive.gs:82-101`) treats a *missing* table as
fatal and an *unexpected* table as a warning. That asymmetry was designed to let
the Edge Function's list grow ahead of the script's. It gives no cover when the
list **shrinks**: fix `core.ts` alone and the bundle arrives without the three
tables, which `validateBundle_` calls missing and rejects; fix the `.gs` alone
and `core.ts` still 404s so no bundle is produced. Edit both, then redeploy and
repaste.

`lib/backup-restore.ts:2` imports `BACKUP_TABLES` from `core.ts`, so the restore
side follows the same edit — no third list. The parent-first restore order note
at `core.ts:39-41` concerns `stock_issues`, which is unaffected.

**Verify by running a real backup and reading its manifest — not by reading the
code.** The table this exact defect class hides behind is the one nobody dumped.

**Also fix while here:** `app/admin/layout.tsx:36` still offers the sidebar
entry "Nhập hàng chờ duyệt" pointing at `/admin/audit/backdated-ledger`, a route
Task 6 deleted. `app/admin/audit/` is now an empty directory. The owner clicking
it gets a 404.

**Done 2026-08-07.** Removed `audit_baseline_locks`, `backdated_ledger_events`,
`backdated_recipe_events` from both `BACKUP_TABLES` (`core.ts`) and
`EXPECTED_TABLES` (`backup-to-drive.gs`), including the order-column entry and
comment that only made sense with `backdated_recipe_events` present. Fixed the
two test files that hardcoded the old counts/tables
(`lib/drive-backup.test.ts`: 41 → 38, dropped the two `toContain` assertions
for retired tables; `lib/backup-restore.test.ts`: swapped the
`audit_baseline_locks` example row for `shifts`, a live table) plus a third
contract test the plan did not name (`lib/drive-backup-contract.test.ts:19`
also pinned `.length` at 41). Removed the dead sidebar entry
(`app/admin/layout.tsx:36`).

Redeployed the Edge Function: `supabase functions deploy backup-to-drive
--project-ref zicuawpwyhmtqmzawvau`. Regenerated
`scratchpad/backup-to-drive-STEP2-paste-this-final.gs` for the owner to paste
into Apps Script (no CLI deploy path for Apps Script here) — still needs that
manual paste to take effect on the nightly run.

**Verified by running the real backup, not by reading the code or tests**, per
this task's own instruction. Ran `buildDatabaseSnapshot` (the exact function
the Edge Function calls) against production directly from a throwaway script:
`BACKUP_TABLES.length` = 38, all three retired tables confirmed absent from
the list, and the returned bundle's manifest (`validateBackupBundle`) reported
`tableCount: 38`, `totalRowCount: 64756`, with every one of the 38 tables
returning real row counts and zero HTTP errors — no repeat of the 404 that
broke the nightly run. Script was not committed (throwaway verification, no
production writes).

Marked stale, not deleted: `docs/runbooks/restore-from-backup.md` described
the now-retired `detect_backdated_ledger_entry`/`detect_backdated_recipe_entry`
noise and the 40-table count from the 2026-07-29 drill. Annotated as historical
record of that drill rather than rewritten, so a future restore drill does not
follow guidance that no longer applies.

`npx tsc --noEmit`: 0 errors. `npx vitest run`: 947/947 (161 files).
`npx vite-node scripts/check-rules-current.ts`: clean.

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

**Found during review 2026-08-07: this line is stale.** The column was
`bigint` at `0001_init_schema.sql:262`, but migration `0046_exact_cost_at_sale.sql`
changed it to `numeric(18,6) not null default 0` (confirmed live against
production via `information_schema.columns`) to stop rounding computed COGS.
The type changed, not the plan: the column still stays, its values still
return to the same default (`0`), nothing referencing it still breaks. Only
the citation was wrong.

**Reaffirmed by the owner 2026-08-05, after being told the reason had changed.**
When he chose deletion on 2026-08-04, zeroing was the only way to stop the
report showing the old figure. Tasks 2 and 3 removed that need: no screen and no
calculation reads `cost_at_sale` any more, and
`breakdownCOGSByIngredient` — the last function that did — now has no caller at
all. So this task changes nothing the owner can see; its only remaining effect
is destroying the record. Told exactly that, he chose deletion again. Proceed.

**Task 6 runs before this task. Reordered 2026-08-05, and the reason matters
more than the reorder.**

`lib/backdated-ledger/anomaly-threshold.ts:47` reads
`if (change.old_cost_at_sale === 0) continue;` — the ratio check that decides
whether a correction is anomalous is **skipped entirely when the old value is
zero**. So the moment this task sets 2.500 lines to 0, every one of the 1.523
queued correction events becomes un-anomalous by definition, and eligible for
automatic application. The nightly cron would then write costs back into the
column this task just cleared.

Dormant today: the route requires `CRON_SECRET`
(`app/api/cron/apply-backdated-corrections/route.ts:36-39`) and item 19 records
that it was never set, which is why 1.523 events have sat untouched. That is the
danger rather than the reassurance — the trap springs later, when somebody fixes
the "broken cron" and silently undoes this task months after anyone remembers
why the column was zeroed.

**Rejecting the 1.523 events was proposed and declined.** It treats the symptom,
costs a write to 1.523 production rows, and leaves the machinery standing. Task 6
already exists to remove that machinery, has to happen regardless, and depends on
nothing in Tasks 4 or 5. Running it first makes the queue unprocessable because
nothing remains to process it — no new script, no extra production write, cause
removed rather than guarded against.

**One boundary for Task 6 when it moves ahead:** it retires the *correction*
machinery — the backdated events, the cron, the drift audits. It must **not**
touch `trg_stock_ledger_inventory_balances`
(`0038_materialize_inventory_balances.sql:64-68`), which fires on delete and is
what keeps `inventory_balances` correct while Task 5 removes ledger rows.
Dropping that one early would leave every balance stale.

**Take a fresh backup immediately before the apply — Task 1's does not cover
this.** Task 1 proved the *mechanism* restores, on 2026-08-05. The shop has sold
since. Restoring that snapshot now would roll back real sales to fix a cost
column, which trades a bigger loss for a smaller one. The snapshot that protects
this apply is one taken minutes before it, not the one that proved restorability
last week.

- [x] **Step 1: List every trigger on `order_lines_v2` and state what each does with these rows**

```sql
select tgname, pg_get_triggerdef(oid)
  from pg_trigger
 where tgrelid = 'public.order_lines_v2'::regclass
   and not tgisinternal;
```

Ran directly against production (not taken on the owner's word, though it
matched): **zero rows.** `prevent_audit_locked_order_line_mutation` was the
last non-internal trigger on this table and Task 6's migration `0054`
already dropped it. Corroborated schema-wide: `public` now has 18
non-internal triggers total, 16 of them `*_touch`, plus
`trg_stock_ledger_inventory_balances` and
`prune_data_recovery_changes_trigger` — matching the owner's own
independent count exactly. Nothing on `order_lines_v2` can fire from this
task's writes.

`0011_hong_to_luc_idempotency_precision_fix.sql` compares `cost_at_sale`
against recorded before/after values in several places, but only inside
`apply_hong_to_luc_migration`, a function — not a trigger (confirmed: it
does not appear in the trigger list above). Confirmed inert: the only
caller of this RPC, `lib/history-ops/hong-luc-migration-transaction.ts`, is
referenced by nothing under `app/` — no live route or scheduled job invokes
it. A one-time 2026-07-09 migration RPC, already run, not wired to anything.

- [x] **Step 2: Write the script, dry-run by default**

`scripts/reset-cost-at-sale.ts`. Dry run prints: rows affected, current
total, total after (0), **the first 10 target rows (order id, line id, the
exact value being reset) — printed in both modes**, the delta against the
known baseline, and current June/July revenue via `getPnLDataV2` for later
comparison. `--apply` batches the update at 100 ids per request (PostgREST
`.in()` filter goes in the URL — a few thousand chars is safe, a few
hundred ids' worth is not, at ~40 chars per `ol-<uuid>` id), then re-reads:
the targeted id set for any still-nonzero row, a fresh full requery of the
same scope for any nonzero row outside the targeted set (a sale landing
mid-run would surface here), and June/July revenue again.

**Two corrections found on re-read 2026-08-08, before asking for `--apply`
approval:**

1. The sample-row printout sat *after* the dry-run return, so it never
   actually printed in dry-run mode — only under `--apply`, once the write
   had already happened and it was too late to look. `CLAUDE.md` section 2
   requires the exact objects, not only the count, before a production
   write. Moved above the dry-run branch so both modes print it.
2. The four post-write checks (write-count shortfall, targeted rows still
   nonzero, whole-table rows still nonzero, revenue moved) only
   `console.log`ged a `MISMATCH` line and kept running to a clean exit —
   a check that cannot fail the run is not a check, the same failure shape
   this whole plan has been hunting. Now collected into a `failures[]`
   array; any non-empty failure list prints `TASK 4 FAILED VERIFICATION --
   do not treat as done` and sets `process.exitCode = 1`. Deliberately not
   thrown mid-way: throwing after the write has already happened would
   skip the remaining checks and hide part of the picture, so every check
   still runs regardless of earlier failures, and only the exit code at
   the end reflects whether any of them failed.

**Scope narrowed to COMPLETED-only during first review, then corrected back
to every row by the owner 2026-08-08.** First pass scoped this to COMPLETED
orders only (same as Task 1's baseline query), reasoning that VOIDED/SUPERSEDED
lines' `cost_at_sale` had never been read by any report. **That reasoning did
not justify that boundary.** Owner re-derived the same numbers independently
and split COMPLETED further by `superseded_by`:

```
COMPLETED, superseded_by IS NULL   -> 1.640 lines  (report reads these)
COMPLETED, superseded_by NOT NULL  ->   911 lines  (report reads none of these)
SUPERSEDED / VOIDED                ->    39 lines  (report reads none of these)
```

911 "never read by any report" lines were sitting *inside* the COMPLETED-only
scope this task had already decided to write to. The line actually drawn was
`status = 'COMPLETED'`, not "read by a report" — two different things — and
the stated reason did not defend the boundary chosen. It would have left
327.047đ of old cost scattered across 39 rows with no consistent
justification for why those specifically survived. **Corrected: no status
filter at all.** `scripts/reset-cost-at-sale.ts` now loads only
`order_lines_v2` and resets every row with `cost_at_sale > 0`, regardless of
the owning order's status. Simpler, too — one table load instead of two, one
filter instead of a join against `orders_v2.status`.

**The self-check after the write was widened to match, not left narrow.**
The original draft's post-write requery filtered to COMPLETED orders only,
same mistake in the other direction: widen the write and forget to widen the
check, and the script would report "0 rows remaining" while 39 untouched
rows sat outside its own filter. Now requeries the whole table with no
status filter.

Confirmed before widening: no row has `cost_at_sale < 0` (`> 0` and `<> 0`
give the same 2.590-row count), so there is no sign-related gap in the
filter either.

**Also found and corrected: the `2.699` figure in this plan's File
Structure table (top of file) did not match any query this plan defines**
at any plausible past date — order lines are not deleted elsewhere in this
plan, so the every-row count should only have grown since whenever 2.699
was written, not shrunk to 2.590 today. Corrected to point at this task's
real, measured scope.

- [x] **Step 3: Dry run, and check the printed total against the known figure**

```
VÍ DỤ ĐÃ TÍNH SẴN để đối chiếu — số thật đo 2026-08-04:
  Chạy thử phải in ra: số dòng, tổng giá vốn hiện tại, và tổng sau khi ghi (0đ).
  Mốc đo 2026-08-05: 2.507 dòng, 24.877.232đ. Lệch nhỏ là bình thường vì quán
  vẫn đang bán; lệch lớn thì script đang nhắm sai tập dữ liệu.
  Con số in ra PHẢI khớp với chính con số Task 1 đã đo lúc sao lưu.
  Không khớp -> DỪNG, đừng chạy --apply.
```

First dry run (2026-08-07, COMPLETED-only scope, since retired): 2.551
dòng, 25.261.811,93đ.

**Re-run 2026-08-08 on the widened, no-status-filter scope, against a fresh
owner-verified baseline (2.590 dòng, 25.588.859,619575đ) rather than the
retired one:** actual **2.590 dòng, 25.588.859,619575đ — exact match, 0
lệch.** No sale landed between the owner's independent measurement and this
run. June/July revenue read via `getPnLDataV2` before any write:
22.157.000đ / 18.661.000đ — unchanged.

**Re-run again 2026-08-08 after the two fixes above (sample printout moved,
checks made failure-capable)** — numbers are proof of nothing once the code
has changed, so this was not skipped as "already proven": same **2.590
dòng, 25.588.859,619575đ**, exact match, exit code 0 in dry-run mode. Ten
sample rows (order id, line id, exact value) now printed in this dry run
itself, not only under `--apply`.

- [x] **Step 4: Owner approves, then `--apply`**

Approved 2026-08-07, scoped to the exact commit (`34cba75`) the owner had
just re-read — explicit condition: any script edit before running voids the
approval. Pre-apply backup: the 2026-08-07 03:36Z Drive bundle
(`fnbapp-backup-2026-08-07.json`, 40.811.568 bytes), taken after Task 6b's
fix and owner-confirmed landed via the artifact itself. Ran unmodified at
that commit.

- [x] **Step 5: Confirm and commit**

Write succeeded (2.590/2.590 rows), the run's own verification did not (see
outcome note below) — fixed, and re-run clean end to end: `Rows to reset: 0`,
all four gated months (April/May/June/July, widened per the owner's question
below) match their known-good figures exactly, whole-table and targeted-set
checks both 0, `All post-write checks passed`, exit code 0. `BR-SALE-001` and
`BR-COGS-002` retired in `docs/BUSINESS-RULES.md`, effective 2026-08-07,
successor `BR-COGS-005`.

---

#### Task 4 outcome, 2026-08-07: the write succeeded, its self-check did not

The `--apply` run wrote all 2.590 rows and then threw on its own first
verification query with an **empty** error message, so it never reached the
whole-table re-query or the revenue gate. Three of the four checks did not run —
they did not fail, they never executed.

**The data is correct.** Confirmed independently, not through the broken script:
whole-table `cost_at_sale <> 0` is **0 rows**, sum exactly `0.000000`, all 2.770
order lines and 1.971 orders still present, and June/July revenue still
22.157.000đ / 18.661.000đ read back through `getPnLDataV2`. Re-running the script
in dry-run mode now reports `Rows to reset: 0` and a baseline delta of
−2.590 / −25.588.860đ.

**Root cause: the verification was too large to execute.** The write loop
batches ids 100 at a time; the check at `scripts/reset-cost-at-sale.ts:100-105`
passes all 2.590 ids to a single `.in("id", ids)`, which PostgREST receives as a
GET URL of roughly 110 KB — past the URL length limit, so the request fails in
transport and `supabase-js` surfaces an error with no message. The author
batched the dangerous half and left the safe-looking half unbatched.

**Third instance in this plan of a check that cannot do its job** — after the
guard placed on the draft branch that no real purchase takes, and the audit
comparing a frozen zero against a real total. This one at least failed loudly.
Before adding any future check, ask what happens to it at production volume, not
just whether its logic is right.

**Fix required before Task 4 is closed:** chunk the `.in()` the same way the
write loop chunks, and prove it against the real 2.590 ids rather than against
the now-empty set — a check that passes because there is nothing left to check
is exactly what this note is about.

#### Fix applied, 2026-08-07

Extracted `batchIds` into `scripts/reset-cost-at-sale-core.ts` (this repo's
`-core.ts` convention — testable without a live client), used for both the
write loop and the now-batched verification query. 6 unit tests
(`reset-cost-at-sale-core.test.ts`), including the exact 2.590-into-100s
split this bug was found at (26 batches, last one 90).

**Proved against real volume, not the now-empty target set — the trap this
note warned about.** A throwaway script ran the fixed batched path over all
2.770 `order_lines_v2` ids: 28 batches, succeeded, 0 nonzero. The same query
unbatched over the same 2.770 ids, in one request: failed with an empty
error message — reproducing the original bug on demand. That is the
evidence the fix matters, not just reads more carefully.

Also fixed while here: the script's own header comment said "decided by the
owner 2026-08-08" — a date that had not arrived yet. Corrected to
2026-08-07.

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

**Two scripts left reporting the frozen figures, found reviewing Task 2.** The
P&L screen was fixed with Vietnamese notes; the scripts that read the same
payload were not.

`scripts/verify-pnl-patterns.ts:53` prints
`margin ${row.marginPct.toFixed(1)}%` per product. Every row now reads
**100,0%** — a full page of results that looks like a finding rather than an
absence. Same class as `audit-pnl-mac-consistency.ts` and `check-cogs-table.ts`,
both already deleted in Task 2 for verifying a consistency that no longer
exists. Give it the same treatment: delete it, or make it refuse to print a
margin it can no longer compute. Do not leave it printing 100%.

`scripts/audit-lock-bypass-history.ts:95` sums `r.cogs` across product rows,
now always 0 — a check comparing zero against zero, which can never fail. Left
deliberately: its subject is `audit_baseline_locks`, which this task retires, so
the script dies with what it audits rather than needing separate handling.

**And once no script reads them, the frozen fields should go too.** Task 2 kept
`cogs`, `grossProfit` and `marginPct` on the product and topping rows — always
`0` / `revenue` / `100` — solely because these two scripts consumed them. A
field carrying a wrong value is worse than an absent one: it survives being
re-added to a screen. Remove them from the payload in this task, once both
consumers are gone.

**Execution order: this task runs before Task 4, not after it.** Reordered
2026-08-05 — the full reasoning sits in Task 4, but in short, once `cost_at_sale`
reads zero the anomaly check stops rejecting anything
(`lib/backdated-ledger/anomaly-threshold.ts:47`), so leaving this machinery
standing across Task 4 arms it to rewrite exactly what Task 4 clears.

**Do not touch `trg_stock_ledger_inventory_balances`.** It is not correction
machinery; it fires on delete and keeps `inventory_balances` correct while Task 5
removes ledger rows. Retiring it here would leave every balance stale.

- [x] **Step 1: Confirm the cron has not run and record that fact**

Re-confirmed 2026-08-06, stronger than the 02/08 record: zero rows in either
queue table have ever carried `reviewed_by = 'system-auto'` (the literal actor
string the cron code uses) — every one of the 522 non-`PENDING` rows was
reviewed by "Claude" (a human-invoked script), none by the sweep. Queue measured
1.391 + 132 = 1.523 PENDING, up from the 02/08 figure of 1.522 by exactly one
new organic detection (a late purchase entry), consistent with zero drainage.
Recorded in migration `0054`'s header comment.

- [x] **Step 2: Remove the scheduled job and the triggers that fed it**

Named the trigger **functions**, not only the triggers: `flag_backdated_ledger_entry()`,
`flag_backdated_recipe_entry()`, `prevent_audit_locked_order_line_mutation()`,
`apply_mac_drift_recovery()`, plus the six recompute/reject/recovery RPCs
(`mark_backdated_event_recomputed`, `mark_backdated_recipe_event_recomputed`,
`apply_backdated_event_recovery`, `apply_backdated_recipe_event_recovery`,
`reject_backdated_event`, `reject_backdated_recipe_event`) — confirmed each had
no caller outside the machinery retiring here before dropping it.
`trg_stock_ledger_inventory_balances` confirmed untouched, before and after.

- [x] **Step 3: Prove it is gone by querying, not by reading the migration**

`pg_trigger`: 0 rows for the three trigger names. `information_schema.tables`:
0 rows for `backdated_ledger_events`/`backdated_recipe_events`/`audit_baseline_locks`.
`trg_stock_ledger_inventory_balances`: still 1 row, confirmed alive.

- [x] **Step 4: Confirm the two reconstruction files still exist and still compile**

`lib/full-history-recompute.ts` and `lib/inventory-consumption.ts` both present;
`npx tsc --noEmit` clean across the whole repo.

- [x] **Step 5: Suite, type check, commit**

`npx tsc --noEmit`: 0 errors. `npx vitest run`: 947/947 (161 files — down from
970/165 by the tests belonging to deleted files). `check-rules-current.ts`: two
stale-path failures found and fixed (`docs/OPEN-ITEMS.md` items 1/2/2b/19
removed, resolved by this task; `docs/operations/backdated-cost-events-playbook.md`
deleted, it documented operating the machinery just retired), then clean.

**Two deviations from this task's literal text, both driven by discoveries
made while implementing, not decided in advance:**

1. **`lib/backdated-ledger/**`/`lib/backdated-recipe-events/**` were not fully
   retired.** `compute-sale-time-cogs.ts`, both `find-affected-lines.ts`, and
   both `recompute-event.ts` are still imported by six already-executed
   historical `apply-*.ts` scripts this repo's convention keeps forever
   (`scripts/apply-backfill-nnl007-ledger-event.ts` and five others) — deleting
   them would have broken `tsc --noEmit` on dead-but-kept history, the same
   shape of contradiction the challenge round already caught for
   `lib/reorder-suggestion.ts`. Deleted only what nothing else needs:
   `anomaly-threshold.ts` (sole caller was the cron route) and
   `task-3.8-gap-report.ts` (zero callers found), plus their tests. The kept
   files are now unreached by any live path, same status as
   `lib/inventory-consumption.ts`.
2. **`scripts/audit-lock-bypass-history.ts` was deleted, not left alone.** The
   task text said leave it ("dies with what it audits, rather than needing
   separate handling"), but its line 95 (`r.cogs`) is strongly typed against
   `getPnLDataV2`'s real return shape, not `any` — removing the frozen
   `cogs`/`grossProfit`/`marginPct` fields (this task's own next paragraph)
   breaks `tsc --noEmit` there regardless. Its own P&L-consistency check was
   already comparing a frozen 0 against the real issue-based total, which can
   only ever show a false mismatch now, and its first query
   (`audit_baseline_locks`) fails at runtime after this task's migration
   regardless of the type fix. Kept `scripts/verify-pnl-patterns.ts` instead of
   deleting it — its topping-COGS check (now permanently false) was removed,
   but its revenue-per-cup and suspicious-discount checks are unrelated to COGS
   and still work.

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
- Revenue reads, before and after every task, from `getPnLDataV2`, never from a
  hand-rolled sum:

  | Saigon month | Countable orders | Revenue |
  |---|---|---|
  | 2026-04 | 53 | **2.190.000đ** |
  | 2026-05 | 302 | **7.675.000đ** |
  | 2026-06 | 793 | **22.157.000đ** |
  | 2026-07 | 664 | **18.661.000đ** |

  August is open and rises with every sale, so it is measured and reported but
  never compared against a constant. It stood at 130 orders / 3.628.000đ on
  2026-08-07.

  **Widened 2026-08-07, on the owner's question.** Through Task 4 this gate was
  June and July only — the two months carried over from earlier work, chosen for
  no reason connected to the data. April and May carry 355 orders and
  9.865.000đ, and none of it sat inside the gate; with August, roughly a quarter
  of all revenue was outside the net while irreversible deletions ran against it.
  Nothing was harmed — Task 4 touched `order_lines_v2.cost_at_sale` only, and
  revenue reads `orders_v2.status`, `created_at`, and `net_total` — but that is
  an argument from what the code does, and the whole point of a gate is not
  having to rely on one. Task 5 deletes rows; it gets the wider gate.

  A gate query is only trustworthy once it reproduces a figure already known by
  another route. Mirror `findCompletedOrders` exactly (`app/admin/reports/
  actions.ts:51-69`): `status = 'COMPLETED'` and `created_at` inside the Saigon
  range converted to UTC, and **no** `superseded_by` filter — the real loader
  applies none. Adding one looks more correct and is not: it drops July to
  1.521.000đ. Reproducing June and July to the dong is what qualified the April
  and May figures above.
- Purchase orders, sales orders, and recipes byte-identical to their pre-plan
  state.

  **Measured for sales orders 2026-08-07, through Task 4.** `orders_v2` carries
  `trg_orders_v2_touch`, which bumps `updated_at` on every UPDATE, so the table
  keeps its own record of being written to. Rows with `updated_at >= 2026-08-04`
  (Plan C's start) and `created_at < 2026-08-04`: **0**. The 76 rows created
  inside the window are genuine sales. April and May orders still carry
  `updated_at` of 2026-06-28 16:31 — a batch from long before this plan — and
  nothing since.

  This is the check to repeat after Task 5 rather than reasoning about which
  tables a script named. A trigger the table maintains for itself cannot be
  talked out of what it recorded. Note the asymmetry: `order_lines_v2` has **no**
  touch trigger, so the same evidence does not exist there — for lines, the gate
  is the value itself.
- `stock_ledger` holds `PO_RECEIPT` rows only.
- **No rounded or derived money value is persisted anywhere on the new path.**
  Owner directive 2026-08-05, restating the 2026-07-30 rule for the path that
  replaces the old one: rounding belongs to the screen, storage keeps exact
  inputs.

  The design already satisfies this and should stay that way: `stock_issues`
  carries **no money column at all** — only `base_quantity numeric(18,6)` — so
  the running average is never written down, only recomputed from
  `purchase_order_lines.subtotal` (`bigint`, whole dong) and the quantities.
  Nothing derived is stored, so nothing derived can be stored rounded.

  Assert it rather than assume it: after the cutover, no table gains a unit-cost
  or line-value column, and `Math.ceil`/`Math.round` appear on the cost path only
  inside `lib/display-rounding.ts` at the render boundary. `displayMoney` rounds
  cost **up** by owner rule 2026-07-30 — never flatter the business — and that
  direction must survive the cutover.
- **After a count is applied, `closing_quantity` from `computeIssueCosting`
  equals the counted quantity exactly, for every item counted.** This holds by
  construction — the issue written is `theoretical − counted`, so closing is
  `theoretical − (theoretical − counted)`. Assert it anyway: it is the one
  invariant that proves the count, not an estimate, defines what remains, and a
  drift here means an issue was written from something other than the count.

  ```
  VÍ DỤ ĐÃ TÍNH SẴN — con số chủ quán tự đưa ra 2026-08-05:
    Nhập 10 kg × 10.000đ, rồi 10 kg × 12.000đ -> 20 kg / 220.000đ, bq 11.000đ
    Đếm ra 8 kg -> xuất 12 kg, giá vốn 12 × 11.000 = 132.000đ
    Tồn còn lại PHẢI ra: 8 kg / 88.000đ / vẫn 11.000đ mỗi kg
    Tổng phải bảo toàn: 132.000 + 88.000 = 220.000đ
    Ra 96.000đ cho phần tồn -> đang tính FIFO, SAI phương pháp. DỪNG.
  ```

  Extended by the owner 2026-08-05 to cover **a purchase arriving after an
  issue** — a path the two-step example never touches, since it is where closing
  value has to carry forward as opening value:

  ```
  Buoc 4  Nhap them 10 kg × 12.000d
          -> 18 kg | 208.000d | 11.555,56d/kg
          (8 kg cu 88.000d cong 10 kg moi 120.000d, chia 18)
          Binh quan TANG vi gia mua 12.000 cao hon binh quan cu 11.000.
  Buoc 5  Xuat 9 kg -> gia von 104.000d
          -> con 9 kg | 104.000d | van 11.555,56d/kg

  Hai bat bien phai dung o CA HAI buoc:
    - nhap hang LAM DOI binh quan
    - xuat hang KHONG lam doi binh quan
  Binh quan doi sau buoc 5 -> dang tru theo gia khac, SAI. DUNG.
  Buoc 4 ra 11.000d/kg -> ton dau ky khong duoc mang sang, SAI. DUNG.
  ```

  Keep full precision through the chain. 208.000/18 does not terminate, and
  rounding it mid-computation is the defect this project already fixed once on
  2026-07-30.
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
