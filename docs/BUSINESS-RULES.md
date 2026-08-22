# Business Rules

Status: canonical rule index

Last verified: 2026-07-17

## Tóm tắt cho chủ doanh nghiệp

Tài liệu này là cửa vào để biết quy tắc vận hành nào đã được duyệt, quy tắc nào mới chỉ quan sát thấy trong hệ thống và điểm nào còn chờ quyết định. Các công thức kỹ thuật dài vẫn nằm trong tài liệu chuyên sâu; ở đây chỉ ghi nguyên tắc và dẫn đến nguồn chi tiết.

Không được dùng hành vi hiện có trong code để tự tạo một quy tắc kinh doanh mới. Quy tắc mới hoặc thay đổi chính sách cần owner phê duyệt và ghi ngày áp dụng.

## Rule status

| Status | Meaning |
|---|---|
| `APPROVED` | Owner-approved operating policy or reviewed invariant currently in force |
| `OBSERVED` | Current implementation behavior that has not been elevated to owner-approved policy |
| `UNRESOLVED` | A business or operational decision is still required |
| `RETIRED` | Historical rule no longer in force; successor and effective date required |

When a rule changes, preserve the old decision in Git/audit evidence and record the new effective date. Do not silently rewrite production history to make old transactions follow a new rule.

## Authority hierarchy

This document summarizes rules for discovery. Detailed Tier 2 sources remain authoritative within their narrow scope:

- terminology: [`domain-dictionary.md`](domain-dictionary.md);
- valuation/inventory design: [`superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`](superpowers/specs/2026-06-25-mac-cogs-inventory-design.md);
- reviewed MAC baseline: [`audits/2026-07-09-mac-drift-baseline-audit.md`](audits/2026-07-09-mac-drift-baseline-audit.md);
- BTP replay-drift policy: [`audits/2026-07-16-btp-recipe-replay-drift-policy.md`](audits/2026-07-16-btp-recipe-replay-drift-policy.md);
- backup/retention policy: [`audits/2026-07-16-drive-backup-policy.md`](audits/2026-07-16-drive-backup-policy.md);
- backup operation: [`operations/apps-script-drive-backup.md`](operations/apps-script-drive-backup.md).

If a summary here conflicts with a reviewed Tier 2 policy, stop and resolve the contradiction rather than choosing whichever result is convenient.

## Sales and order rules

### BR-SALE-001 — Historical sale economics are pinned

**Status:** `RETIRED`, effective 2026-08-07 — successor `BR-COGS-005`

Order lines store the cost used at sale time in `cost_at_sale`. Historical reporting must use the pinned value rather than silently replacing it with a later recipe or purchase-cost replay.

Superseded by `BR-COGS-005` (owner decision 2026-08-04). Plan C Task 4 applied the cutover on 2026-08-07 (`docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md`): `order_lines_v2.cost_at_sale` reset to `0` for every row, 2.590 lines. There is no longer a pinned value for this rule to protect.

### BR-SALE-002 — Transaction snapshots preserve write-time inputs

**Status:** `APPROVED`

Orders and lines preserve the relevant price, promotion, recipe, modifier, and cost snapshots required by the reviewed flow. Later catalog edits must not rewrite the meaning of an already completed transaction without an explicit historical-recovery plan.

### BR-SALE-003 — Order lifecycle changes require traceability

**Status:** `APPROVED`

Void, edit, and supersede flows must preserve an explainable event/history path and the associated inventory effect. A UI status change without corresponding transaction evidence is not sufficient.

### BR-SALE-004 — Exact operational eligibility filters are implementation contracts

**Status:** `OBSERVED`

Reports and audits apply status/supersede filters to decide which orders count. Pre-Audit C and later report audits must document those filters per capability before they are promoted into owner-facing policy.

### BR-SALE-005 — Revenue before 2026-07-19 is permanently unverifiable, not verified

**Status:** `APPROVED` — owner decision 2026-08-14 (Plan H, `docs/superpowers/plans/2026-08-14-revenue-audit.md` §2).

The system records payments in `order_payments`, and **that table begins 2026-07-19**. Before that date no independent record of money received exists: the feature did not exist. Revenue for that period can only ever be checked against itself.

