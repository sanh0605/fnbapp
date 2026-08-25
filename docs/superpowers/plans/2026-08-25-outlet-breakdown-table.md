# The outlet breakdown needs a table on wide screens

**Written 2026-08-25 by Opus 5.** Handoff to Sonnet 5. Small, but it corrects a
misreading of a rule, so the reasoning matters more than the markup.

---

## 1. What the owner saw

`app/admin/reports/sales/page.tsx:242` renders the per-outlet breakdown as
`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` cards. With two outlets on a desktop
screen that is two small cards adrift in a wide empty row. The owner:
*"cái này không phù hợp khi thiết kế dưới dạng như này, đáng lẽ phải là dạng
table chứ?"*

**He is right, and the cards came from a misreading of `CLAUDE.md` §8 by the
author of the plan that specified them.** §8 forbids a horizontal table **on a
phone** — *"không bảng ngang trên điện thoại (mỗi dòng một thẻ xếp dọc)"*. It
does not forbid a table on a desktop, and "điện thoại trước" means design for
the phone first, not never build the wide layout.

So the fix is **one dataset, two shapes** — not replacing cards with a table.

## 2. The change

In that section only:

- **Below `md`:** keep today's stacked cards, one per outlet, unchanged.
- **From `md` up:** a real table, in a container that scrolls horizontally on
  its own (`overflow-x: auto`) so the page body never scrolls sideways.

Columns:

| Điểm bán | Số đơn | Doanh thu | TB/đơn | % tổng |

- **`TB/đơn`** = revenue ÷ orders, rounded to whole đồng. Guard division by
  zero: an outlet with 0 orders in the period shows `—`, not `NaN` or `0đ`.
- **`% tổng`** = this outlet's revenue ÷ the period's total revenue, one
  decimal. If the total is 0, show `—`.
- A **total row**: summed orders and revenue. Leave `TB/đơn` and `% tổng` blank
  there rather than printing a blended average nobody asked for.

**Why these two columns.** The existing cards carry orders and revenue only, and
the interesting fact is invisible in them: measured across all history, outlet 1
averages **21.300đ** a ticket against outlet 2's **41.800đ** — under half the
orders for nearly the same revenue. The table makes that legible without the
reader doing arithmetic.

Keep the "unassigned" bucket the current code already renders, so no order is
silently dropped — it just becomes a row.

## 3. What must not change

- The numbers. `getSalesDataV2`'s computation is already verified: the per-outlet
  figures sum to the frozen monthly totals to the đồng (April 2.190.000đ, May
  7.675.000đ, June 22.157.000đ, July 18.661.000đ). **This is presentation only** —
  if the totals move, something is wrong with the change, not the data.
- The phone layout. Anyone testing at phone width should see exactly what ships
  today.

## 4. Verification

- **A render test at each width**, asserting the table is present and the cards
  are not above the breakpoint, and the reverse below it. If jsdom cannot
  evaluate the responsive classes — `OPEN-ITEMS 38` records that Tailwind
  breakpoint classes are not evaluable there — then assert **both** layouts are
  in the markup with the expected classes, and **say in the test's own name**
  that it checks class presence rather than rendered layout. Do not let a
  class-presence check masquerade as a layout check.
- `TB/đơn` with 0 orders renders `—`, proven by a test, not by reading the code.
- `% tổng` across all rows sums to 100,0% (allowing one decimal of rounding);
  assert it on a fixture with three outlets so the rounding is actually
  exercised.
- The section's totals equal the report's existing totals for the same period.
- `CLAUDE.md` §9's four gates. Do not push.

## 5. Done means

`CLAUDE.md` §9 in full, plus §4.
