-- INV-COUNT-1 phase S1: periodic guided stocktake, counting workflow only.
-- Design: docs/superpowers/plans/2026-07-24-stocktake-and-daily-digest-plan.md
-- feature 1. Deliberately does NOT write Stock_Ledger -- that is phase S2
-- (engine-critical, separate migration + top-tier review before db push).
-- This phase only records what was physically counted, against a
-- theoretical_at_count snapshot taken at the moment each item is counted
-- (not at session-open), for display purposes -- S2 will independently
-- recompute theoretical inside its own transaction at confirm time, since
-- sales continue to happen while a count is in progress.
--
-- Deliberately blind-count: theoretical_at_count/variance are only computed
-- and shown once an item's own count is saved, never beforehand, so the
-- person counting isn't tempted to just write down the expected number.
--
-- House pattern followed exactly from 0033_shift_stock_checks.sql: RLS
-- enabled + all access revoked except service_role, security-definer RPCs
-- for every write, advisory locks for uniqueness/sequencing, sequential
-- human-readable ids.

create table if not exists public.stocktake_sessions (
  id text primary key,
  status text not null default 'OPEN' check (status in ('OPEN','CONFIRMED','CANCELLED')),
  created_by_id text not null,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  confirmed_by_id text,
  confirmed_by_name text,
  confirmed_at timestamptz,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

-- DB-level backstop (in addition to the open RPC's advisory lock) -- at most
-- one stocktake session open at any time, matching the single-shared-
-- warehouse reality (no outlet/branch dimension) this app tracks everywhere.
create unique index if not exists idx_stocktake_sessions_one_open
  on public.stocktake_sessions (status) where status = 'OPEN';
create index if not exists idx_stocktake_sessions_created_at on public.stocktake_sessions(created_at desc);

drop trigger if exists trg_stocktake_sessions_touch on public.stocktake_sessions;
create trigger trg_stocktake_sessions_touch before update on public.stocktake_sessions
  for each row execute function public.touch_updated_at();

alter table public.stocktake_sessions enable row level security;
revoke all on table public.stocktake_sessions from public, anon, authenticated;
grant select, insert, update on table public.stocktake_sessions to service_role;

create table if not exists public.stocktake_lines (
  id text primary key,
  session_id text not null references public.stocktake_sessions(id) on delete cascade,
  item_reference text not null,
  item_type text not null check (item_type in ('BASE_INGREDIENT','SEMI_PRODUCT')),
  counted_qty numeric(18,6) check (
    counted_qty is null or (counted_qty >= 0 and counted_qty <> 'NaN'::numeric)
  ),
  theoretical_at_count numeric(18,6),
  counted_at timestamptz,
  constraint stocktake_lines_count_snapshot_check check (
    (
      counted_qty is null
      and theoretical_at_count is null
      and counted_at is null
    )
    or
    (
      counted_qty is not null
      and theoretical_at_count is not null
      and theoretical_at_count <> 'NaN'::numeric
      and counted_at is not null
    )
  )
);
create index if not exists idx_stocktake_lines_session on public.stocktake_lines(session_id);
-- One line per item per session -- open_stocktake_session_atomic seeds every
-- inventory-tracked item exactly once.
create unique index if not exists idx_stocktake_lines_session_item
  on public.stocktake_lines(session_id, item_reference);

alter table public.stocktake_lines enable row level security;
revoke all on table public.stocktake_lines from public, anon, authenticated;
grant select, insert, update on table public.stocktake_lines to service_role;

-- ============================================================
-- open_stocktake_session_atomic
-- ============================================================
-- p_items is computed in JS from the same inventory-tracked-item filter
-- getRealtimeStock uses (is_non_inventory base ingredients excluded, all
-- semi-products included) rather than re-deriving that business rule in SQL
-- -- mirrors 0033's p_checks-computed-in-JS shape.
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
    if v_item.item_type not in ('BASE_INGREDIENT', 'SEMI_PRODUCT') then
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

-- ============================================================
-- save_stocktake_line_atomic
-- ============================================================
-- theoretical_at_count is computed here, inside the transaction, from the
-- live Stock_Ledger running sum -- never trusts a client-supplied value.
create or replace function public.save_stocktake_line_atomic(
  p_line_id text,
  p_counted_qty numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line_id text := nullif(btrim(coalesce(p_line_id, '')), '');
  v_session_id text;
  v_item_reference text;
  v_session_status text;
  v_theoretical numeric(18,6);
  v_counted_at timestamptz := now();
begin
  if v_line_id is null then raise exception 'p_line_id is required'; end if;
  if p_counted_qty is null or p_counted_qty < 0 or p_counted_qty = 'NaN'::numeric then
    raise exception 'p_counted_qty must be a finite number >= 0';
  end if;

  select session_id, item_reference into v_session_id, v_item_reference
  from public.stocktake_lines where id = v_line_id;
  if v_session_id is null then raise exception 'Unknown stocktake line: %', v_line_id; end if;

  select status into v_session_status from public.stocktake_sessions where id = v_session_id for update;
  if v_session_status <> 'OPEN' then
    raise exception 'Stocktake session % is not open (status=%)', v_session_id, v_session_status;
  end if;

  select coalesce(sum(quantity_change), 0) into v_theoretical
  from public.stock_ledger where item_reference = v_item_reference;

  update public.stocktake_lines set
    counted_qty = p_counted_qty, theoretical_at_count = v_theoretical, counted_at = v_counted_at
  where id = v_line_id;

  return jsonb_build_object(
    'id', v_line_id, 'session_id', v_session_id, 'item_reference', v_item_reference,
    'counted_qty', p_counted_qty, 'theoretical_at_count', v_theoretical, 'counted_at', v_counted_at
  );
end;
$$;

revoke all on function public.save_stocktake_line_atomic(text, numeric)
  from public, anon, authenticated;
grant execute on function public.save_stocktake_line_atomic(text, numeric)
  to service_role;

-- ============================================================
-- cancel_stocktake_session_atomic
-- ============================================================
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

  update public.stocktake_sessions set status = 'CANCELLED' where id = v_session_id;

  return jsonb_build_object('id', v_session_id, 'status', 'CANCELLED');
end;
$$;

revoke all on function public.cancel_stocktake_session_atomic(text)
  from public, anon, authenticated;
grant execute on function public.cancel_stocktake_session_atomic(text)
  to service_role;
