# Playbook: Unflagged Backdated Cost Events (cost_at_sale drift with no event row)

Read this whenever `cost_at_sale` on an order line doesn't match a fresh
recompute, and the line has no matching row in `backdated_ledger_events` or
`backdated_recipe_events`. This has happened twice (2026-07-20 recipe
versions, 2026-07-21 PO receipts) and will happen again for any data that
predates the detection triggers below -- follow this instead of re-deriving
the approach from scratch.

## Why this happens

Two DB triggers auto-detect backdating going forward and create a `PENDING`
event for review/auto-apply:

- `flag_backdated_ledger_entry()` (`supabase/migrations/0014`) -- fires on
  `stock_ledger` inserts of type `PO_RECEIPT`/`STOCK_ADJUST`/
  `PRODUCTION_YIELD`/`INITIAL_BALANCE` whose `created_at` is more than 5
  minutes before the real insert time.
- `flag_backdated_recipe_entry()` (`supabase/migrations/0027`) -- same idea
  for `recipes` inserts (semi-product recipe version changes).

A daily cron (`app/api/cron/apply-backdated-corrections`, needs `CRON_SECRET`
set in Vercel) auto-applies routine `PENDING` events and flags anomalous
ones (`lib/backdated-ledger/anomaly-threshold.ts`: >20,000 VND total delta,
>20% single-line change, or >20 affected lines) for human review at
`/admin/audit/backdated-ledger`.

**Both triggers only fire on rows inserted after the trigger existed.** Any
PO_RECEIPT/recipe row inserted before its trigger was deployed -- including
all seed/migrated historical data -- got no event, even if it was itself
backdated. These show up later as a `cost_at_sale` mismatch with no
explaining event, once some order's implicit-yield/production-on-shortfall
recompute touches that item.

## Step 1: Find them (read-only)

Use `scripts/investigate-18-unflagged-cost-mismatches.ts` as the template
(despite the name, rerun it fresh each time -- the count grows as new
orders consume old backdated batches). It finds orders with a
`BTP_SHORTFALL`/implicit-yield line, recomputes the correct cost, and
reports any line where recomputed != stored. Cross-check each against
`backdated_ledger_events`/`backdated_recipe_events` by `stock_ledger_id`/
`recipe_id` to confirm it's genuinely unflagged (not just pending).

## Step 2: Before backfilling, check the blast radius

**This is the mistake made on 2026-07-21 -- do not repeat it.** The normal
backfill pattern (one event per item, anchored at that item's earliest
unflagged receipt, then let `findAffectedLines` compute the full recompute
window) is only safe when the causal item's unflagged receipts are recent
and narrow. For a raw ingredient used broadly across the whole menu, the
earliest unflagged receipt can date back to the original data migration
(seen: 2026-03), and anchoring there makes `findAffectedLines` recompute
**every** order since then that touched that item -- hundreds of historical
"migrated" order lines, many with deltas in the thousands of VND, none of
which were part of the actual investigation.

Before running any backfill with `--apply`, always dry-run first and read
the "N unflagged receipts total for this item" and "Affected lines: X, cost
changes: Y" lines. If Y is roughly the count you already expected from Step
1, it's narrow -- proceed. If Y is dramatically larger (seen: 300+ where 1
was expected), stop and do not apply.

- **Narrow (safe to backfill normally):** one event per item via the
  standard `recomputeEventApply`/`recomputeRecipeEventApply` pipeline.
  Template: `scripts/apply-backfill-nnl007-ledger-event.ts` (2026-07-21) and
  `scripts/apply-backfill-recipe-backdated-events.ts` (2026-07-20).
- **Broad (do NOT use the item+time-window mechanism):** compute the
  correct cost directly per known line via `computeSaleTimeCogs` (bypasses
  `findAffectedLines` entirely, so no other line can be touched no matter
  how shared the ingredient is), then apply through the same audited RPCs
  (`apply_backdated_event_recovery` + `mark_backdated_event_recomputed`)
  with a manually-supplied single-line change and a lightweight event row
  used only for the audit trail. Template:
  `scripts/apply-targeted-cost-correction-shared-ingredient-lines.ts`
  (2026-07-21).

Either way: dry-run, confirm the numbers match what Step 1 found, only then
`--apply`. Reverify afterward with `scripts/investigate-18-unflagged-cost-mismatches.ts`
(expect 0), `scripts/audit-pnl-mac-consistency.ts` (expect 0 VND delta), and
`scripts/verify-all-479-clean.ts` or `scripts/audit-order-ledger.ts` (expect
the same known baseline mismatch count, not a new one).

## Resolved: migrated-order MAC accuracy (2026-07-21)

The wide-blast-radius items flagged above (`NNL-002`, `NNL-001`, `ING-003`,
`ING-006`, `ING-004`, `ING-020`, `ING-015`, `ING-022`, `ING-016`) turned out
to matter most for `ord-migrated-*` orders (bulk-imported historical data).
Investigated in full via `scripts/investigate-migrated-orders-mac-accuracy.ts`:
751 migrated orders, 1,038 lines, all fully checkable (an earlier claim that
926 of them lacked usable recipe data was wrong -- it came from a diagnostic
checking a nonexistent field name, `base_ingredients` instead of the real
`variant.ingredients`; always verify a "no data" finding against the actual
production parser, not an ad hoc check, before reporting it). 214 lines
mismatched (606,287 VND sum of absolute deltas, +438,131 VND net), corrected
directly per-line via `scripts/apply-migrated-orders-mac-correction.ts`
(same bypass-`findAffectedLines` pattern as the shared-ingredient template
above). Verified 0 mismatches remain afterward.

Separately, the 41-line Task 3.9 `BACKDATED_LEDGER_HISTORICAL_GAP` lock
cohort (`docs/audits/2026-07-16-task-3.9-lock-result.md`, previously left
locked under an "accept as drift" decision) was recovered the same night,
once the owner confirmed the same backdated-PO-timestamp trust established
earlier in the session also covered those 5 receipts. Used the existing
`apply_mac_drift_recovery` RPC (migration `0016`) directly with the exact
values already recorded in `audit_baseline_locks` from the original
2026-07-16 review -- no fresh recompute needed. Template:
`scripts/apply-task-3.9-historical-gap-recovery.ts`. If a similar lock
cohort surfaces again, check `audit_baseline_locks` first for an
already-approved plan before building a new one.
