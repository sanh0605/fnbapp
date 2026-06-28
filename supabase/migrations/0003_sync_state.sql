-- Claude code — Supabase migration Phase E.
--
-- Track incremental sync cursor for backup-to-sheets edge function.
-- Each row stores last_synced_at for a sync_key (e.g., 'orders_v2').

create table if not exists public.sync_state (
  sync_key text primary key,
  last_synced_at timestamptz not null,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.sync_state enable row level security;
-- Service role bypasses RLS for edge function access.

-- ============================================================================
-- Scheduled backup cron (pg_cron)
-- ============================================================================
--
-- Enable pg_cron extension (Supabase dashboard → Database → Extensions).
-- Then run this SQL to schedule daily backup at 02:00 UTC+7 (19:00 UTC prev day):
--
--   select cron.schedule(
--     'backup-to-sheets-daily',
--     '0 19 * * *',  -- 19:00 UTC = 02:00 UTC+7 next day
--     $$
--       select net.http_post(
--         url := 'https://<project-ref>.functions.supabase.co/backup-to-sheets',
--         headers := jsonb_build_object(
--           'Authorization', 'Bearer <anon-key>'
--         ),
--         body := '{}'::jsonb
--       );
--     $$
--   );
--
-- Replace <project-ref> with `zicuawpwyhmtqmzawvau`.
-- Replace <anon-key> with project anon key (or set up auth properly).
--
-- To unschedule: select cron.unschedule('backup-to-sheets-daily');