**What was checked, and passed, across all completed orders:** `net_total` equals `gross_total` minus promotions, item discounts and order discount, with zero mismatches; `net_total` equals the sum of its own order lines, with zero mismatches; no counted order is also a superseded version of another. From 2026-07-19 onward, revenue and recorded payments agree exactly — **13.603.000đ on both sides across 513 orders, difference 0đ** at the time of the audit.

**What that leaves.** **44.229.000đ across 1.573 orders, April to mid-July 2026, has nothing to reconcile against.** Asked on 2026-08-14 whether external records — bank statements, a cash book — could close the gap, the owner confirmed **none exist**.

**So the figure is closed as unverifiable, and must never be quietly upgraded to "audited" later.** It is internally consistent at every level that can be tested, and it has never been compared to money that actually arrived. Any statement about the shop's first four months rests on that distinction. A later report that presents the period without the caveat is wrong even if every number in it is unchanged.

**Why this is a rule and not a note.** Cost was audited line by line in Plan C and found 7,4% wrong (`BR-COGS-006`) — an error invisible until someone checked against what was paid. The same class of error in early revenue would be invisible **permanently**, because the thing to check against was never written down. The rule exists so nobody re-derives false confidence from the internal checks passing.

**Verification is re-runnable:** `scripts/verify-revenue.ts` re-checks every structural claim above and prints the unbacked figure on each run. It is the audit, not a record of one.

## COGS and reporting rules

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

Supersedes `BR-SALE-001` and `BR-COGS-002`, both `RETIRED` effective 2026-08-07 — the cutover described in `docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md` (Task 4) applied that day.

### BR-COGS-003 — Rounding and allocation must reconcile

**Status:** `APPROVED`

Line/order allocations, discounts, COGS, and report totals must reconcile at the stored currency precision. Relevant audits must report both count and signed monetary delta.

### BR-COGS-004 — Historical drift is classified before action

**Status:** `APPROVED`

Audit output distinguishes locked matches, stored-value violations, informational replay shifts, known-not-locked items, and new investigation needs. Replay drift alone does not authorize recomputation.

## Inventory, purchasing, and production rules

### BR-INV-001 — Quantity movement belongs in the stock ledger

**Status:** `APPROVED`

Purchase receipts, sale consumption, adjustments, production input, production yield, and reversals must be explainable through `stock_ledger` records and their business references.

### BR-INV-002 — Critical multi-row writes are atomic

**Status:** `APPROVED`

Purchase orders, reviewed recoveries, and other critical flows that change multiple dependent rows must use an atomic transaction/RPC path or a reviewed equivalent. A partial success is not an acceptable business result.

### BR-INV-003 — BTP consumption follows reviewed recipe/yield evidence

**Status:** `RETIRED`, effective 2026-08-07 — successor `BR-INV-006`

Semi-product production and consumption must retain the recipe/yield evidence needed to explain sale-time COGS. Later recipe replay can differ from the pinned transaction without authorizing historical mutation.

Superseded by `BR-INV-006` (owner decision 2026-08-05). Plan C Task 5 applied the cutover on 2026-08-07 (`docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md`): every `PRODUCTION_CONSUME`/`PRODUCTION_YIELD` `stock_ledger` row deleted, semi-product balances fell to `0`. Measured: of 16 active semi-products, 11 carry an `inventory_balances` row and every one reads exactly `0.000000`; the other 5 never had `stock_ledger` activity, so no row exists for them either — also zero by absence. There is no recipe/yield evidence left for this rule to protect — semi-products carry no stock to explain.

### BR-INV-006 — Semi-products carry no stock and no value

**Status:** `APPROVED` — owner decision 2026-08-05

Semi-products are things the shop makes rather than buys — syrups, brewed tea, boiled sweet potato. They are no longer tracked as stock, hold no value, and no screen records making a batch. Their recipes stay, as the record of how something is made.

**Why the cost does not vanish with the tracking.** The ingredients were already expensed the moment they left stock. A pot of brewed tea is not a new asset; it is goods already paid for, in a different shape. Recording it as stock with a value of its own would count the same money twice.

**Why this reverses the 2026-07-31 decision to keep semi-product stock.** That decision served the inference chain this design removes, and the arithmetic ends it regardless. Measured 2026-08-05: 16 active semi-products hold 3.919 `stock_ledger` rows, and **every one of them is a transaction type the cutover deletes** — `PRODUCTION_YIELD` in, `SALES_CONSUME` out. None is a purchase receipt, because a semi-product is never purchased.

