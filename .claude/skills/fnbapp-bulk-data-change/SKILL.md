---
name: fnbapp-bulk-data-change
description: Use before any bulk write to production data in fnbapp - backfills, migrations that touch existing rows, historical reprocessing, or any script run with --apply. Covers the trigger and downstream-automation checks that a "behaviour-neutral" change can still set off.
---

# Bulk data change

A change can be provably neutral in the rows it writes and still cause damage
through what those writes set in motion. This happened on 2026-07-31: a
backfill of 124 rows was correct in every value it wrote, and it still created
132 spurious detection events and scheduled an unreviewed rewrite of historical
sales data.

Work through all five before writing anything.

## 1. List the target table's triggers

For every table the change writes to:

```sql
select tgname, pg_get_triggerdef(oid)
  from pg_trigger
 where tgrelid = 'public.<table>'::regclass and not tgisinternal;
```

For each trigger, state in one sentence what it will do with the rows being
touched. **Pay particular attention to `after insert or update`** — an `UPDATE`
that merely fills in a column still fires it.

## 2. Follow what the triggers feed

A trigger that writes to a queue table is only half the story. Find what reads
that queue, and state what it will do with the rows the change creates.

**Measured 2026-08-26: this repository has no scheduled job at all.**
`app/api/cron/` is empty and `vercel.json` is `{}`. So today the only thing a
trigger can do is act inside your own transaction.

**Do not trust the previous sentence without re-checking it.** Until 2026-08-26
this section described a nightly 03:00 sweep of `backdated_ledger_events` and
`backdated_recipe_events` that could rewrite `cost_at_sale` on historical order
lines. That machinery was retired by Plan C Task 6 — the route is gone and
**neither table exists** — but the warning stayed here for weeks, in the one
document meant to make bulk writes safe. A safety note describing a danger that
no longer exists is worse than none: it makes the reader believe the dangers are
known.

**The live example to reason from instead.** Every table with an
`updated_at` column carries a `BEFORE UPDATE ... touch_updated_at()` trigger
(`trg_orders_v2_touch`, `trg_purchased_items_touch`, and siblings). It feeds no
queue and starts nothing — but it **will** move `updated_at` on every row the
change touches. Renaming 2.376 order codes on 2026-08-25 moved all 2.376. That
is a side effect to declare in the report, never to avoid by disabling the
trigger.

## 3. Prove neutrality per row, not by argument

Replay the real decision the change is supposed to leave untouched, across every
affected record, before and after. Report the count compared and the count that
differed. "Differences: 0" is only meaningful next to the number checked — a
vacuous zero from comparing nothing is the failure mode to guard against, and it
has occurred here.

## 4. Dry run by default

`--apply` is required to write. Before writing, print the exact count and the
first several targets. After writing, re-read and confirm the expected end
state.

## 5. Report the side effects, not just the writes

Say what else changed: rows added to queue tables, events raised, automation now
scheduled. A report that lists only the intended writes is incomplete.
