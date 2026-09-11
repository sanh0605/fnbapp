# Profit and loss rules

The monthly profit-and-loss page is designed, not built. Design:
`docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md`. The rules below
are the owner's decisions for it; how each line is computed is in the design
and in `BR-COGS-007`, `BR-COGS-008`, `BR-CASH-001` and `BR-CASH-003`.

**Rounding.** Every figure is computed exactly and rounded only where it is
shown (`BR-DATA-005`), in `lib/reports/profit-and-loss-table.ts`: each month's
cell, each total and each profit from its own exact value. Adding a row by hand
can therefore miss its total by a đồng or two; when it does, the page says so
under the table. Percentages show two decimals (`PERCENT_DECIMALS`, owner
decision 2026-09-11).

### BR-PNL-001 — One profit and loss for the whole shop

**Status:** `APPROVED` — owner decision 2026-09-11.

Phin Đi and Uchako share one table. There is no split by brand, not even a
revenue sub-line per brand. Owner, 2026-09-11: "Chỉ một bảng chung". Why:
stock, utilities and running costs are shared, so a per-brand profit would
rest on an allocation nobody chose. Revenue per brand stays in the sales
report.

### BR-PNL-002 — Months run across as columns, lines run down as rows

**Status:** `APPROVED` — owner decision 2026-09-11.

One year per view. Each month is a column, followed by the year's total and
the share of revenue; each line (revenue, cost of goods, each expense group,
profit) is a row. The owner compared this against his own sheet's layout
(months as rows) on a clickable sample with real figures and chose columns:
"Tháng theo cột". On a phone there is no wide table: one card per month,
newest first.

### BR-PNL-003 — Hand-recorded sales revenue sits on its own line

**Status:** `APPROVED` — owner decision 2026-09-11.

Income in a cash-book category marked as sales revenue counts as revenue, not
as other income, and shows as "trong đó ghi tay" under the revenue line so it
stays distinguishable from revenue the POS recorded. Today that is only the
two lost-revenue rows of `BR-CASH-001`.

### BR-PNL-004 — The owner and the manager can open it

**Status:** `APPROVED` — owner decision 2026-09-11.

Both `ADMIN` and `MANAGER` open the profit and loss, the same as the other
reports. Owner, 2026-09-11: "Anh và quản lý". The recommendation had been
`ADMIN` only.