Raw ingredients survive deletion because purchases remain underneath them: stock reads as everything ever bought, inflated but real, and the first count corrects it. Semi-products have no such floor. They fall to zero with nothing able to add to them, and a count could not value them either, since they have no purchase price to draw on.

The owner was shown both directions before deciding — Sữa tươi rising from 50.750 g to 134.450 g against semi-products falling from 40.550 to 0 — and chose to drop the tracking rather than rebuild a mechanism for it.

Supersedes `BR-INV-003`, effective on the cutover in `docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md`.

### BR-INV-004 — Negative stock is investigated, not silently fabricated away

**Status:** `APPROVED`

Negative-stock findings require physical/business evidence and an approved correction path. Unresolved negative stock remains visible in audit/roadmap records.

### BR-INV-005 — A count above everything ever purchased is refused, never valued

**Status:** `APPROVED` — owner decision 2026-08-04

Counting happens per purchased item. A count below expectation needs no rule: goods taken by mistake, or taken in excess, leave that item short and are valued correctly without anyone declaring intent.

A count that exceeds the item's total ever purchased is different in kind. No handling error creates physical goods; either the purchase was recorded against another item code, or the stock predates the system. That line is refused and the surplus is left unvalued — a price assigned to goods with no purchase behind them is a guess that enters the cost figure permanently.

The refusal presents every other purchased item sharing the same base ingredient, with each one's purchased total and counted quantity, because a mis-recorded purchase almost always lands on a sibling brand. The refusal is scoped to the single line; the rest of the session saves.

Applies from the issue-based COGS path (`docs/superpowers/plans/2026-08-04-cogs-plan-b-parallel-path.md`).

## Backdated transaction rules

### BR-BACKDATE-001 — Creation time and effective time are distinct

**Status:** `APPROVED`

A purchase, stock adjustment, or production event created later with an earlier effective time is a backdated event. Detection must preserve both timestamps and the affected historical window.

### BR-BACKDATE-002 — Backdated impact requires review

**Status:** `APPROVED`

Detected events follow the reviewed backdated-ledger path. The system must not silently recompute pinned historical sales merely because a new ledger row becomes visible in replay.

### BR-BACKDATE-003 — Historical gaps remain evidence

**Status:** `APPROVED`

Known historical gaps may be locked/classified without changing `cost_at_sale`. Operator review and any future recompute decision remain separate actions.

## Audit, recovery, and production-write rules

### BR-DATA-001 — No silent production writes

**Status:** `APPROVED`

Inspection and audit are read-only by default. Any tool capable of writing must require an explicit apply mode and print the exact target/count/payload before execution.

### BR-DATA-002 — Historical recovery requires immutable inputs

**Status:** `APPROVED`

A historical recovery requires owner approval, frozen source/payload hash, dry-run output, atomic apply, post-apply cohort checks, and rollback-ready evidence.

### BR-DATA-003 — Audit locks protect reviewed history

**Status:** `APPROVED`

Rows protected by `audit_baseline_locks` reject ordinary mutation. Any escape path must be narrow, transaction-local, reviewed, and recorded.

### BR-DATA-004 — Failure means stop and assess

**Status:** `APPROVED`

If a post-apply invariant fails, stop further writes and compare against the approved cohort before deciding whether rollback is necessary. A broad live audit that changes population is not by itself proof that the approved cohort failed.

## Backup and retention rules

### BR-BACKUP-001 — Scheduled backups are full snapshots

**Status:** `APPROVED`

The Drive backup is a full schema-versioned snapshot of the approved table allowlist, not only the day's new rows.

### BR-BACKUP-002 — Daily and monthly retention are separate

**Status:** `APPROVED`

Keep 180 rolling daily snapshots. Keep one idempotent full snapshot for each month indefinitely. Daily and monthly files live in separate Drive child folders.

### BR-BACKUP-003 — Completeness is validated before retention

**Status:** `APPROVED`

Apps Script validates the response, schema version, and expected table keys before writing/retaining the file. A response file that fails the contract is not a successful backup.

### BR-BACKUP-004 — Storage migration uses capacity/reliability triggers

**Status:** `APPROVED`

Begin migration planning when the serialized bundle reaches the warning threshold in the backup policy (currently 20 MB), and move the production destination by 25 MB or earlier if runtime/reliability limits are reached.

### BR-BACKUP-005 — Restore requires separate approval

**Status:** `APPROVED`

