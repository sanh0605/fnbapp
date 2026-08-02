# Restore drill re-run against the current schema (2026-08-02)

Task 1 of `docs/superpowers/plans/2026-08-02-cogs-plan-a-foundations.md`. The
2026-07-29 drill passed against a schema that has since changed (migrations
0042-0051 landed on production, ~10.000 more rows exist). Plan C will delete
roughly 10.000 ledger rows and ~46.000 recovery-log rows, so the way back is
re-tested before that, not assumed to still hold.

## Backup artefact identity

**Deviation from the plan's wording, noted rather than silently followed.**
The plan's Step 2 describes "the existing daily backup path" and asks for a
file name and byte size, evoking the Google Drive JSON file
(`fnbapp-backup-YYYY-MM-DD.json`). That is not what the restore drill actually
uses: `scripts/restore-backup-to-target.ts` calls `buildDatabaseSnapshot` from
`supabase/functions/backup-to-drive/core.ts` directly — the exact same
snapshot-building code the daily Drive job runs — and takes a **fresh
read-only snapshot of production at drill time**, never touching Drive. This
is what Step 3 of `docs/runbooks/restore-from-backup.md` already documents. So
the artefact this drill certifies is "the daily backup code path, exercised
now," not a specific file sitting in Drive.

- Snapshot taken: 2026-08-02, during this run.
- Tables: 40 (`BACKUP_TABLES`).
- Rows captured: 65.888 total, read-only from production.
- Restored into: scratch Supabase project (`RESTORE_TARGET_SUPABASE_URL`,
  host `ixtrfytbykjvxluhppiv.supabase.co`), confirmed distinct from
  production by `assertSafeRestoreTarget` before any connection opened.

## Preconditions handled before restoring

- Scratch project schema was at migration `0041` (left over from the
  2026-07-29 drill). Migrations `0042`-`0051` (10 pending) applied via
  `npx supabase db push --yes` against the scratch project only, dry-run
  checked first.
- Scratch project still held data from the 2026-07-29 run (61 purchase
  orders, 12.116 stock ledger rows, 130 recipes, etc. — stale, not today's
  production numbers). Cleared table-by-table in reverse `BACKUP_TABLES`
  order (children before parents) before restoring, per the runbook's
  documented incident #5.
- `RESTORE_TARGET_DIRECT_URL` needed the same two fixes the runbook already
  names as known snags: literal `[` `]` left around the password, and an
  unencoded `%` in the password requiring `encodeURIComponent` before handing
  the connection string to the Supabase CLI.

## Step 1: restore target confirmed not production

`RESTORE_TARGET_SUPABASE_URL` and `SUPABASE_URL` are both set and resolve to
two different Supabase projects. `assertSafeRestoreTarget` is still the first
call in `restore-backup-to-target.ts`, before any client (production or
target) is opened, and still throws if the target is unset or matches
production.

## Step 4: row counts, restored scratch vs. live production

`npx vite-node scripts/verify-restore-drill.ts` — **VERDICT: PASS**.

**38 of 40 tables match live production exactly** (`delta_vs_production = 0`
on every row-count line). Full table-by-table numbers:
`docs/audits/2026-07-29-phase3-restore-drill-result.json` (filename predates
this run; content is from this 2026-08-02 run — `generated_at:
2026-08-02T08:25:17.664Z`).

The two tables that differ, exactly as the plan's precomputed example
predicted:

| Table | Production now | Restored | Delta |
|---|---|---|---|
| `backdated_ledger_events` | 1.910 | 3.175 | +1.265 |
| `backdated_recipe_events` | 134 | 137 | +3 |

Cause, per `docs/runbooks/restore-from-backup.md` incident #4: `restore-backup-to-target.ts`
writes rows page-by-page, not in original chronological order. The
`detect_backdated_ledger_entry`/`detect_backdated_recipe_entry` triggers fire
on out-of-order writes and generate extra rows in these two tables. This is
restore-order noise, not data loss — no other table shows any deviation. The
restore run's own log shows 473 skipped inserts, all `duplicate key value
violates unique constraint` on these same two tables' unique indexes (the
trigger had already created a row for that `stock_ledger_id`/`recipe_id`
before the backup bundle's own row for it arrived), which is the same
mechanism reported from the other direction.

**No table matched below the 07-29 baseline of 38, and no table outside these
two deviated.** Per the plan's stop condition, this is a PASS, not a
continue-with-caution.

## Step 5: content spot-checks

All three required, run inside `verify-restore-drill.ts`:

- **PO-037** (purchase order header + all lines): header matches exactly,
  6/6 lines match exactly.
- **Split-payment order** `ord-66939489-c870-4cd3-940d-4dd7ef64d9d4`: 2
  payment rows in production, 2 in restored, content matches exactly.
- **Sữa đặc (`ING-003`) `stock_ledger` row count**: 1.663 in production,
  1.663 restored.

## Verdict

**PASS.** The restore path works against the current schema (through
migration `0051`). Plan A Task 2 may proceed.

Scratch project is left in place (restored, migrated, non-empty) rather than
deleted — the owner deletes it manually from the Supabase dashboard per the
runbook's Step 5, this agent does not delete another account's project.
