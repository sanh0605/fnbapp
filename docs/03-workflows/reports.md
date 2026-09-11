# Reports flow (dashboard and four reports)

```flow-decl
routes: /admin, /admin/reports/daily, /admin/reports/sales, /admin/reports/issued, /admin/reports/pnl
files:
tables:
brCodes: BR-COGS-005, BR-COGS-007, BR-PNL-001, BR-PNL-002, BR-PNL-003, BR-PNL-004
```

This flow is **read-only**: the dashboard and the four reports display figures
derived from data other flows already wrote. Nothing here writes to the database,
so the `flow-decl` block declares no `files` and no `tables` — the empty value
lists are intentional, not an omission. Because no file is declared, this flow
contributes nothing to the map-drift check; it is verified only by its five routes
existing.

The screens are the dashboard at `/admin` (a revenue and orders summary), the
daily report at `/admin/reports/daily`, the sales report at `/admin/reports/sales`,
the issued-goods (cost) report at `/admin/reports/issued`, and the monthly
profit and loss at `/admin/reports/pnl`.

## Five-question current-state description

1. **States, and how each is set.** These are display views, not records — they
   hold no persisted state. What a report shows is a function of two things the
   reader sets: the date range chosen on the screen and the live contents of the
   source tables at read time. Re-opening a report after new sales or new issue
   slips shows updated figures, because it re-reads the source each time. There is
   no draft, no saved report, and no approval step.

2. **Buttons per screen, and when to hide them.** Each report screen offers a date
   range or period picker to choose what to show, and read-only controls to sort
   or expand rows. There is no create, edit, delete, or export-that-writes button
   anywhere in this flow, because the flow writes nothing; any such button would be
   out of place and should never appear. The dashboard at `/admin` presents its
   revenue and orders summary directly, with links through to the detailed reports.

3. **What each list contains, and what is excluded.** The **sales report**
   (`/admin/reports/sales`) counts revenue from `orders_v2`, and it includes only
   rows with `status = 'COMPLETED'` **and** an empty `superseded_by`. This is the
   supersede model from `BR-SALE-002`: editing an order does not overwrite the old row —
   the old row becomes `SUPERSEDED` and a new `COMPLETED` row is written under the
   same order code. Counting without both filters would double-count an edited
   order, so superseded and non-completed rows are deliberately excluded. The
   **issued-goods report** (`/admin/reports/issued`) reads cost from `stock_issues`,
   which is the single path cost is measured on (`BR-COGS-005`): cost is booked when
   goods physically leave stock, not at the moment of sale. Its rows are split by
   the `source` column — `MANUAL` (goods left stock via an issue slip) versus
   `STOCKTAKE` (a shortfall booked when a count period was closed). The **daily
   report** (`/admin/reports/daily`) contains the per-day roll-up of the same
   completed-order revenue.

4. **Valid inputs, and what happens outside the range.** The only inputs are the
   date range and period selectors. A range with no matching data shows an empty or
   zero result rather than an error — there is nothing to write, so nothing can fail
   to write. A malformed or reversed range is bounded by the picker itself.

5. **Which data it serves, and which it deliberately does not.** It serves
   read-only reporting: revenue from completed, non-superseded orders, and cost of
   goods from `stock_issues`. It deliberately does **not** write anything, does not
   deduct stock, and does not recompute or pin any cost — it only displays figures
   the sales, issue, stocktake, and costing flows already produced.

## The one figure that is easy to report wrong

`stock_issues` carries both `MANUAL` issue-slip cost and `STOCKTAKE` count-shortfall
cost in the same table, separated only by `source`. **The two must not be summed and
called one month's cost of goods.** The first stocktake of a materials line books a
shortfall that accumulated over many prior months of untracked usage, so adding that
one-time catch-up to the same month's issue-slip cost overstates that month badly.
This is why the issued-goods report keeps the two `source` values on separate lines,
and why `BR-COGS-007` treats direct-material issue cost and stocktake shrinkage as
distinct lines with the shrinkage having its own precondition (a period is only
counted as loss if it had issue slips to measure against).

## The profit and loss page

`/admin/reports/pnl` shows one year of monthly profit and loss for the whole
shop (`BR-PNL-001`), months as columns (`BR-PNL-002`), for `ADMIN` and
`MANAGER` (`BR-PNL-004`). Design:
`docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md`.

- **Reads, never writes.** `getProfitAndLossReport`
  (`app/admin/reports/pnl/actions.ts`) loads source rows and recomputes every
  figure on every open (`lib/reports/profit-and-loss.ts`);
  `lib/reports/profit-and-loss-table.ts` rounds for display (`BR-DATA-005`).
  Nothing is stored and no month is locked.
- **One control: the year**, as `?year=YYYY`. A malformed year, or a year with
  no data, falls back to the newest year with data, without an error.
- **Cells open their sources.** On a computer, clicking a month cell lists the
  rows behind it under the table: POS order count and hand-recorded revenue
  (`BR-PNL-003`), cash-book rows, purchase lines, stocktakes and issue slips,
  assets; a profit cell shows its sum. The Tổng column does not open. On a
  phone there is no wide table: a year card, then one card per month, newest
  first.
- **Checked against the older report.** `scripts/verify-pnl-monthly.ts`
  confirms that every month's POS revenue, and Giá vốn plus Hao hụt, equal
  `getPnLDataV2` for the same month, and that every line's sources add up to
  the line.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
