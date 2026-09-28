-- BR-INV-010 (owner decision 2026-09-28): cancelling a stocktake session
-- keeps nothing. Not the session, not its counted lines, not a CANCELLED
-- status. Replaces 0061's rule ("keep it CANCELLED if anything was
-- counted") -- the owner now treats an unconfirmed count like a POS draft:
-- it never touched stock, so abandoning it leaves no record. Who may
-- cancel is unchanged: ADMIN and MANAGER (requireAdmin() in
-- app/admin/inventory/stocktake/actions.ts), which the owner confirmed the
-- same day.
--
-- Triggers, read from migration text (supabase/CLAUDE.md: no session here
-- can query pg_catalog): stocktake_sessions carries only
-- trg_stocktake_sessions_touch (0036, BEFORE UPDATE) -- this migration
-- only DELETEs sessions, so it never fires. stocktake_lines has no trigger;
-- its session_id is `on delete cascade` (0036), so the lines go with their
-- session. stock_issues.session_id references stocktake_sessions with no
-- cascade (0052): a CANCELLED session never reached apply, so none should
-- have stock_issues rows -- measured 2026-09-28, STK-002 and STK-003 have
-- none -- and the guard below refuses rather than guess if one ever does.
--
-- Writers of stocktake_sessions.status, currently live (last redefinition
-- of each): open (0052, inserts 'OPEN'), apply (0089, 'CONFIRMED'),
-- reverse (0082, 'REVERSED'), cancel (0061, 'CANCELLED' -- replaced
-- below). After this migration no writer sets 'CANCELLED', so the check
-- can drop it.
--
-- Return value: the app (cancelStocktakeSession in
-- app/admin/inventory/stocktake/actions.ts) ignores it entirely, so the
-- old and new app code both work whichever side ships first.

create or replace function public.cancel_stocktake_session_atomic(
  p_session_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text := nullif(btrim(coalesce(p_session_id, '')), '');
  v_status text;
begin
  if v_session_id is null then raise exception 'p_session_id is required'; end if;

  select status into v_status from public.stocktake_sessions where id = v_session_id for update;
  if v_status is null then raise exception 'Unknown session_id: %', v_session_id; end if;
  if v_status <> 'OPEN' then raise exception 'Session % is not open (status=%)', v_session_id, v_status; end if;

  delete from public.stocktake_sessions where id = v_session_id;
  return jsonb_build_object('id', v_session_id, 'status', 'DELETED', 'deleted', true);
end;
$$;

revoke all on function public.cancel_stocktake_session_atomic(text)
  from public, anon, authenticated;
grant execute on function public.cancel_stocktake_session_atomic(text)
  to service_role;

do $$
declare
  v_fed text;
begin
  select string_agg(distinct s.id, ', ') into v_fed
  from public.stock_issues si
  join public.stocktake_sessions s on s.id = si.session_id
  where s.status = 'CANCELLED';
  if v_fed is not null then
    raise exception 'Cancelled stocktake sessions with stock_issues rows, not deleting: %', v_fed;
  end if;
end;
$$;

delete from public.stocktake_sessions where status = 'CANCELLED';

alter table public.stocktake_sessions
  drop constraint stocktake_sessions_status_check;
alter table public.stocktake_sessions
  add constraint stocktake_sessions_status_check
  check (status in ('OPEN', 'CONFIRMED', 'REVERSED'));
