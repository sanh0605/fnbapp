# Depreciation bands: half-open bounds, full add/delete, and an exact cost basis

**Written 2026-08-23 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1) — in particular §3's claim that deleting a band is safe, and
§4's claim that `assets` is empty so no backfill exists.

Owner raised the first two from the live screen. The third was found while
checking the first and is fixed in the same pass because it is cheap now and
expensive later.

---

## 1. The bands leave gaps, and the gap is only hidden by a rounding step

Seeded as `0–199.999`, `200.000–500.000`, `500.001+`, with
`findBandForUnitPrice` matching `unitPrice >= min && unitPrice <= max` and
`validateBands` requiring `band.max + 1 === next.min`
(`lib/asset-depreciation.ts:65-107`). That design only closes if every price is
an integer.

**199.999,05đ and 500.000,50đ match no band at all.**

Unreachable today only because `lib/asset-purchase-allocation.ts:60` does
`Math.round(allocatedTotal / line.quantity)` before the lookup ever sees the
number. **A rule that is correct only because something upstream rounds is not
correct** — it silently reopens the moment the rounding moves, and the screen
already states the wrong rule to the reader.

**Owner's form, 2026-08-23** — adopt it exactly:

1. `x < 200.000`
2. `200.000 ≤ x < 500.000`
3. `500.000 ≤ x`

So `min_unit_price` stays **inclusive** and `max_unit_price` becomes
**exclusive** (null still means unbounded). Changes:

- Lookup: `unitPrice >= min && (max === null || unitPrice < max)`.
- `validateBands`: adjacency becomes `band.max === next.min`, not `max + 1`.
- Migration updating the three seed rows to `(0, 200000)`, `(200000, 500000)`,
  `(500000, null)`.
- Every label the screen renders. "0đ - 199.999đ" becomes
  **"Dưới 200.000đ"**; "200.000đ - 500.000đ" becomes
  **"Từ 200.000đ đến dưới 500.000đ"**; "500.001đ trở lên" becomes
  **"Từ 500.000đ trở lên"**. The error messages in `validateBands` say
  `Khung X-Y` too — they must not keep describing an inclusive upper bound.

**One consequence, already accepted by the owner because he stated the rule:**
a unit price of exactly **500.000đ** moves from 24 months to **36**. Nothing
owns that price today, so nothing changes retroactively — and §9.1's freeze
means it could not have anyway.

## 2. The band screen cannot add or delete

`app/admin/inventory/asset-bands/` renders **Sửa** only. A table the owner
cannot add a row to is not the settings screen `CLAUDE.md` §8 requires; it is a
constant with an edit box.

Add **create** and **delete**, both running `validateBands` against the
resulting set and refusing with the existing Vietnamese messages. Deleting the
band that covers a gap must be refused for that reason, not silently allowed.

**Delete really deletes; do not soft-delete.** `CLAUDE.md` §2's
never-delete rule protects master data whose history other rows must be able to
explain. A band is neither: `assets.term_months` is **frozen at creation**
(§9.1), so no asset depends on its band still existing, and a retired band that
lingers only makes the next reader wonder which of two overlapping rows applied.
If you disagree, argue it before implementing.

## 3. The stored unit cost cannot reproduce what was paid

`lib/asset-purchase-allocation.ts:60` stores `unit_cost = Math.round(total /
quantity)`, and `lib/asset-depreciation.ts:177` takes `cohort.qty * unit_cost`
as the amount to spread. Multiplying a rounded unit back up does not return the
line total.

**Measured across the owner's 72 equipment items — 11 drift:**

| Item | Qty | Paid | quantity × rounded unit | Drift |
|---|---:|---:|---:|---:|
| `Hủ đựng topping liền nắp` | 200 | 80.352đ | 80.400đ | **+48đ** |
| `Cốc đong 100ml` | 8 | 115.140đ | 115.136đ | −4đ |
| `Cân tiểu ly` | 3 | 215.522đ | 215.523đ | +1đ |
| `Máy đánh bọt cà phê` | 2 | 468.583đ | 468.584đ | +1đ |

Trivial as money. **Not trivial as a check**: the batch 3 plan's §6 stakes
verification on reconciling all 95 products against the owner's sheet to the
đồng. A schedule that cannot sum to what was paid makes that check report a
mismatch it cannot fix, and a check people learn to wave through is worse than
no check.

**Fix:** store the line's allocated total alongside the per-unit figure, and
depreciate from the total.

- Add `total_cost bigint not null` to `assets` — the allocated line total,
  unrounded by division.
- `unit_cost` stays, for the band lookup and for display. It is a derived
  convenience now, not the basis.
- The schedule's basis becomes `total_cost` apportioned across cohorts:
  a cohort of `qty` units carries `round(total_cost × qty / quantity)`, with
  the **last cohort absorbing the remainder** so the cohorts sum to
  `total_cost` exactly — the same device already used to make the months of one
  cohort sum to their own total.

The existing "sums to cost" tests must then assert against `total_cost`, and a
new one must use `Hủ đựng topping liền nắp`'s real shape: 200 units, 80.352đ,
12 months — the total charged must be exactly **80.352đ**, and it must fail
against today's code.

## 4. Verification

- **No backfill, and confirm that rather than assume it.** `assets` and
  `asset_disposals` are empty on production (verified 2026-08-23, 0 rows each),
  so the new column has nothing to populate and the band-bound change moves no
  existing row. Re-check immediately before writing the migration; if either
  table is non-empty the premise has changed and that is worth reporting rather
  than working around.
- **Every new test proved to fail first, and say why each fails** — a wrong
  value, or a missing symbol. Both are acceptable; conflating them is not.
- **Boundary tests on the new bounds, at non-integer precision:** 199.999,05
  and 500.000,50 must each match exactly one band. These are the cases that
  motivated the change and they must fail against today's code.
- `validateBands` still refuses an overlap, a gap, and an unbounded band that
  is not last.
- Delete refused when it would open a gap; create refused when it would overlap.
- `scripts/verify-revenue.ts` unchanged.
- Migration: list triggers on `assets` before altering it, prove no row
  rewritten. **Do not apply, do not push** — the owner approves each.

## 5. Out of scope

`OPEN-ITEMS 53`, `54`, `55`; entering any purchase; and changing how
`BR-COGS-006` allocates — §3 changes only what the asset register *stores* from
that allocation, never the allocation itself.

## 6. Done means

`CLAUDE.md` §9 in full, plus §4.
