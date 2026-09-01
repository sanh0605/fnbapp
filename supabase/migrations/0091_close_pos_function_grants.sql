-- Close the public/anon/authenticated execute grants on the two POS
-- checkout functions -- docs/OPEN-ITEMS.md item 81, owner-approved
-- 2026-09-02 (docs/superpowers/plans/2026-09-02-close-the-pos-function-grants.md).
--
-- Signatures re-measured live 2026-09-02 via pg_get_function_identity_arguments,
-- not copied from a migration file (section 1.5/2.2's own explicit warning:
-- a stale signature matches nothing and revokes nothing, silently). Both
-- functions share the exact same signature.
--
-- Four lines each, not the two-line pattern recent migrations use (section
-- 1.4): those two-line migrations are enough because `public` and `anon`
-- were already revoked from those functions back in 0006. These two
-- functions have never had anything revoked -- Postgres grants EXECUTE to
-- every role by default when a function is created, and that default was
-- never touched here. Dropping the `from public` line would be the easy
-- mistake: `authenticated` would lose its explicit grant, but PUBLIC's
-- still-standing default EXECUTE would let it straight back in.
--
-- Real exposure, not a live incident: the anon key that would be needed to
-- reach these functions as anon/authenticated lives only in
-- SUPABASE_ANON_KEY, server-side only -- confirmed 2026-09-02, no
-- NEXT_PUBLIC_SUPABASE* name appears anywhere in app/, lib/, or
-- components/, and the app's own Supabase client (lib/supabase.ts) uses
-- the service-role key exclusively. Closing it anyway: the key living only
-- on the server today is an operational fact, not a guarantee, and this
-- migration costs nothing to run (service_role, the only role the app
-- actually uses, keeps EXECUTE unchanged).
--
-- A second, independent layer confirmed live 2026-09-02 and worth
-- recording here since the plan itself did not measure it: both functions
-- are SECURITY INVOKER, not SECURITY DEFINER, and orders_v2/order_lines_v2/
-- order_events/pos_drafts have zero grants of any kind to anon/authenticated
-- (pg_class.relacl lists only postgres and service_role) with row level
-- security enabled and zero policies defined for any table. Even an
-- anon/authenticated caller who reached these functions today would have
-- every write inside them refused at the table level before RLS is even
-- evaluated. This does not make the EXECUTE grant closure unnecessary --
-- defense in depth, and the owner already approved this exact fix -- it
-- means the two-line "real hole, closed door" framing in the plan's own
-- section 1.3 undersold how many doors are actually in the way.
revoke all on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, text, jsonb
) from public;
revoke all on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, text, jsonb
) from anon;
revoke all on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, text, jsonb
) from authenticated;
grant execute on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, text, jsonb
) to service_role;

revoke all on function public.create_pos_order_atomic_unvalidated_0025(
  text, jsonb, jsonb, jsonb, text, jsonb
) from public;
revoke all on function public.create_pos_order_atomic_unvalidated_0025(
  text, jsonb, jsonb, jsonb, text, jsonb
) from anon;
revoke all on function public.create_pos_order_atomic_unvalidated_0025(
  text, jsonb, jsonb, jsonb, text, jsonb
) from authenticated;
grant execute on function public.create_pos_order_atomic_unvalidated_0025(
  text, jsonb, jsonb, jsonb, text, jsonb
) to service_role;

-- Found by this migration's own required sweep (plan section 2.1), not in
-- OPEN-ITEMS 81's original two: get_my_role() also carries the Postgres
-- default EXECUTE grant to public/anon/authenticated. Unlike the two POS
-- functions, it is SECURITY DEFINER, taking no arguments (`select role
-- from users where auth_id = auth.uid()`) -- callable directly via
-- PostgREST RPC by anyone holding the anon key. Confirmed live 2026-09-02:
-- referenced by zero RLS policies and zero other function bodies in this
-- schema -- this app authenticates through NextAuth against its own
-- `users` table, not Supabase Auth, so auth.uid() is never non-null for
-- this app's real traffic and this function has no live caller at all.
-- Closed in the same migration per the plan's own instruction (section
-- 1.7: "if there's a third one, handling it in the same migration is
-- cheaper") -- not granted to service_role, since nothing in this
-- codebase calls it and there is no reason to start.
revoke all on function public.get_my_role() from public;
revoke all on function public.get_my_role() from anon;
revoke all on function public.get_my_role() from authenticated;

-- Explicitly NOT touched by this migration, found by the same sweep and
-- reported rather than folded in: touch_updated_at(),
-- stock_ledger_apply_inventory_balance_delta(), and rls_auto_enable() all
-- carry the same default public/anon/authenticated EXECUTE grant, but all
-- three RETURN trigger or event_trigger -- Postgres refuses to invoke a
-- trigger/event-trigger function directly via SQL or RPC regardless of who
-- holds EXECUTE on it ("trigger functions can only be called as
-- triggers"), and PostgREST does not expose them as RPC endpoints at all.
-- Revoking their grants would remove no real exposure and risks the actual
-- trigger machinery firing on every insert/update to 19 tables including
-- orders_v2 and stock_ledger -- an unjustified risk on the money path for
-- zero security benefit. Left exactly as they are.
