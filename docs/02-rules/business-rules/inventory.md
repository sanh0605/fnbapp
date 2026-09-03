# Inventory, purchasing, and production rules

### BR-INV-001 — Quantity movement belongs in the stock ledger

**Status:** `RETIRED`, effective 2026-09-02 — successor `BR-COGS-005`

Purchase receipts, sale consumption, adjustments, production input, production yield, and reversals must be explainable through `stock_ledger` records and their business references.

Superseded by `BR-COGS-005` (owner decision 2026-08-04, cutover 2026-08-07) in practice well before this retirement was recorded: once cost moved to the issue-based figure, no report or screen read `stock_ledger` for money, and by 2026-09-01 nothing wrote to it either — the table sat frozen, explaining nothing new. Phase D (owner-approved 2026-08-28/2026-09-02) drops `stock_ledger` and `inventory_balances` outright, along with their trigger and trigger function — **migration written, not yet applied** as of this entry. Quantity movement for cost purposes now runs on exactly one path: `stock_issues` (`BR-COGS-005`). This rule is retired regardless of whether the drop has run yet, since the table already explains nothing live either way.

### BR-INV-002 — Critical multi-row writes are atomic

**Status:** `APPROVED`

Purchase orders, reviewed recoveries, and other critical flows that change multiple dependent rows must use an atomic transaction/RPC path or a reviewed equivalent. A partial success is not an acceptable business result.

### BR-INV-003 — BTP consumption follows reviewed recipe/yield evidence

**Status:** `RETIRED`, effective 2026-08-07 — successor `BR-INV-006`

Semi-product production and consumption must retain the recipe/yield evidence needed to explain sale-time COGS. Later recipe replay can differ from the pinned transaction without authorizing historical mutation.

Superseded by `BR-INV-006` (owner decision 2026-08-05). Plan C Task 5 applied the cutover on 2026-08-07: every `PRODUCTION_CONSUME`/`PRODUCTION_YIELD` `stock_ledger` row deleted, semi-product balances fell to `0`. Measured: of 16 active semi-products, 11 carry an `inventory_balances` row and every one reads exactly `0.000000`; the other 5 never had `stock_ledger` activity, so no row exists for them either — also zero by absence. There is no recipe/yield evidence left for this rule to protect — semi-products carry no stock to explain.

### BR-INV-006 — Semi-products carry no stock and no value

**Status:** `APPROVED` — owner decision 2026-08-05

Semi-products are things the shop makes rather than buys — syrups, brewed tea, boiled sweet potato. They are no longer tracked as stock, hold no value, and no screen records making a batch. Their recipes stay, as the record of how something is made.

**Why the cost does not vanish with the tracking.** The ingredients were already expensed the moment they left stock. A pot of brewed tea is not a new asset; it is goods already paid for, in a different shape. Recording it as stock with a value of its own would count the same money twice.

**Why this reverses the 2026-07-31 decision to keep semi-product stock.** That decision served the inference chain this design removes, and the arithmetic ends it regardless. Measured 2026-08-05: 16 active semi-products hold 3.919 `stock_ledger` rows, and **every one of them is a transaction type the cutover deletes** — `PRODUCTION_YIELD` in, `SALES_CONSUME` out. None is a purchase receipt, because a semi-product is never purchased.

Raw ingredients survive deletion because purchases remain underneath them: stock reads as everything ever bought, inflated but real, and the first count corrects it. Semi-products have no such floor. They fall to zero with nothing able to add to them, and a count could not value them either, since they have no purchase price to draw on.

The owner was shown both directions before deciding — Sữa tươi rising from 50.750 g to 134.450 g against semi-products falling from 40.550 to 0 — and chose to drop the tracking rather than rebuild a mechanism for it.

Supersedes `BR-INV-003`, effective on the Plan C cutover.

### BR-INV-004 — Negative stock is investigated, not silently fabricated away

**Status:** `APPROVED`

Negative-stock findings require physical/business evidence and an approved correction path. Unresolved negative stock remains visible in audit/roadmap records.