Backup success does not authorize restoration. A restore needs a reviewed mapping, target environment, dry-run/validation, and explicit production approval.

## Access and security rules

### BR-ACCESS-001 — Intended roles do not prove enforcement

**Status:** `APPROVED`

Business roles and intended permissions are documented in [`ACCESS-MODEL.md`](ACCESS-MODEL.md). Only a security review can label a path verified; a menu item or route guard alone is insufficient.

### BR-ACCESS-002 — Secrets and password hashes stay server-side

**Status:** `APPROVED`

Credentials, service keys, backup tokens, and password hashes must not be serialized to the browser or recorded in documentation/logs. SEC-1 tracks the known admin user-payload gap.

### BR-INV-007 — Count sealed packages only; cost is recognised when a package is opened

**Status:** `APPROVED` — owner decision 2026-08-07. **Not yet implemented** — Plan D (`docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md`) builds it. Recorded here on decision, per `CLAUDE.md` section 6, not on delivery.

A stocktake counts only packages that are still sealed. An opened package is not counted and not estimated. The owner's own example: the 100 g bag of `Dâu sấy` is finished, the 500 g bag is open and in use, the 1 kg bag is sealed — only the 1 kg line gets a number.

**This is an accounting policy, not a data-entry convenience.** Cost is recognised at the moment a package is opened rather than as its contents are consumed. Consequences, all intended:

- The stock figure means **sealed stock**, and understates what is physically present by whatever sits in open packages.
- Cost runs ahead of true consumption by at most one open package per item.
- The error is **bounded and does not accumulate**: each package is expensed exactly once, at the first count where it is no longer sealed.

**Why this beats a more precise rule.** It removes all weighing and estimating. A rule the owner can follow at the shelf is worth more than a more accurate one he cannot.

**Counting is by package, not by unit name.** Measured 2026-08-07: 48 purchased items have one purchase unit, 3 have two, 1 has three — and two items carry the dangerous shape where the same unit name means different sizes. `Dâu sấy` has three `ACTIVE` conversions all named **Túi** (100 g, 500 g, 1.000 g), all used in real purchases, so "how many Túi?" has three answers differing by ten times. Each package size is therefore its own count line, labelled with the size derived from `conversion_rate` — no master data is renamed.

**Worked example, real figures.** `Dâu sấy` (`ING-028`): 4.100 g bought for 2.443.600đ, a weighted average of exactly **596 đ/g**. Counting one sealed 1 kg bag gives 1.000 g on hand, an issue of **3.100 g** costing **1.847.600đ**, and remaining stock worth **596.000đ** — which reconciles against the 2.443.600đ paid.

**Observed 2026-08-10, first real count: some items will read 0 for ever, and that is the rule working.** `Nước đường Glofood` counted 0 against a theoretical 50 kg. The owner explained why, and it is not an error: syrup is measured by the can, a can is finished once opened, and at current volume a can is opened as soon as it arrives. There will essentially never be a sealed can, so this item costs out as everything bought in the period.

This is the edge Sonnet named while reviewing `BR-INV-007`: an item that always has exactly one open package can never show sealed stock, so each period expenses that period's purchases in full. For such items the rule collapses into expense-on-receipt, which is the honest treatment when the shop genuinely cannot say how much is left. **Expect a permanent 0 on the stock screen for them, and do not read it as a missed count.**

### BR-INV-008 — Counting more than expected is recorded as goods found, not refused

**Status:** `APPROVED` — owner decision 2026-08-07. **Implemented 2026-08-08** (Plan D D5b, `0056_found_stock.sql`): the `stock_issues.base_quantity` constraint now accepts a negative value (the `NaN` guard kept alongside it), `save_stocktake_line_atomic` no longer refuses the found-stock range, and the negative issue row carries a Vietnamese note explaining itself. Verified live against real `Dâu sấy` data inside a rolled-back transaction — nothing persisted; see the plan's D5b entry for the five checks. No screen writes this yet — that is Plan D D7.

When a count exceeds the theoretical quantity but stays within everything ever purchased, the system accepts it and records **hàng tìm lại được**: the quantity returns to stock at the weighted average it left at, which leaves the average unchanged and closes the discrepancy permanently.

**What the case really is.** Under `BR-INV-007` the usual cause is a sealed package missed at an earlier count, expensed then, and found now. Goods thought consumed have reappeared. Concretely: a 1 kg bag of `Dâu sấy` worth 596.000đ.

