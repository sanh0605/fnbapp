# Playbook: Historical implicit-production-on-shortfall quantity correction

Read this before touching any historical order's stock-ledger rows for a
product that requires a semi-product (bán thành phẩm) ingredient. This
class of correction caused a real incident on 2026-07-21 (10,054 wrong
ledger rows written, then rolled back) -- read it fully before writing
anything, not just skimming the header.

## Background

Before commit `21f7438` (2026-07-20), the system had no real production-
ticket workflow for semi-products (Cốt cà phê, Hồng trà, Trứng luộc, etc.).
When a sale needed a semi-product, the old code path substituted a direct
debit of the raw-ingredient equivalent via `SALES_CONSUME` -- coffee beans
literally can't be served to a customer, so this was always wrong, just
silent. Round 1 (2026-07-20) fixed 479 orders tagged `BTP_SHORTFALL` in the
ledger. A much larger population turned out to exist: 2026-07-21's
investigation found the pattern in **992 more orders** across nearly every
common semi-product (Cốt cà phê 583, Hồng trà 202, Cốt matcha 194, Cốt
cacao 152, etc.) -- this was the *normal* historical recording method for
semi-product sales, not a rare exception.

## The mistake made 2026-07-21 -- do not repeat it

A "Round 2" script assumed every order where `buildLineConsumptionRows`
reports `implicitYields.size > 0` uses the *exact same* recorded-ledger
shape as the already-verified cases (Round 1, the egg/Trứng gà
investigation): a **direct raw-ingredient debit, with the semi-product
itself never touched**. Round 2 blindly inserted a `RECLASSIFICATION_REVERSAL`
+ `PRODUCTION_CONSUME` for the raw ingredients on every matching order,
without checking whether that assumption actually held for that specific
order.

It didn't hold for a real subset (e.g. `PHD000194`): some orders had
already gone through an *earlier, unrelated* correction pass, and their
recorded ledger shows the **semi-product itself** debited directly via
`SALES_CONSUME` (e.g. `BTP-001` Cốt cà phê, qty -50) -- meaning the raw
ingredients for that sale were already accounted for elsewhere (whatever
mechanism replenished the semi-product's own stock). Round 2 inserted a
*fresh* raw-ingredient debit (`NNL-002`/`NNL-003`, -20/-65) on top of that,
double-counting consumption that was never actually missing. Applying this
across 992 orders (10,054 new rows) made `scripts/audit-order-ledger.ts`'s
mismatch count go **up** (209 → 2,853), not down -- caught immediately by
re-running the standard verification audits right after applying, exactly
as the process requires.

**Rolled back cleanly**: all of Round 2's rows shared the
`RECLASSIFY_2026-07-20` source tag but were inserted with a `created_at` of
2026-07-21 (the day Round 2 ran), distinct from Round 1's 2026-07-20
`created_at` -- this made a clean, surgical rollback possible
(`scripts/rollback-btp-shortfall-round2.ts`) without touching Round 1's
legitimate 479-order correction. Verified back to the exact pre-Round-2
baseline (209 mismatches, 0 VND P&L/MAC delta) afterward.

## What to do instead, next time

Before inserting any reclassification for an order flagged by
`implicitYields.size > 0`, check what's **actually recorded** for that
order's semi-product and its raw ingredients, not just what the recipe
recompute expects:

- **True old-bug pattern (safe to reclassify)**: the semi-product itself
  has NO ledger row at all for this order, and the raw ingredients show a
  direct `SALES_CONSUME` debit. This is what Round 1 and the egg case
  verified.
- **Already-accounted pattern (do NOT reclassify)**: the semi-product
  itself has its own `SALES_CONSUME` (or similar) row for this order. This
  means raw-ingredient consumption already happened somewhere else in the
  ledger's history (a separate production/replenishment event) and must
  not be re-debited here.

Always dry-run against the **full candidate set** first (not a small
sample) and re-run the standard verification audits
(`scripts/audit-order-ledger.ts` / `scripts/verify-all-479-clean.ts`,
`scripts/audit-pnl-mac-consistency.ts`) immediately after any `--apply` --
comparing the mismatch count before and after, not just checking "no
errors thrown." A silently-wrong correction looks identical to a correct
one unless you check the aggregate number moved in the right direction.

## Resolved (2026-07-21, same night): the corrected retry

Rewrote the script with exactly the per-order check above (does the
semi-product itself already have a ledger row for this order?), fixed a
second bug caught by the same immediate-reverify discipline (a double-
reversal when 2+ order lines shared the same item+source key -- the exact
same bug class as `scripts/apply-fix-double-reversal-bug.ts` from
2026-07-20's original correction, reintroduced by copying that script's
structure without re-checking this edge case; fixed the same way, an
insert-only compensating negative-quantity reversal for the exact excess).
Result: of the 992 orders originally suspected, only **23** were the true
old-bug pattern needing correction; **903** already had the semi-product
tracked elsewhere (no action needed, confirming most of the "992" alarm was
this same false-positive shape); **66** remain genuinely unexplained
(neither the semi-product nor its raw ingredients have any ledger row --
not safe to guess at, left open, see `COGS-4`).

Also recomputed `cost_at_sale` for all 23 corrected orders' lines
afterward, using the same targeted per-line pattern as
`scripts/apply-migrated-orders-mac-correction.ts` (bypasses
`findAffectedLines`, only touches known lines). Result: **0 lines needed a
cost change** -- confirms commit `21f7438`'s own stated invariant that this
class of reclassification is cost-neutral by construction (a semi-product's
MAC cost already falls back to its recipe's raw-ingredient cost whenever
its own direct MAC is 0, which `PRODUCTION_YIELD` always writes as). Final
state reverified clean: 209 mismatches (same stable baseline), 0 VND P&L/MAC
delta, 22,904,406 VND total COGS unchanged.

**Still open**: the 66 unexplained orders and the 119 mismatches from the
separate low-cost-ingredient root cause (see `COGS-4` in `docs/ROADMAP.md`)
-- neither was touched, both are low financial risk but not yet root-caused.
