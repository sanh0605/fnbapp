-- 0117: take every table and function right away from the API roles (audit E9, 2026-10-14).
--
-- Measured read-only on the live database 2026-10-14:
--   * every public table has row-level security ON and ZERO policies, so anon and
--     authenticated already cannot read or write rows through the API;
--   * six tables still carried full grants (incl. TRUNCATE, which RLS does not stop):
--     asset_depreciation_bands, asset_disposals, assets, order_payments, outlets,
--     purchase_order_edits;
--   * rls_auto_enable (SECURITY DEFINER) and touch_updated_at were executable by anon;
--   * default privileges for postgres in public granted all on new tables, functions
--     and sequences to anon and authenticated, which is how those tables got grants.
--
-- Why safe: the app uses only the service-role key on the server and never the anon
-- key; RLS already blocks rows. service_role grants are NOT touched. Trigger and
-- event-trigger functions check EXECUTE when the trigger is created, not when it
-- fires, so the existing triggers keep working.
--
-- Idempotent: REVOKE on a right that is not held is a no-op, so it can be re-run.
--
-- Limits: this runs as postgres, so default privileges of supabase_admin cannot be
-- changed here (that would fail) and are left alone. PostgreSQL's built-in PUBLIC
-- execute default on new functions is global; a schema-scoped revoke cannot remove
-- it, and the global form would also strip it from functions postgres creates in
-- other schemas (extensions). So every new function keeps its own explicit
-- "revoke ... from public, anon, authenticated", as every migration since 0091 does.

revoke all on table public.asset_depreciation_bands from anon, authenticated;
revoke all on table public.asset_disposals from anon, authenticated;
revoke all on table public.assets from anon, authenticated;
revoke all on table public.order_payments from anon, authenticated;
revoke all on table public.outlets from anon, authenticated;
revoke all on table public.purchase_order_edits from anon, authenticated;

-- Looked up by name: both were created by 0001 / 0022, and a signature guess
-- would make the migration fail if the platform version differs.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('rls_auto_enable', 'touch_updated_at')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
  end loop;
end
$$;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