**Why the first proposal was withdrawn.** It was to correct the ingredient quantity and record no issue at all. Sonnet's challenge showed that a purchased item's theoretical quantity is recomputed every time as `purchase_order_lines − stock_issues` and never reads `stock_ledger`, so correcting the ingredient closes nothing: the same discrepancy would reappear **at every future count, for ever**. It had been described to the owner as a one-off note; it would have been a prompt that never stopped. The costing stayed correct throughout — no event reached the replay — but the description was wrong, and the owner was told so before deciding.

**Implementation consequence to face rather than defend.** `stock_issues.base_quantity` carries `check (base_quantity > 0)` (`0052_stock_issues.sql`). This rule requires that to accept a negative value. The earlier position — "a negative issue is a different event wearing the wrong name" — reads well but leaves the loop open, and was set aside for that reason.

**Reporting impact — say this before the owner finds it himself.** A found event reduces the *current* period's cost, not the past period where the over-issue originally happened. That is correct accounting (a prior-period correction lands in the period it is discovered), but it means a month with a large found event will show unusually low COGS. Flagged here in advance so a low figure reads as this rule working, not as a data error to investigate.

**Edge settled 2026-08-07:** a found event when the on-hand quantity is zero has no live average to draw on (`value/quantity` is `0/0`). Resolved as the **last unit cost the item left at** (the rate of the issue that emptied the pool), not a lifetime average of all purchases — that is the exact inverse of the depleting issue and the only choice that leaves the weighted average unchanged. A found event with no purchase ever recorded still refuses; a lot that never existed cannot be found. Implemented in `lib/issue-costing.ts` (`computeIssueCosting`), Plan D K6, 5 tests.

### BR-INV-009 — Reversing a mistaken issue slip lands today, at today's average, using BR-INV-008's mechanism

**Status:** `APPROVED` — owner decision 2026-08-08 (`259103e`, Plan D §5 I7 in full). **Implemented** (Plan D D7b, `0058_reverse_manual_issue.sql`, `reverse_manual_issue_atomic`), extended 2026-08-09 by D14 (below).

A manual issue slip entered by mistake is never deleted and never edited. It is marked reversed and answered with a compensating entry: quantity `-`original, dated **today**, valued at **today's running average** — not the rate that was in effect at the moment of the mistake, and not backdated to that moment. Both rows stay visible and linked.

**Why today, not the original moment — this was the open question, and it was already decided once.** `BR-INV-008` puts goods found during a count back in the period they are *found*, not the period the shortfall happened in, and the owner accepted that shape knowingly. A mistaken slip is the same kind of event — quantity recorded as having left that never actually left — so it is corrected the same way. Two more reasons: Plan C spent a week removing the machinery that silently rewrote closed periods (`docs/superpowers/plans/2026-08-05-cogs-plan-c-cutover.md` Task 6), and reversing at the original moment would rebuild that by hand; and the replay in `lib/issue-costing.ts` is chronological, so an event inserted into the past would revalue the running average for every issue after it, not just the one being corrected.

**Mechanically, a reversal *is* a `BR-INV-008` found-stock event** — same code path, same sign (negative `base_quantity`), same live-average valuation — carrying a link to the slip it reverses and a note naming it. No second mechanism is built for this.

**What is conserved, and what is not.** Money is structurally conserved at any valuation rate: a reversal adds *v* to stock value and removes the same *v* from recognised cost, so `total paid = stock value + net cost recognised` holds regardless of which rate is used. Using **today's live average** additionally leaves the average itself unchanged — the specific invariant `BR-INV-008` exists to protect — which the original moment's rate would not have (it would restore the money correctly but move the average).

**What the owner gives up, stated plainly, the same price already accepted for found goods:** the month the mistake happened in keeps its wrong figure forever. The correction shows up in the month it is caught, not the month the mistake was made.

**Extended 2026-08-09 (Plan D D14) to two whole-event forms of the same mechanism, not a new valuation rule:**

