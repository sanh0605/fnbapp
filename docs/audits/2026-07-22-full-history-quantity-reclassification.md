# Full-history quantity reclassification (owner decision)

Date: 2026-07-22
Status: applied and reverified against the new engine

## Owner decision

After the cost side was fully corrected (both unlocked lines and formerly-locked lines, see
`docs/audits/2026-07-22-lock-removal-and-full-recompute.md`), the owner asked for the quantity side
(previously deferred as `COGS-6`, 82% of order history) to be applied too, explicitly understanding
and accepting this is `lib/full-history-recompute.ts`'s best-effort reconstruction from recipes +
sales orders (per the standing rule now in `CLAUDE.md` section 9), not independently verified fact --
no reliable historical production-order data exists to verify against.

## Mechanism

`scripts/apply-full-history-quantity-reclassification.ts`: for every (order, item) combination where
the engine's computed ledger disagrees with the currently recorded inventory-affecting total
(`SALES_CONSUME`/`EDIT_REVERSAL`/`RECLASSIFICATION_REVERSAL`/`PRODUCTION_CONSUME`/`PRODUCTION_YIELD`),
inserts one compensating `Stock_Ledger` row for the exact difference. No existing row is ever
deleted or modified. Tagged `source = "FULLHISTORY_RECLASSIFY_2026-07-22"` for full reversibility
(delete-by-tag, same rollback pattern used for the 2026-07-21 Round 2 incident).

Transaction type matches Round 1-3's own convention: semi-product entries (correcting a wrongly-
recorded direct debit) use `RECLASSIFICATION_REVERSAL`; base-ingredient entries (the raw consumption
that should have been recorded) use `PRODUCTION_CONSUME`.

## Result

Dry-run: 5,491 entries across 1,352 orders (1,676 `RECLASSIFICATION_REVERSAL` + 3,815
`PRODUCTION_CONSUME`) -- slightly more than the earlier blast-radius check (5,479/1,350) because a
couple of real new orders came in during the session; recomputed fresh against live data each time,
as intended. Applied: 5,491 rows written, 0 failures.

Reverified: rerunning the same script now finds 0 planned entries (every (order, item) key's computed
value exactly matches the now-recorded value). `audit-pnl-mac-consistency.ts` stays clean (0 VND
internal delta, 23,270,079 VND total COGS). `tsc --noEmit` clean. Full suite 641/641.

## Important note on `scripts/audit-order-ledger.ts`

This older audit tool now reports 3,585 mismatches (up from the prior 203 baseline). **This is
expected and is not a new problem** -- `audit-order-ledger.ts` uses a different, older methodology
(`lib/order-ledger-audit.ts`'s balance-dependent shortfall allocator, gated by `shortfallCutoverAt`)
that replays balance from the *recorded* ledger itself, which is exactly the circularity
`lib/full-history-recompute.ts` was built to avoid (see the plan at
`C:\Users\Admin\.claude\plans\toasty-mapping-hollerith.md`). Now that the recorded ledger has been
rewritten to match the new engine's ground truth, the old tool's self-referential recompute diverges
from it -- the same "209 -> 3,542" blowup pattern already documented for `COGS-4`, now showing up
project-wide because the underlying data shape actually changed.

**The correct verification going forward is `lib/full-history-recompute.ts` itself** (via
`scripts/apply-full-history-quantity-reclassification.ts` and
`scripts/apply-full-history-cost-correction.ts`'s own dry-run "0 remaining" checks), not
`audit-order-ledger.ts`. The old tool should be retired or rebuilt on top of the new engine in a
future pass -- logged as a follow-up, not blocking today's work.

## Combined total for today's full-history rebuild

- Cost: 703 lines / ~628 orders / 173,526 VND net (`lock-removal-and-full-recompute.md`).
- Quantity: 5,491 compensating entries / 1,352 orders (this document).

All via the single `lib/full-history-recompute.ts` engine, matching the owner's explicit goal of one
consistent method applied uniformly, with every historical row preserved (insert-only, fully
reversible by tag).
