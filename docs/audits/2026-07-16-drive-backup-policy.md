# Daily Database Backup Policy

Date: 2026-07-16
Architecture: owner-account Apps Script pull to Google Drive

## Contract

- The Supabase Edge Function produces one full, schema-versioned snapshot of 27
  allowlisted tables.
- Requests require a dedicated `BACKUP_PULL_TOKEN` in `X-Backup-Token`. Google
  credentials and Supabase database credentials are never stored in Apps Script.
- The owner-account Apps Script validates all 27 table keys and per-table counts
  before writing to Drive.
- Same-day runs are idempotent: create the replacement first, then trash older
  files with the same name.
- Retention is the newest 30 matching daily backups. Unrelated Drive files are
  outside scope.
- Failures trigger `MailApp` notification to the installable-trigger owner's
  active-user email.

## Schedule

The Apps Script installable trigger runs daily around 02:30
`Asia/Ho_Chi_Minh`. It replaces the planned `pg_cron`/`pg_net` migration; there
is no production database cron migration for this architecture.

## Capacity migration trigger

Move the snapshot destination from Apps Script/Drive to Cloudflare R2 or
Backblaze B2 when the serialized daily bundle reaches **35–40 MB**, or earlier
if execution time exceeds three minutes, retention requirements grow beyond 30
daily files, or owner-account automation becomes operationally unreliable.

The threshold preserves headroom below Apps Script's 50 MB URL Fetch response
limit. The object-storage replacement should keep the same schema-versioned
bundle and 27-table validation contract.

## Security and recovery

- Rotate `BACKUP_PULL_TOKEN` if exposed and update both Supabase Secrets and
  Apps Script Properties atomically.
- The endpoint must remain POST-only and return `Cache-Control: no-store`.
- Backup creation does not mutate production database rows.
- Any restore is a separate reviewed operation with a dry-run and atomic apply
  plan; daily backup success does not authorize restoration.
