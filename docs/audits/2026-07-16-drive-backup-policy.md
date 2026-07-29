# Daily Database Backup Policy

Date: 2026-07-16
Architecture: owner-account Apps Script pull to Google Drive

## Contract

- The Supabase Edge Function produces one full, schema-versioned snapshot of 40
  allowlisted tables.
- Requests require a dedicated `BACKUP_PULL_TOKEN` in `X-Backup-Token`. Google
  credentials and Supabase database credentials are never stored in Apps Script.
- The owner-account Apps Script validates all 40 table keys and per-table counts
  before writing to Drive.
- Same-day runs are idempotent: create the replacement first, then trash older
  files with the same name.
- Retention is 180 daily full snapshots; monthly full snapshots are retained indefinitely. The
  monthly file is replaced during each successful run, so it becomes the last
  successful snapshot of that month. Unrelated Drive files are outside scope.
- Daily and monthly files live in separate `daily/` and `monthly/` child folders
  under the configured Drive folder. Matching legacy files at the root are moved
  into the appropriate child folder on the next successful run.
- Failures trigger `MailApp` notification to the installable-trigger owner's
  active-user email.

## Schedule

The Apps Script installable trigger runs daily around 02:30
`Asia/Ho_Chi_Minh`. It replaces the planned `pg_cron`/`pg_net` migration; there
is no production database cron migration for this architecture.

## Capacity migration trigger

Start the Cloudflare R2 or Backblaze B2 migration implementation when the
serialized bundle reaches **20 MB**. Move the production destination by **25 MB**,
or earlier if execution time exceeds 90 seconds or owner-account
automation becomes operationally unreliable.

The threshold preserves headroom below Apps Script's 50 MB URL Fetch response
limit. The object-storage replacement should keep the same schema-versioned
bundle and 40-table validation contract.

## Table scope

The 40-table allowlist includes all 27 application tables from the initial
schema, five migration-added operational tables from the original policy
(`sync_state`, `data_migration_runs`, `data_recovery_changes`,
`audit_baseline_locks`, `backdated_ledger_events`), and eight tables added
2026-07-29 after a coverage gap was found ahead of the Phase 3 restore drill:
`order_payments` (payment records -- cash vs transfer, split payments; no other
source exists), `shifts`, `shift_stock_checks`, `stocktake_sessions`,
`stocktake_lines`, `backdated_recipe_events`, `purchase_order_edits`,
`pos_sync_failures`. Empty workflow tables remain included because they
may receive data later. **`inventory_balances` is deliberately excluded**: it is
derived from `stock_ledger` and rebuilt on demand by
`rebuild_inventory_balances()`, never a primary source of truth. Supabase Auth,
secrets, function deployments, and schema DDL are not part of the JSON bundle;
schema DDL remains versioned in Git.

## Security and recovery

- Rotate `BACKUP_PULL_TOKEN` if exposed and update both Supabase Secrets and
  Apps Script Properties atomically.
- The endpoint must remain POST-only and return `Cache-Control: no-store`.
- Backup creation does not mutate production database rows.
- Any restore is a separate reviewed operation with a dry-run and atomic apply
  plan; daily backup success does not authorize restoration.
