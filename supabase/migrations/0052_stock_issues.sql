-- Issue-based COGS, Plan B Task 2: somewhere to record an issue.
-- Design: docs/superpowers/specs/2026-08-02-issue-based-cogs-design.md
-- Plan: docs/superpowers/plans/2026-08-04-cogs-plan-b-parallel-path.md
--
-- Triggers on the two tables this migration touches, checked live against
-- production before writing this file (supabase db query --linked):
--   stock_ledger: detect_backdated_ledger_entry (AFTER INSERT),
--     trg_stock_ledger_inventory_balances (AFTER INSERT OR DELETE OR UPDATE
--     OF item_reference, quantity_change). This migration inserts nothing
--     into stock_ledger, so neither fires.
--   stocktake_lines: no triggers.
-- stock_issues is a new table with no triggers of its own.

-- ============================================================
-- stock_issues: purchased-item-level issue events. Deliberately separate
-- from stock_ledger, which stays untouched by this table's writes.
-- ============================================================
create table if not exists public.stock_issues (
  id text primary key,
  purchased_item_id text not null,
  issued_at timestamptz not null,
  base_quantity numeric(18,6) not null check (base_quantity > 0 and base_quantity <> 'NaN'::numeric),
  source text not null check (source in ('STOCKTAKE', 'MANUAL')),
  session_id text references public.stocktake_sessions(id),
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_issues_purchased_item on public.stock_issues(purchased_item_id);
create index if not exists idx_stock_issues_session on public.stock_issues(session_id);

alter table public.stock_issues enable row level security;
revoke all on table public.stock_issues from public, anon, authenticated;
grant select, insert on table public.stock_issues to service_role;

-- ============================================================
-- Widen stocktake_lines.item_type to accept PURCHASED_ITEM.
-- Same constraint name kept so a future reader finds one constraint, not
-- two generations of it.
-- ============================================================
alter table public.stocktake_lines drop constraint stocktake_lines_item_type_check;
alter table public.stocktake_lines add constraint stocktake_lines_item_type_check
  check (item_type in ('BASE_INGREDIENT', 'SEMI_PRODUCT', 'PURCHASED_ITEM'));

-- ============================================================
-- Widen the allow-list inside open_stocktake_session_atomic. The table
-- constraint above is not the only gate -- this function carried its own
-- hardcoded list (0036_stocktake_sessions.sql:146-147) and would otherwise
-- reject every session containing a PURCHASED_ITEM line before it reached
-- the table at all.
-- ============================================================
create or replace function public.open_stocktake_session_atomic(
  p_created_by_id text,
  p_created_by_name text,
  p_items jsonb,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_existing_open_id text;
  v_session_id text;
  v_next_session_number integer;
  v_next_line_number integer;
  v_created_at timestamptz := now();
  v_line_id text;
  v_item record;
begin
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must contain at least one item';
  end if;

  perform pg_advisory_xact_lock(hashtext('stocktake_session:open'));

  select id into v_existing_open_id from public.stocktake_sessions where status = 'OPEN' limit 1;
  if v_existing_open_id is not null then
    raise exception 'A stocktake session is already open (session_id=%)', v_existing_open_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('stocktake_sessions:id'));
  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0) + 1
  into v_next_session_number from public.stocktake_sessions where id ~ '^STK-[0-9]+$';
  v_session_id := 'STK-' || lpad(v_next_session_number::text, 3, '0');

  insert into public.stocktake_sessions (id, status, created_by_id, created_by_name, created_at, notes)
  values (v_session_id, 'OPEN', v_created_by_id, v_created_by_name, v_created_at, coalesce(p_notes, ''));

  perform pg_advisory_xact_lock(hashtext('stocktake_lines:id'));
  select coalesce(max(substring(id from '^SKL-([0-9]+)$')::integer), 0)
  into v_next_line_number from public.stocktake_lines where id ~ '^SKL-[0-9]+$';

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(item_reference text, item_type text)
  loop
    if nullif(btrim(coalesce(v_item.item_reference, '')), '') is null then
      raise exception 'Each item requires an item_reference';
    end if;
    if v_item.item_type not in ('BASE_INGREDIENT', 'SEMI_PRODUCT', 'PURCHASED_ITEM') then
      raise exception 'Invalid item_type for %: %', v_item.item_reference, v_item.item_type;
    end if;

    v_next_line_number := v_next_line_number + 1;
    v_line_id := 'SKL-' || lpad(v_next_line_number::text, 5, '0');

    insert into public.stocktake_lines (id, session_id, item_reference, item_type)
    values (v_line_id, v_session_id, v_item.item_reference, v_item.item_type);
  end loop;

  return jsonb_build_object(
    'id', v_session_id, 'status', 'OPEN', 'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name, 'created_at', v_created_at,
    'notes', coalesce(p_notes, '')
  );
end;
$$;

revoke all on function public.open_stocktake_session_atomic(text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.open_stocktake_session_atomic(text, text, jsonb, text)
  to service_role;