- **Undoing a whole confirmed stocktake session.** Owner reason: *"không có gì chắc chắn nhân viên đúng 100% cả. Nếu sai thì phải hủy phiếu cũ tạo phiếu mới chứ."* Compensating rows only (one per `stock_issues` line the session wrote, one per `stock_ledger` ingredient correction it wrote), same today's-average valuation, original rows never touched. **Owner-only** — `requireOwner()` (`lib/auth.ts`), stricter than every other action in the system, because a stocktake checks the person counting and the person being checked cannot be the one who can erase the check. Only the most recently confirmed session may be reversed, refused while any session is `OPEN`, a reason is required. The session gets a new status, `REVERSED` — never `CANCELLED`, which already means "abandoned before apply" and is what `cancel_stocktake_session_atomic` (D12) deletes when blank.
- **Cancelling a whole issue slip**, beside the existing per-line reversal — settles I11 (`docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md` §5 I11). Reverses every not-yet-reversed line of a slip in one call, one reason. Same `requireAdmin()` level as the existing per-line reversal, deliberately not raised to owner-only — an issue slip records waste or internal use, not a check on the person who counted.

Implemented `supabase/migrations/0062_reverse_confirmed_stocktake_and_issue_slip.sql`; full case list in the plan's §5 "Undoing a confirmed count or a whole issue slip" (U1-U13).

### BR-COGS-007 — Cost of sales, direct materials and shrinkage are three separate lines, and shrinkage has a precondition

**Status:** `APPROVED` — owner decision 2026-08-19 (Plan J, `docs/superpowers/plans/2026-08-17-expenses-and-pnl.md`).

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

### BR-CATALOG-001 — A catalogue name is unique among live rows; a near-match warns instead of refusing

**Status:** `APPROVED` — owner decision 2026-08-19 (Plan J batch 1, `docs/superpowers/plans/2026-08-19-batch-1-foundations.md` section A).

Seven catalogue tables (`purchased_items`, `base_ingredients`, `semi_products`, `products`, `item_categories`, `units`, `suppliers`) each enforce their own name uniqueness, scoped **within the table only, never across tables** — a purchased item and the ingredient it becomes legitimately share a name (e.g. `SPM-005`/`ING-001`, both "Đá viên"). Uniqueness is scoped to `ACTIVE` rows: retiring a row (mark-inactive, never delete — `CLAUDE.md` section 2) makes its name reusable.

**Two levels, found by asking what stripping diacritics actually costs, not by principle.** The owner asked for "Ca phe" to be caught as a duplicate of "Cà phê." Stripping diacritics does that — and also collapses "Dứa" and "Dừa" (pineapple vs coconut) into one word; this catalogue already holds "Thạch dừa" (`NNL-009`), so a blanket strip would one day refuse "Thạch dứa" on a drinks menu with no way to say "that is a real, different item."

| Level | Trigger | Behaviour |
|---|---|---|
| **1 — refuse** | Name matches an existing live row after normalising (non-breaking space → space, Unicode NFC, trim, whitespace collapse, case-fold — diacritics **not** stripped) | Blocked outright, both as a database partial unique expression index (unbypassable) and an application check naming the row |
| **2 — warn** | Only the **diacritic-stripped** forms match | Shown the existing row, asked *"đây có phải là một mặt hàng khác không?"*, proceeds only on confirmation |

**Level 2 lives in the application only** — it needs a human answer, so it cannot be an index. The confirmation is recorded as a field (`duplicate_warning_confirmed`, `_by`, `_at`), not a note — same reasoning as `Không nhớ` (Plan J section 9.3): "which items were created despite a warning" has to be answerable by a query.

**đ/Đ (U+0111/U+0110) do not decompose under NFD**, unlike ordinary Vietnamese diacritics — verified directly (`đ.normalize("NFD")` stays one codepoint; `á` splits into `a` + a combining acute). The diacritic strip replaces `đ`/`Đ` explicitly before the NFD step; missing this would make "Da vien" silently fail to warn against "Đá viên."

**Level 2 is wired into five of the seven tables**: `base_ingredients` (`0066_duplicate_name_warning_confirmation.sql`), plus `purchased_items`, `semi_products`, `products`, `suppliers` (Batch 1 follow-up, 2026-08-20, `0067_duplicate_name_warning_confirmation_more_tables.sql`). The level-2 comparison logic (`findDiacriticStrippedMatch`, `lib/duplicate-name-guard.ts`) is table-agnostic; each of these five tables carries its own `duplicate_warning_confirmed`/`_by`/`_at` columns.

