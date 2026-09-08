# `verify-cogs` — the check CLAUDE.md has been demanding for a script that does not exist

> **For agentic workers:** REQUIRED SUB-SKILLS: `superpowers:executing-plans`, `superpowers:test-driven-development`. Challenge the plan first. The script is **read-only** — it must have no `--apply`, no write path, and no way to acquire one. No push, no deploy, no migration.

**Goal:** give cost of goods the same standing check revenue already has.
`CLAUDE.md` says *"Việc đụng giá vốn hoặc tồn kho: chạy thêm script `verify-*`
tương ứng, yêu cầu 0 sai lệch"*, and `lib/costing/CLAUDE.md` records the gap in
its own words — *"Chưa có script `verify-*` cho giá vốn (đo 2026-09-07)"*. This
closes it.

**Why it matters more than the wording suggests:** cost was once 7,4% wrong
(`BR-COGS-006`) and nobody saw it until the owner refused a figure he knew was
too big. Revenue has `scripts/verify-revenue.ts`; cost has only unit tests. The
next step on the roadmap is financial reporting, and a profit-and-loss statement
reads cost.

**Owner decision 2026-09-07**, asked with the three candidate meanings of "0
lệch" in front of him: two automatic checks are hard gates, and the stock
difference is **reported, not failed** — *"Máy tự kiểm, cộng thêm báo hao hụt."*
That follows his own earlier rule: shrinkage is a separate line, because
*"nếu ghi vào giá vốn thì sẽ không biết thất thoát thực tế"* (`BR-COGS-007`).

## Current state (five numbered questions)

Measured 2026-09-07 against production.

1. **States.** The script exits green or red. Red only on the two hard gates.
   The shrinkage figure never turns it red — it is printed.
2. **Buttons.** Not applicable — no screen changes.
3. **Lists.** Reads `purchase_orders` (164), `purchase_order_lines` (310),
   `stock_issues` (139), `stocktake_sessions` (2), `stocktake_lines` (119),
   `purchased_items` (148). Writes nothing. Equipment issues are excluded the way
   `filterOutEquipmentIssues` already excludes them — say so in the output rather
   than silently dropping rows.
4. **Inputs.** No arguments needed. An optional period narrows the report; with
   none, the whole history.
5. **Data.** Read-only against production. No `--apply`, no write, no migration.

Seen: `docs/02-rules/business-rules/cogs.md` (`BR-COGS-003`, `005`, `006`, `007`),
`lib/costing/` and its `CLAUDE.md`, `scripts/verify-revenue.ts` as the shape to
follow, the six tables above and their columns. Not seen: the body of
`getPnLDataV2`, `lib/costing/issue-costing.ts` internals,
`lib/reports/issued-value-report.ts`.

## The trap that would make this script worthless

`lib/costing` already exports `computeIssueCosting`,
`buildIssueCostingPurchases`, `buildIssueCostingIssues` and
`allocatePurchaseOrderCost` — and `getPnLDataV2` is built on them. **A check that
calls those same functions proves only that they are deterministic.** It would go
green forever, including on the day their arithmetic is wrong, which is exactly
the failure `BR-COGS-006` describes.

So: the reference figure comes from calling `getPnLDataV2` — `BR-COGS-005` is
explicit that a verification gate's figure must come from the report and never
from summing tables. The **challenger** figure must be computed independently, in
this script, from the raw rows, without importing anything from `lib/costing`.
Two implementations that agree is evidence. One implementation run twice is not.

State this in the script's header comment so nobody later "simplifies" it by
importing the shared helper.

When the two disagree, the script must print enough to tell **which** is wrong —
per purchased item and per period, not one total. Disagreement says one side is
broken, not which side.

## Gate 1: every purchase reconciles to what was paid

For each purchase order: sum of its line subtotals, plus `shipping_fee`, plus
`tax_amount`, minus `voucher_amount`, minus `discount_amount`, must equal
`total_amount`. Also assert `subtotal_amount` equals the sum of its own lines,
and that no order has zero lines.

**Measured 2026-09-07 while writing this plan: 0 mismatches on 164 orders**, 310
lines, 0 orders without a line. Sum of line subtotals 93.394.906đ against
89.482.097đ paid — the 3.912.809đ gap is shipping, tax, vouchers and discounts,
and it reconciles exactly per order, which is why the gate is green rather than
the gap being a finding.

This is the gate that would have caught `BR-COGS-006` (52.773.374đ of line
subtotals presented as though it were the 49.149.880đ actually paid).

## Gate 2: the report's cost equals an independent recomputation

Reference: `getPnLDataV2`'s cost figure. Challenger: recomputed here — each
`stock_issues` row valued at the weighted average cost of that purchased item at
the moment of issue, per `BR-COGS-005`, with the purchase value per unit derived
from what was paid per `BR-COGS-006`. Must match to the đồng.