### BR-INV-005 — A count above everything ever purchased is refused, never valued

**Status:** `APPROVED` — owner decision 2026-08-04

Counting happens per purchased item. A count below expectation needs no rule: goods taken by mistake, or taken in excess, leave that item short and are valued correctly without anyone declaring intent.

A count that exceeds the item's total ever purchased is different in kind. No handling error creates physical goods; either the purchase was recorded against another item code, or the stock predates the system. That line is refused and the surplus is left unvalued — a price assigned to goods with no purchase behind them is a guess that enters the cost figure permanently.

The refusal presents every other purchased item sharing the same base ingredient, with each one's purchased total and counted quantity, because a mis-recorded purchase almost always lands on a sibling brand. The refusal is scoped to the single line; the rest of the session saves.

Applies from the issue-based COGS path (Plan B, parallel path).

### BR-INV-007 — Count sealed packages only; cost is recognised when a package is opened

**Status:** `APPROVED` — owner decision 2026-08-07. **Not yet implemented** — Plan D builds it. Recorded here on decision, per `CLAUDE.md` section 6, not on delivery.

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

**Why today, not the original moment — this was the open question, and it was already decided once.** `BR-INV-008` puts goods found during a count back in the period they are *found*, not the period the shortfall happened in, and the owner accepted that shape knowingly. A mistaken slip is the same kind of event — quantity recorded as having left that never actually left — so it is corrected the same way. Two more reasons: Plan C spent a week removing the machinery that silently rewrote closed periods (Plan C, Task 6), and reversing at the original moment would rebuild that by hand; and the replay in `lib/issue-costing.ts` is chronological, so an event inserted into the past would revalue the running average for every issue after it, not just the one being corrected.

**Mechanically, a reversal *is* a `BR-INV-008` found-stock event** — same code path, same sign (negative `base_quantity`), same live-average valuation — carrying a link to the slip it reverses and a note naming it. No second mechanism is built for this.

**What is conserved, and what is not.** Money is structurally conserved at any valuation rate: a reversal adds *v* to stock value and removes the same *v* from recognised cost, so `total paid = stock value + net cost recognised` holds regardless of which rate is used. Using **today's live average** additionally leaves the average itself unchanged — the specific invariant `BR-INV-008` exists to protect — which the original moment's rate would not have (it would restore the money correctly but move the average).

**What the owner gives up, stated plainly, the same price already accepted for found goods:** the month the mistake happened in keeps its wrong figure forever. The correction shows up in the month it is caught, not the month the mistake was made.

**Extended 2026-08-09 (Plan D D14) to two whole-event forms of the same mechanism, not a new valuation rule:**

- **Undoing a whole confirmed stocktake session.** Owner reason: *"không có gì chắc chắn nhân viên đúng 100% cả. Nếu sai thì phải hủy phiếu cũ tạo phiếu mới chứ."* Compensating rows only (one per `stock_issues` line the session wrote, one per `stock_ledger` ingredient correction it wrote), same today's-average valuation, original rows never touched. **Owner-only** — `requireOwner()` (`lib/auth.ts`), stricter than every other action in the system, because a stocktake checks the person counting and the person being checked cannot be the one who can erase the check. Only the most recently confirmed session may be reversed, refused while any session is `OPEN`, a reason is required. The session gets a new status, `REVERSED` — never `CANCELLED`, which already means "abandoned before apply" and is what `cancel_stocktake_session_atomic` (D12) deletes when blank.
- **Cancelling a whole issue slip**, beside the existing per-line reversal — settles I11 (Plan D §5 I11). Reverses every not-yet-reversed line of a slip in one call, one reason. Same `requireAdmin()` level as the existing per-line reversal, deliberately not raised to owner-only — an issue slip records waste or internal use, not a check on the person who counted.

Implemented `supabase/migrations/0062_reverse_confirmed_stocktake_and_issue_slip.sql`; full case list in the plan's §5 "Undoing a confirmed count or a whole issue slip" (U1-U13).

