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
that queue. In this repository, `backdated_ledger_events` and
`backdated_recipe_events` are swept nightly at 03:00 by
`/api/cron/apply-backdated-corrections`, which can rewrite `cost_at_sale` and
`recipe_snapshot_json` on historical order lines with no human approval.

State what the downstream automation will do with the rows the change creates.

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