Rounding is measured in JavaScript, never drafted in Python — the two round 0,5
in opposite directions (`lib/costing/CLAUDE.md`).

## Reported, never red: shrinkage

`stock_issues` rows with `source = 'STOCKTAKE'` are what a count found missing
beyond what was issued. Print the value and the row count. Only 2 stocktake
sessions exist, so say so: a figure resting on two counts is thin, and the
script should print the denominator rather than imply a trend.

**A gap found while writing this plan, not fixed here: the P&L's cost line
does not implement `BR-COGS-007` today.** `computeIssueCosting` never reads
`Issue.source` — the weighted-average replay treats a `MANUAL` and a
`STOCKTAKE` row identically — and `getPnLDataV2` feeds every non-equipment
issue into it with no source filter; `PnLReportResult` carries no separate
shrinkage field at all. So `totalCOGS` today already contains both, contrary
to the rule that shrinkage stays its own line.

**Measured 2026-09-08 against production, with the system's own costing
engine:** 139 non-equipment issues, 90 `MANUAL` and 49 `STOCKTAKE`. Reported
`totalCOGS` 47.885.076đ. `MANUAL` only — what `BR-COGS-007` defines as *Giá
vốn* — is 12.984.483đ. **34.900.592đ (72,9% of the reported figure) is
`STOCKTAKE` value sitting inside the cost line.** That figure is the
2026-08-09 count: `BR-COGS-007` itself says it is not shrinkage in the
period-loss sense — no issue slips existed before it, so it is four months of
unrecorded consumption surfacing at once. The rule says report it where it
falls; the P&L currently does not.

**Gate 2 must not be built around this.** The challenger includes every
issue, `MANUAL` and `STOCKTAKE` alike, matching `getPnLDataV2`'s actual
definition exactly — the gate's job is to catch drift between the report and
the data, not to silently correct the report's definition. **Separately**,
`verify-cogs.ts` prints the `MANUAL`/`STOCKTAKE` split (both totals and row
counts) and states plainly, naming `BR-COGS-007`, that the reported cost line
currently contains value the rule says should be its own line. This is a
finding for the owner, not a script failure — whether to change `getPnLDataV2`
is his decision, out of scope here. Do not touch `getPnLDataV2` or anything in
`lib/costing` in this plan.

## Task 0: challenge the plan

Re-measure the six row counts and Gate 1's result. Report in English with counts.
If Gate 1 is not 0 of 164, **stop** — a live discrepancy in purchase money is a
finding to report to the owner before any script is written around it.

## Task 1: write the script

**Files:** new `scripts/verify-cogs.ts`, a `scripts/verify-cogs-core.ts` holding
the pure functions, `scripts/verify-cogs-core.test.ts`. Follow the split
`verify-revenue.ts` / `verify-revenue-core.ts` / `verify-revenue-core.test.ts`
already uses — do not invent a second shape.

- [ ] **Step 1: Tests red first**, on the core functions with fixture rows: an
      order that reconciles; one off by the shipping fee; one with no lines; an
      issue valued at a weighted average across two purchases at different
      prices; a `STOCKTAKE` issue landing in the shrinkage figure and not in
      cost. Say for each whether it was red for a wrong value or a missing
      function.
- [ ] **Step 2:** Implement. `verify-cogs-core.ts` stays pure and imports nothing
      from `lib/costing`. `verify-cogs.ts` fetches, calls `getPnLDataV2` for the
      reference, and prints.
- [ ] **Step 3: Output.** Every figure carries its denominator — "0 lệch trên 164
      đơn mua hàng", not "0 lệch". Name real items, never codes, in anything the
      owner reads. End with an explicit line for what the script does **not**
      check, in the shape `verify-revenue.ts` already uses for its own blind spot.
- [ ] **Step 4:** Run it against production. Gates, build, commit.

## Task 2: make the documents true again

- [ ] `lib/costing/CLAUDE.md` — replace *"Chưa có script `verify-*` cho giá vốn
      (đo 2026-09-07)"* with the script's name and what it gates. That sentence
      becomes false the moment Task 1 lands.
- [ ] `CLAUDE.md` — the "Lệnh" table tells the reader to run the matching
      `verify-*` script when touching cost or stock. Confirm it now resolves to
      something real; adjust only if it does not.
- [ ] Gates, commit.

## Cross-impact

- **This does not verify that the data matches reality.** Both gates are internal.
  If a purchase was entered at the wrong price, or an issue was never recorded,
  both gates stay green. The owner chose this knowingly; the script must say so
  in its own output rather than let a green run imply more than it proves.
- **Two closed months can never be verified.** June and July 2026 closed with no
  stock count, so `BR-COGS-005` cannot produce a cost figure for them at all.
  Print that as a stated exclusion, not as a zero.
- **Blocks nothing.** Adding a check does not change a reported number.

## Out of scope

Changing how cost is computed; anything that writes; a stocktake-based hard gate
(the owner declined it, and 2 sessions is too thin to set a threshold on).
