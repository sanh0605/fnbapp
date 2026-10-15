-- Drops cash_entries.payer: reserved in 0101 and never used. Measured on the
-- linked server 2026-10-15: 0 non-null on 41 rows, no view or function reads it.
-- Triggers on cash_entries (queried 2026-10-15): only trg_cash_entries_touch,
-- BEFORE UPDATE, sets updated_at; this migration updates no row, so it never fires.
-- Run only after the code without `payer` is deployed.
alter table public.cash_entries drop column if exists payer;