**`units` and `item_categories` carry level 1 only, deliberately.** Neither accumulates its own stock or purchase history — they are labels referenced by other rows, not things bought, counted, or sold, so a near-duplicate there is cosmetic dropdown confusion, not the split-ledger harm level 2 exists to catch. Both populations are also small and do not grow under shelf-pressure (`item_categories` has held exactly 3 rows since 2026-06-28; a new unit is a rare, deliberate, admin-time event). Level 1 already covers the only collision risk either table has ever actually produced.

### BR-COGS-008 — Equipment is depreciated straight-line, banded by its own unit price, frozen at purchase

**Status:** `APPROVED` — owner decisions 2026-08-19/22 (`docs/superpowers/plans/2026-08-17-expenses-and-pnl.md` §8, `docs/superpowers/plans/2026-08-22-batch-3-asset-register.md`).

**No minimum threshold.** *"cái nào cứ cầm nắm để sử dụng được thì đều phải có tính khấu hao"* — everything purchased under an `EQUIPMENT` category is depreciated; there is no expense-it-outright tier.

**Term bands are chosen by unit price, not line total** (owner 2026-08-22: *"Anh cũng nghiêng về giá một cái"*) — eight identical pumps bought on one line at 95.150đ each are eight small 12-month assets, not one 761.200đ 36-month asset. Bands live in `asset_depreciation_bands` (editable in a screen, `/admin/inventory/asset-bands` — `CLAUDE.md` §8's rule that a flexible thing without a screen is a hardcoded thing wearing a table), seeded at under 200k → 12 months, 200k–500k → 24, above 500k → 36 (Vietnamese CCDC practice caps allocation at 36 months).

**The term is frozen at the moment an asset is created, never re-derived.** *"anh chỉ thay đổi luật chứ không đồng nghĩa luật đó phải áp dụng lại cho tất cả những gì đã được áp dụng trước đó."* Editing a band's term or boundaries affects only assets created after the edit; `assets.term_months` is a stored value, not a live lookup.

**The register answers "what does the shop own," not "what still has value."** An asset whose term has ended stays listed at 0đ; only marking it broken or disposed (`asset_disposals`, insert-only, never a delete or a downward mutation of `assets.quantity`) removes it from what is owned, charging whatever value remained to that month.

**One row per purchase line, not per physical unit.** Eight pumps bought together share a price, a date and a term; partial disposal is handled by `quantity` on the asset minus the sum of its disposals, not by giving each physical unit its own identity. `lib/asset-depreciation.ts`'s schedule builder settles each disposal's own cohort of units exactly (the remaining undepreciated value of exactly the disposed units, computed from first principles each time), so the schedule sums to cost exactly regardless of how many separate disposals one asset accumulates.

**Purchasing an equipment item creates the asset automatically.** Completing a NEW purchase order with an `EQUIPMENT`-category line inserts the corresponding `assets` row, `unit_cost` taken from the same `allocatePurchaseOrderCost` allocation the COGS report uses (BR-COGS-006) — never recomputed independently. **Known limitation:** editing an already-completed purchase order does not touch any asset it already created; what should happen there is unaddressed by the plan and left for a future decision rather than guessed at.

**Not yet consumed anywhere.** The monthly charge this rule computes feeds no P&L line yet — that is batch 4/5's job. This rule governs the register and the schedule only.

## Unresolved items

| ID | Status | Decision needed | Current safe statement |
|---|---|---|---|
| `BR-U-001` | `UNRESOLVED` | Offline POS design and acceptance criteria | Offline ordering is not a verified live capability |
| `BR-U-002` | `UNRESOLVED` | Multi-brand/outlet/franchise data and access model | Current operating scope is one brand/one shop |
| `BR-U-003` | `UNRESOLVED` | Final business-role permission matrix | Use intended/observed/verified labels; Phase 3 will audit enforcement |
| `BR-U-004` | `UNRESOLVED` | Restore drill frequency and approved restore target | Backups are recovery inputs, not proof of recoverability |
| `BR-U-005` | `UNRESOLVED` | Physical corrections for known negative-stock items | Do not fabricate or silently rewrite balances |

## Change procedure

1. Identify the rule ID and current source/evidence.
2. State the business impact and effective date.
3. Obtain owner approval for policy changes.
4. Update the relevant Tier 2 source if technical detail changes.
5. Update implementation/tests in a separately reviewed task.
6. Preserve historical evidence and record the result in tracking/completed documents.

Update this index when a rule is approved, retired, contradicted by verified implementation, or moved to a different Tier 2 authority.
