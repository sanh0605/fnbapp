-- Adds the same anomaly-classification columns already present on the new
-- backdated_recipe_events table (migration 0027) to the existing
-- backdated_ledger_events table, so a single cron sweep can classify and
-- report on both event kinds (PO_RECEIPT-style and recipe-version-style
-- backdating) uniformly.

alter table public.backdated_ledger_events
  add column if not exists is_anomalous boolean not null default false,
  add column if not exists anomaly_reason text;
