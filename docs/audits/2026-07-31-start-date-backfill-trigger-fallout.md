# Audit: the `start_date` backfill tripped the backdating trigger

**Date:** 2026-07-31
**Reviewer:** Opus 5 coordinator
**Subject:** commits `7364ffe`, `c000c96`, `acf2a68` (Tasks 1-3 of
`docs/superpowers/plans/2026-07-31-recipe-start-date-backfill-and-not-null.md`)
**Owner decision, 2026-07-31:** let the 03:00 cron run and compare the result
tomorrow, rather than clearing the events tonight.

---

## Verdict on the code

The implementation is correct and every verification claim in the three commit
messages was independently reproduced:

| Claim | Result |
|---|---|
| 939/939 tests pass | Confirmed — 162 files, 939 tests |
| `npx tsc --noEmit` clean | Confirmed — 0 errors |
| 0 rows with `start_date IS NULL` | Confirmed — 139 recipes, 0 null |
| Migrations `0048`-`0051` applied | Confirmed — local/remote match through `0051` |
| The plan named the wrong trigger function | Confirmed. The plan's `0049` snippet
targeted `detect_backdated_recipe_entry`, which is the *trigger*; the function is
`flag_backdated_recipe_entry()`. Applying the plan verbatim would have created an
unused function and left the real one untouched — a migration that applies
cleanly and does nothing. The implementer caught this. |
| The `hong-luc-migration.ts:785` guard is now unreachable | Confirmed by trace —
`selectEffectiveRecipe` throws on a missing `start_date` before that guard runs |

Scoping `0051`'s constraint to `status = 'ACTIVE'` was a deliberate,
well-documented deviation from the plan, and the right one: it lets `RC-033` and
`RC-036` keep their impossible intervals on record as evidence.

## The defect neither the plan nor the review caught

`0043` creates the trigger `after insert **or update** on public.recipes`. The
Task 1 backfill issued 124 `UPDATE`s, each writing an old `created_at` value into
`start_date`. The trigger's threshold test —
`coalesce(new.start_date, new.created_at) < now() - interval '5 minutes'` —
was therefore true for every one of them.

Production state immediately after the backfill: **132 `PENDING` rows in
`backdated_recipe_events`**, all created 2026-07-31, the bulk of them within the
same two seconds as the backfill run (11:54 UTC). The remainder came from the
live form tests (`RC-039`) and from Task 6 flipping `RC-033`/`RC-036` to
`INACTIVE` — also `UPDATE`s, also caught by the same trigger.

The plan's own "Verification bar" said MAC/COGS drift audits were not required
because "nothing in this plan changes stock deduction or cost." That is true of
the data the backfill wrote. It is not true of what the backfill *set in motion*.

**This is a repeat of a failure already written down in this repo.**
`docs/OPEN-ITEMS.md` item 2 records 1,389 stale `PENDING` rows in
`backdated_ledger_events`, spurious detections that the 2026-07-24 rebuild
triggered on itself: "harmless, but while they sit there nobody can see whether a
real event is stuck." The same mechanism, on the recipe table, one file away from
the plan being written.

## What the 03:00 cron will do

`vercel.json` schedules `/api/cron/apply-backdated-corrections` at `0 20 * * *`
(20:00 UTC = 03:00 Vietnam). It sweeps every `PENDING` event, dry-runs a
recompute, and then either applies it, flags it, or marks it no-change.
`lib/backdated-ledger/anomaly-threshold.ts` only blocks plans affecting more than
20 lines, moving more than 20,000 VND, or changing a single line by more than
20%.

Dry-run of **all 132** pending events (read-only, no writes):

| Predicted outcome | Count | Meaning |
|---|---|---|
| `no_change` | 115 | Marked recomputed, nothing written — these leave the queue on their own |
| `flagged` | 15 | Over the 20-line threshold — cost data untouched, but the event is stamped `is_anomalous` and stays `PENDING`, so it surfaces as a dashboard alert and is re-dry-run every night |
| **`would_apply`** | **2** | **22 historical order lines rewritten automatically, no human approval** |

The alert flood is therefore 15, not ~130: the majority of the spurious events
self-clear on the first sweep because the recipes they name have no affected
order lines. That is a smaller blast radius than the raw event count suggests.

The two that auto-apply:

- **Nước đường** (`RC-004`) — 18 order lines
- **Kem dẻo CT3** (`RC-007`) — 4 order lines

For each, `recomputeRecipeEventApply` rewrites `recipe_snapshot_json` on those
lines and then adjusts `cost_at_sale` through
`apply_backdated_recipe_event_recovery`.

The money at stake is negligible — the deltas are on the order of 1e-6 VND,
floating-point residue from the 2026-07-30 exact-cost precision work, not real
cost movement. The largest flagged deltas (`Cốt cà phê` at 14.8 VND across 869
lines) are the same residue at scale.

**The concern is not the amount. It is that a change certified "behaviour-neutral"
scheduled an unreviewed automatic write to historical sales data.** The 20-line
threshold is what prevented this from being large, and that threshold was tuned
for a different purpose entirely.

The full 132-event prediction, including the exact before/after cost of every
line the cron will rewrite, is captured in
`docs/audits/2026-07-31-backdated-recipe-events-before-cron.json` — recorded
before the sweep so tomorrow's actual result can be diffed against it.

## Secondary findings

**Test data left in production master data.** Semi-products "Test lần 2"
(`BTP-016`) and "Test Task6 Step8" (`BTP-017`) are `ACTIVE` in the real catalogue,
along with recipes `RC-033` through `RC-040`. "Test" (`BTP-015`) is `DELETED` but
its recipe `RC-035` is still `ACTIVE` with a `start_date` of 2026-08-31 — the
exact shape of the "deleted-semi-product trap" the plan documents at Task 6 Step
6. Nothing is broken (no stock, no orders), but this is clutter in the data the
whole audit program is trying to make trustworthy.

**Inconsistent strictness in `selectEffectiveRecipe`.** It now throws when
`start_date` is missing, but the pre-existing `Number.isFinite(startMs)` branch
still silently treats an *unparseable* `start_date` as effective, and the sort
comparator's `new Date(left.start_date!)` then yields `NaN` comparisons. Strict
about the null it can no longer encounter, permissive about the malformed value
it still can. Not a regression — the same gap existed before — but the new
comment claims a rigour the code does not have.

**Task 5 was never run, and production now has data in the path it was meant to
audit.** Task 5 exists to measure whether `findLatestActiveRecipe` (which sorts by
`created_at` and ignores effectiveness) and the `end_date` close-out behave
correctly for future-dated recipes. `RC-038` and `RC-035` now carry `start_date`
2026-08-31. The unmeasured path has live rows in it.

**Tracking debt.** None of the eight commits made 2026-07-31 updated
`DEVELOPMENT-TRACKING.md` or `docs/OPEN-ITEMS.md`, which
`CLAUDE.md` section 0 requires in the same commit that changes an item's state.

## The generalisable lesson

Before any bulk `UPDATE` on a table, list that table's triggers and ask what each
one does with the rows being touched. `recipes` carries an `after insert or
update` trigger that feeds an automated, write-authorised nightly correction
sweep. Nothing in the plan's file list, interface list, or verification bar would
ever have surfaced that, because the plan reasoned about *the column* and the
danger lived in *the table*.
