# The sales charts bucket by UTC, so 16% of orders land on the wrong day

**Written 2026-08-26 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1), in particular §4's claim that the totals are unaffected.

Found by the owner: he filtered the sales report to **2026-08-01 → 2026-08-26**
and the monthly chart drew **two** columns, `2026-07` and `2026-08`.

---

## 1. The defect

`app/admin/reports/actions.ts:524-541` buckets every chart from a raw
`new Date(o.created_at)`:

```ts
const dateStr  = d.toISOString().split("T")[0];      // Theo Ngày   -- UTC
const monthStr = d.toISOString().substring(0, 7);    // Theo Tháng  -- UTC
const dow      = days[d.getDay()];                   // Theo Thứ    -- server-local
const hour     = d.getHours()...                     // Theo Giờ    -- server-local
```

`toISOString()` is UTC. Saigon is **UTC+7**, so anything sold before 07:00 local
falls on the previous UTC day — and on the 1st of a month, in the previous
month. `getDay()`/`getHours()` read the *runtime's* local zone, which on Vercel
is UTC, so they are shifted by the same seven hours.

**This shop's busiest hours are 06:00–08:00**, which is exactly the window that
crosses the UTC boundary. The defect is not a rare edge; it hits the peak.

## 2. Measured, not estimated

**The owner's own column, reproduced exactly:** within his filter, four orders
sold on **2026-08-01 between 06:22:53 and 06:59:16** carry a UTC month of
`2026-07`. Their revenue is **174.000đ** — the number printed on the `2026-07`
bar in his screenshot.

**Across all completed, non-superseded orders:**

| | |
|---|---|
| Orders | 2.350 |
| Orders whose Saigon date differs from their UTC date | **378 — 16%** |
| Revenue on those orders | **8.310.000đ** |

## 3. The fix

The repository already has the right helpers, and the report already uses one of
them: `toSaigonUtcRange` (`lib/report-time.ts:28`) converts the filter's dates,
which is why §4 holds. The bucketing simply never got the same treatment.

Bucket all four series in **`Asia/Ho_Chi_Minh`**:

- `Theo Ngày` — the Saigon calendar date.
- `Theo Tháng` — the Saigon calendar month.
- `Theo Thứ` — the Saigon day of week. Note `days = ["CN","T2",…]` is indexed by
  `getDay()`; whatever replaces it must keep Sunday at index 0 or the labels
  silently shift by one.
- `Theo Giờ` — the Saigon hour. This one is currently **7 hours off**, so the
  shop's 06:00–08:00 peak renders at 23:00–01:00. Expect the chart to change
  shape dramatically; that is the fix working, not a new bug.

Put the conversion in **one** helper used by all four, next to the existing ones
rather than inline in the loop. Four call sites drifting apart is how this
happened.

## 4. What must not change, and why it is safe to assert

**The totals.** `totalRevenue`, `totalOrders` and the per-outlet breakdown do
not bucket by time at all — the breakdown sums per outlet over the same filtered
set (`actions.ts:552-562`). So the money is already right: August reads
**14.587.000đ**, and `scripts/verify-revenue.ts` gates April 2.190.000đ, May
7.675.000đ, June 22.157.000đ, July 18.661.000đ.

**Only the grouping is wrong.** Say that plainly to the owner in the report —
"the chart was wrong" and "the revenue was wrong" are very different sentences,
and he is entitled to know which one this is.

## 5. Verification

- **A test that fails first, using the owner's real case:** an order with
  `created_at` = `2026-08-01T06:22:53+07:00` must bucket to day `2026-08-01`,
  month `2026-08`, and hour `06:00`. Against today's code it buckets to
  `2026-07-31`, `2026-07`, `23:00`. Run it before the fix and report the three
  wrong values.
- **A day-of-week test on a known date** — pick one and state which day it
  really was, so an off-by-one in the `days` array cannot pass.
- **The four series still sum to the same total** as before the change. Nothing
  may be dropped or double-counted by rebucketing.
- `scripts/verify-revenue.ts` unchanged.
- `CLAUDE.md` §9's four gates. Do not push.

**Do not "fix" this by changing any stored timestamp.** The data is correct;
only its presentation is not.

## 6. Related, and deliberately not bundled

`OPEN-ITEMS 55` records a timezone-ambiguous parse in the purchase-order path —
the same class, a different site. Leave it; a fix that spans both is harder to
verify than two that do not.

Worth raising afterwards, not now: whether any **other** screen buckets by
`toISOString()` or `getHours()`. A repository-wide grep would answer it, and if
the answer is "several", that is its own item rather than scope creep here.

## 7. Done means

`CLAUDE.md` §9 in full, plus §5.
