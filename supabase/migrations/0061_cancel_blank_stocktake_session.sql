-- Plan D D12: a cancelled stocktake session that counted nothing should not
-- keep consuming an STK- number forever. Design:
-- docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md section 8,
-- D12.
--
-- Trigger check re-verified live immediately before writing this migration:
-- stocktake_sessions carries only trg_stocktake_sessions_touch (BEFORE
-- UPDATE, harmless -- still fires for the "keep, mark CANCELLED" branch,
-- unaffected by this change); stocktake_lines has none.
-- stocktake_lines.session_id already has `on delete cascade`
-- (0036_stocktake_sessions.sql:50), so deleting the session row deletes its
-- lines with it, nothing extra needed here.
--
-- The owner rejected the earlier defense of keeping every cancelled
-- session (analogy to a cancelled invoice keeping its number): a cancelled
-- invoice consumes its number because the transaction happened. Opening a
-- count screen and closing it with nothing counted is a blank form thrown
-- away -- no line counted, no stock touched, no money moved. Not a breach
-- of "never delete master data" (CLAUDE.md section 2) -- an empty draft is
-- not a business record; the protected list is ingredients, products,
-- recipes, orders and suppliers.
--
-- Rule: a session with at least one counted line (counted_qty is not null
-- on any of its lines) is kept, marked CANCELLED, exactly as before --
-- someone really counted something and then abandoned it, which is a fact
-- worth keeping. A session with zero counted lines is deleted outright,
-- freeing its STK- number (ids derive from max(existing)+1, so nothing
-- needs a separate sequence reset).
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
  v_any_counted boolean;
begin
  if v_session_id is null then raise exception 'p_session_id is required'; end if;

  select status into v_status from public.stocktake_sessions where id = v_session_id for update;
  if v_status is null then raise exception 'Unknown session_id: %', v_session_id; end if;
  if v_status <> 'OPEN' then raise exception 'Session % is not open (status=%)', v_session_id, v_status; end if;

  select exists (
    select 1 from public.stocktake_lines
    where session_id = v_session_id and counted_qty is not null
  ) into v_any_counted;

  if v_any_counted then
    update public.stocktake_sessions set status = 'CANCELLED' where id = v_session_id;
    return jsonb_build_object('id', v_session_id, 'status', 'CANCELLED', 'deleted', false);
  else
    delete from public.stocktake_sessions where id = v_session_id;
    return jsonb_build_object('id', v_session_id, 'status', 'CANCELLED', 'deleted', true);
  end if;
end;
$$;

revoke all on function public.cancel_stocktake_session_atomic(text)
  from public, anon, authenticated;
grant execute on function public.cancel_stocktake_session_atomic(text)
  to service_role;
