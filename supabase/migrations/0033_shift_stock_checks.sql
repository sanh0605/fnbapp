-- Shift stock checks: open/close a work shift with a physical count of a
-- small, name-configured set of items (currently Trứng luộc, Khoai lang --
-- see lib/shift-stock-check-config.ts), recorded against the same
-- theoretical-stock calculation used everywhere else (running sum of
-- Stock_Ledger.quantity_change). Read/record only -- never writes to
-- Stock_Ledger itself; correcting real stock still goes through the
-- existing Cân bằng kho (stock adjustment) flow. Single shared warehouse,
-- no outlet/branch dimension (matches how inventory is tracked everywhere
-- else in this app today).

create table if not exists public.shifts (
  id text primary key,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED')),
  opened_by_id text not null,
  opened_by_name text not null,
  opened_at timestamptz not null default now(),
  closed_by_id text,
  closed_by_name text,
  closed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- DB-level backstop (in addition to the RPC's advisory lock) -- at most one
-- shift open at any time.
create unique index if not exists idx_shifts_one_open
  on public.shifts (status) where status = 'OPEN';
create index if not exists idx_shifts_opened_at on public.shifts(opened_at desc);

drop trigger if exists trg_shifts_touch on public.shifts;
create trigger trg_shifts_touch before update on public.shifts
  for each row execute function public.touch_updated_at();

alter table public.shifts enable row level security;
revoke all on table public.shifts from public, anon, authenticated;
grant select, insert, update on table public.shifts to service_role;

create table if not exists public.shift_stock_checks (
  id text primary key,
  shift_id text not null references public.shifts(id) on delete restrict,
  item_reference text not null,
  checkpoint text not null check (checkpoint in ('OPEN','CLOSE')),
  counted_qty numeric(18,6) not null,
  theoretical_qty numeric(18,6) not null,
  variance numeric(18,6) not null,
  checked_by_id text not null,
  checked_by_name text not null,
  checked_at timestamptz not null default now()
);
create index if not exists idx_shift_stock_checks_shift on public.shift_stock_checks(shift_id);
create index if not exists idx_shift_stock_checks_item on public.shift_stock_checks(item_reference);

alter table public.shift_stock_checks enable row level security;
revoke all on table public.shift_stock_checks from public, anon, authenticated;
grant select, insert on table public.shift_stock_checks to service_role;

-- ============================================================
-- open_shift_stock_check_atomic
-- ============================================================
create or replace function public.open_shift_stock_check_atomic(
  p_opened_by_id text,
  p_opened_by_name text,
  p_checks jsonb,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opened_by_id text := nullif(btrim(coalesce(p_opened_by_id, '')), '');
  v_opened_by_name text := nullif(btrim(coalesce(p_opened_by_name, '')), '');
  v_existing_open_id text;
  v_shift_id text;
  v_next_shift_number integer;
  v_next_check_number integer;
  v_opened_at timestamptz := now();
  v_check_id text;
  v_theoretical_qty numeric(18,6);
  v_variance numeric(18,6);
  v_check record;
  v_result_checks jsonb := '[]'::jsonb;
begin
  if v_opened_by_id is null then raise exception 'p_opened_by_id is required'; end if;
  if v_opened_by_name is null then raise exception 'p_opened_by_name is required'; end if;
  if p_checks is null or jsonb_typeof(p_checks) <> 'array' then
    raise exception 'p_checks must be a JSON array';
  end if;
  if jsonb_array_length(p_checks) = 0 then
    raise exception 'p_checks must contain at least one item';
  end if;

  perform pg_advisory_xact_lock(hashtext('shift_stock_check:open'));

  select id into v_existing_open_id from public.shifts where status = 'OPEN' limit 1;
  if v_existing_open_id is not null then
    raise exception 'A shift is already open (shift_id=%)', v_existing_open_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('shifts:id'));
  select coalesce(max(substring(id from '^SHF-([0-9]+)$')::integer), 0) + 1
  into v_next_shift_number from public.shifts where id ~ '^SHF-[0-9]+$';
  v_shift_id := 'SHF-' || lpad(v_next_shift_number::text, 3, '0');

  insert into public.shifts (id, status, opened_by_id, opened_by_name, opened_at, notes)
  values (v_shift_id, 'OPEN', v_opened_by_id, v_opened_by_name, v_opened_at, coalesce(p_notes, ''));

  perform pg_advisory_xact_lock(hashtext('shift_stock_checks:id'));
  select coalesce(max(substring(id from '^CHK-([0-9]+)$')::integer), 0)
  into v_next_check_number from public.shift_stock_checks where id ~ '^CHK-[0-9]+$';

  for v_check in
    select * from jsonb_to_recordset(p_checks) as x(item_reference text, counted_qty numeric)
  loop
    if nullif(btrim(coalesce(v_check.item_reference, '')), '') is null then
      raise exception 'Each check requires an item_reference';
    end if;
    if v_check.counted_qty is null or v_check.counted_qty < 0 then
      raise exception 'counted_qty for % must be >= 0', v_check.item_reference;
    end if;

    select coalesce(sum(quantity_change), 0) into v_theoretical_qty
    from public.stock_ledger where item_reference = v_check.item_reference;
    v_variance := v_check.counted_qty - v_theoretical_qty;

    v_next_check_number := v_next_check_number + 1;
    v_check_id := 'CHK-' || lpad(v_next_check_number::text, 4, '0');

    insert into public.shift_stock_checks (
      id, shift_id, item_reference, checkpoint, counted_qty, theoretical_qty,
      variance, checked_by_id, checked_by_name, checked_at
    ) values (
      v_check_id, v_shift_id, v_check.item_reference, 'OPEN', v_check.counted_qty,
      v_theoretical_qty, v_variance, v_opened_by_id, v_opened_by_name, v_opened_at
    );

    v_result_checks := v_result_checks || jsonb_build_object(
      'id', v_check_id, 'item_reference', v_check.item_reference,
      'counted_qty', v_check.counted_qty, 'theoretical_qty', v_theoretical_qty,
      'variance', v_variance
    );
  end loop;

  return jsonb_build_object(
    'id', v_shift_id, 'status', 'OPEN', 'opened_by_id', v_opened_by_id,
    'opened_by_name', v_opened_by_name, 'opened_at', v_opened_at,
    'notes', coalesce(p_notes, ''), 'checks', v_result_checks
  );
end;
$$;

revoke all on function public.open_shift_stock_check_atomic(text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.open_shift_stock_check_atomic(text, text, jsonb, text)
  to service_role;

-- ============================================================
-- close_shift_stock_check_atomic
-- ============================================================
create or replace function public.close_shift_stock_check_atomic(
  p_shift_id text,
  p_closed_by_id text,
  p_closed_by_name text,
  p_checks jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift_id text := nullif(btrim(coalesce(p_shift_id, '')), '');
  v_closed_by_id text := nullif(btrim(coalesce(p_closed_by_id, '')), '');
  v_closed_by_name text := nullif(btrim(coalesce(p_closed_by_name, '')), '');
  v_status text;
  v_closed_at timestamptz := now();
  v_next_check_number integer;
  v_check_id text;
  v_theoretical_qty numeric(18,6);
  v_variance numeric(18,6);
  v_check record;
  v_result_checks jsonb := '[]'::jsonb;
begin
  if v_shift_id is null then raise exception 'p_shift_id is required'; end if;
  if v_closed_by_id is null or v_closed_by_name is null then
    raise exception 'p_closed_by_id and p_closed_by_name are required';
  end if;
  if p_checks is null or jsonb_typeof(p_checks) <> 'array' then
    raise exception 'p_checks must be a JSON array';
  end if;
  if jsonb_array_length(p_checks) = 0 then
    raise exception 'p_checks must contain at least one item';
  end if;

  -- Row lock: mutual exclusion with a second concurrent close attempt on
  -- the same shift.
  select status into v_status from public.shifts where id = v_shift_id for update;
  if v_status is null then raise exception 'Unknown shift_id: %', v_shift_id; end if;
  if v_status <> 'OPEN' then raise exception 'Shift % is already closed', v_shift_id; end if;

  perform pg_advisory_xact_lock(hashtext('shift_stock_checks:id'));
  select coalesce(max(substring(id from '^CHK-([0-9]+)$')::integer), 0)
  into v_next_check_number from public.shift_stock_checks where id ~ '^CHK-[0-9]+$';

  for v_check in
    select * from jsonb_to_recordset(p_checks) as x(item_reference text, counted_qty numeric)
  loop
    if nullif(btrim(coalesce(v_check.item_reference, '')), '') is null then
      raise exception 'Each check requires an item_reference';
    end if;
    if v_check.counted_qty is null or v_check.counted_qty < 0 then
      raise exception 'counted_qty for % must be >= 0', v_check.item_reference;
    end if;

    select coalesce(sum(quantity_change), 0) into v_theoretical_qty
    from public.stock_ledger where item_reference = v_check.item_reference;
    v_variance := v_check.counted_qty - v_theoretical_qty;

    v_next_check_number := v_next_check_number + 1;
    v_check_id := 'CHK-' || lpad(v_next_check_number::text, 4, '0');

    insert into public.shift_stock_checks (
      id, shift_id, item_reference, checkpoint, counted_qty, theoretical_qty,
      variance, checked_by_id, checked_by_name, checked_at
    ) values (
      v_check_id, v_shift_id, v_check.item_reference, 'CLOSE', v_check.counted_qty,
      v_theoretical_qty, v_variance, v_closed_by_id, v_closed_by_name, v_closed_at
    );

    v_result_checks := v_result_checks || jsonb_build_object(
      'id', v_check_id, 'item_reference', v_check.item_reference,
      'counted_qty', v_check.counted_qty, 'theoretical_qty', v_theoretical_qty,
      'variance', v_variance
    );
  end loop;

  update public.shifts set
    status = 'CLOSED', closed_by_id = v_closed_by_id, closed_by_name = v_closed_by_name,
    closed_at = v_closed_at,
    notes = case when nullif(btrim(coalesce(p_notes, '')), '') is not null then p_notes else notes end
  where id = v_shift_id;

  return jsonb_build_object(
    'id', v_shift_id, 'status', 'CLOSED', 'closed_by_id', v_closed_by_id,
    'closed_by_name', v_closed_by_name, 'closed_at', v_closed_at, 'checks', v_result_checks
  );
end;
$$;

revoke all on function public.close_shift_stock_check_atomic(text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.close_shift_stock_check_atomic(text, text, text, jsonb, text)
  to service_role;
