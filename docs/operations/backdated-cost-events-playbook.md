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

## Known open finding (not yet investigated or corrected)

The 2026-07-21 dry run surfaced that several broadly-shared raw ingredients
(`NNL-002`, `NNL-001`, `ING-003`, `ING-006`, `ING-004`, `ING-020`, `ING-015`,
`ING-022`, `ING-016`) have unflagged seed-era PO_RECEIPT rows going back to
2026-03, and a full recompute against them would touch 600+ historical
"migrated" order lines with deltas up to tens of thousands of VND on some
lines. This suggests a large number of migrated historical orders'
`cost_at_sale` may not reflect a true MAC recomputation at all (a different,
much bigger question than backdating detection). Not investigated in depth
or corrected -- see `docs/ROADMAP.md` for current status before starting
any work here; do not backfill these items with the normal mechanism.
