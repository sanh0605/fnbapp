# Plan G — A page showing the value of goods issued

**Written 2026-08-13 by Opus 5.** Owner asked for it mid-session, explicitly as
a temporary monitoring page: *"chỉ cần làm đơn sơ rồi sẽ tối ưu lại ở kế hoạch
dài hạn trong bước phù hợp"*. Plan F (the POS split) is paused at F2b and
resumes after this.

---

## 1. Why now, and what it is not

The first stocktake closed 2026-08-09 and ten manual issue slips followed, so
`stock_issues` finally has content: **59 rows, 50 purchased items,
35.616.236đ** of issued value as of today. Until now every cost figure read 0đ
(`CLAUDE.md` section 7), so there was nothing to look at. There is now, and no
screen shows it.

**What this page is not: a monthly cost report.** All 35,6 triệu falls in
August because that is when the first count closed, not because August consumed
it. June and July read 0đ while both months certainly consumed goods. A period
only becomes meaningful **between two counts**, and there has been one. The page
must not invite month-to-month comparison, and this is why it ships with no
period filter (§4).

---

## 2. Measured starting point

Run against live data 2026-08-13, using the same builders
`app/admin/reports/actions.ts` uses:

- `stock_issues`: 59 rows — 49 `STOCKTAKE`, 10 `MANUAL`; 2026-08-09 to 2026-08-12.
- Total issued value, all time: **35.616.236đ**. By month: June 0đ, July 0đ,
  August 35.616.236đ.
- 50 items carry a non-zero issue. Largest: **Bột cà phê MR.PHIN Robusta Dak
  Mil**, issued 6.179.657đ, closing 2.101.083đ. Then **Sữa đặc La rosee**
  3.512.753đ / 1.484.262đ, **Sữa tươi Mlekovita** 3.179.305đ / 434.777đ.
- **No item has a negative issued or closing value.**

These are the numbers the finished page must reproduce. If it shows anything
else, it is wrong, and the discrepancy is the bug — not a rounding preference.

---

## 3. The one real trap: a second definition of cost

`buildIssueCostingPurchases` and `buildIssueCostingIssues` are **private
functions inside `app/admin/reports/actions.ts`** (lines 89-131). The new page
needs exactly the same inputs.

**Copying them is forbidden.** This project has lost two nights to precisely
that shape once already (the Drive backup table list living in two files,
2026-08-06) and had a plan carry stale figures for the same reason. Two copies
of a cost definition will drift, and the page will quietly disagree with the
sales report.

**G1 extracts them into `lib/` first**, and `actions.ts` starts importing them.
That is a pure move with no behaviour change, and it is a prerequisite, not a
nicety.

---

## 4. Scope

One page, two tabs, no filters.

- **Tab "Theo nguyên liệu"** — total at top, then one card per purchased item:
  issued quantity, issued value, closing value. Sorted by issued value
  descending. 50 cards.
- **Tab "Theo lần xuất"** — one card per stocktake session and per manual slip:
  date, what it was (`note` for a slip, the session for a count), number of
  items, and that event's value.

**Deliberately excluded**, each for a reason:
- **No period filter.** §1: months mislead until the second count. Adding one
  invites the exact misreading the page exists to avoid.
- **No per-drink cost.** Issue-based costing knows what left stock, not which
  drink used it — the same reason `getPnLDataV2` dropped per-product margin.
- **No editing.** Read-only. Issue slips are created and reversed on their own
  screen, which already exists.

---

## 5. Valuing a single slip — do not invent a second method

`computeIssueCosting` returns **per-item** totals, not per-row values, so
there is no ready-made "what did this slip cost" number.

The only acceptable derivation is the same prefix subtraction
`computePeriodIssuedValue` already uses: an event's value is the total issued
value through that event minus the total through the event before it, replayed
in the engine's own order. **Do not** value a slip by multiplying its quantity
by a unit cost computed some other way — that is a second costing definition
wearing a helpful disguise, and it will disagree with the total.

**The gate that catches it:** the per-slip values must **sum exactly to
35.616.236đ**, the same figure the per-item tab totals. Assert it in a test, not
by eye.

---

## 6. Tasks

- **G1 — Extract the two builders into `lib/`**, `actions.ts` imports them.
  Pure move. `npx vitest run` count unchanged, `app/admin/reports/actions.test.ts`
  green, and `getPnLDataV2` still returns the June 22.157.000đ / July
  18.661.000đ revenue figures Plan C gated on.
- **G2 — The page and its server action**, both tabs, mobile-first per
  `CLAUDE.md` section 8: stacked cards, no wide table on a phone.
- **G3 — Tests**: the three figures in §2 (grand total, item count, the largest
  item's issued and closing value) and the §5 sum gate.

---

## 7. Verification bar

`CLAUDE.md` section 9 in full. Plus, because this is a cost screen: the page's
grand total equals **35.616.236đ** against live data, and the owner **opens the
page while logged in** — section 9's last clause exists because four green
gates missed a page that threw on every load, and only the owner opening it
found out.
