-- Set the default timezone for human Supabase Dashboard sessions that connect
-- as the postgres role. App-facing roles are intentionally unchanged.
--
-- Preflight checks to run manually before deployment if needed:
--
--   SELECT current_database();
--   SHOW timezone;
--
--   SELECT rolname, rolconfig
--   FROM pg_roles
--   WHERE rolname IN ('service_role', 'authenticated', 'postgres');
--
--   SELECT now();
--   SELECT created_at
--   FROM public.orders_v2
--   ORDER BY created_at DESC
--   LIMIT 5;

do $$
begin
  execute format(
    'ALTER ROLE postgres IN DATABASE %I SET timezone TO %L',
    current_database(),
    'Asia/Ho_Chi_Minh'
  );
end $$;

-- Verification checks after deployment:
--
--   Open a fresh direct Postgres session or fresh Supabase SQL Editor tab.
--
--   SHOW timezone;
--   -- Expected: Asia/Ho_Chi_Minh
--
--   SELECT rolname, rolconfig
--   FROM pg_roles
--   WHERE rolname = 'postgres';
--
--   SELECT now();
--   SELECT created_at
--   FROM public.orders_v2
--   ORDER BY created_at DESC
--   LIMIT 5;
--
-- Reversal:
--
--   ALTER ROLE postgres IN DATABASE <db_name> RESET timezone;
