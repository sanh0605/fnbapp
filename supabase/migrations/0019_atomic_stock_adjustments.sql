-- Complete the canonical stock-adjustment schema and persist each approval
-- together with its inventory ledger effect in one transaction.

alter table public.stock_adjustments
  add column if not exists item_reference text not null,
  add column if not exists theoretical_qty numeric(18,6),
  add column if not exists actual_qty numeric(18,6),
  add column if not exists difference numeric(18,6) not null,
  add column if not exists approved_by text;

create or replace function public.submit_stock_adjustment_atomic(
  p_adjustment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adjustment_id text;
  v_ledger_id text;
  v_item_reference text;
  v_difference numeric;
  v_created_at timestamptz;
  v_next_adjustment integer;
  v_next_ledger integer;
begin
  if p_adjustment is null or jsonb_typeof(p_adjustment) <> 'object' then
    raise exception 'p_adjustment must be a JSON object';
  end if;
  v_item_reference := nullif(btrim(p_adjustment->>'item_reference'), '');
  v_difference := nullif(p_adjustment->>'difference', '')::numeric;
  if v_item_reference is null then
    raise exception 'p_adjustment.item_reference is required';
  end if;
  if v_difference is null then
    raise exception 'p_adjustment.difference is required';
  end if;
  if nullif(btrim(p_adjustment->>'reason'), '') is null then
    raise exception 'p_adjustment.reason is required';
  end if;
  if coalesce(p_adjustment->>'status', '') <> 'APPROVED' then
    raise exception 'p_adjustment.status must be APPROVED';
  end if;
  v_created_at := coalesce(
    nullif(p_adjustment->>'created_at', '')::timestamptz,
    now()
  );

  perform pg_advisory_xact_lock(hashtext('stock_adjustments:id'));
  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));

  select coalesce(max(substring(id from '^SADJ-([0-9]+)$')::integer), 0) + 1
  into v_next_adjustment
  from public.stock_adjustments
  where id ~ '^SADJ-[0-9]+$';
  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0) + 1
  into v_next_ledger
  from public.stock_ledger
  where id ~ '^STK-[0-9]+$';

  v_adjustment_id := 'SADJ-' || lpad(v_next_adjustment::text, 3, '0');
  v_ledger_id := 'STK-' || lpad(v_next_ledger::text, 3, '0');

  insert into public.stock_adjustments (
    id, item_reference, theoretical_qty, actual_qty, difference, reason,
    status, created_by_id, created_by_name, created_at, approved_by,
    approved_at, notes
  ) values (
    v_adjustment_id,
    v_item_reference,
    nullif(p_adjustment->>'theoretical_qty', '')::numeric,
    nullif(p_adjustment->>'actual_qty', '')::numeric,
    v_difference,
    p_adjustment->>'reason',
    'APPROVED',
    nullif(p_adjustment->>'created_by_id', ''),
    nullif(p_adjustment->>'created_by_name', ''),
    v_created_at,
    nullif(p_adjustment->>'approved_by', ''),
    coalesce(nullif(p_adjustment->>'approved_at', '')::timestamptz, v_created_at),
    nullif(p_adjustment->>'notes', '')
  );

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change,
    unit_cost, created_at
  ) values (
    v_ledger_id,
    'STOCK_ADJUST',
    v_adjustment_id,
    v_item_reference,
    v_difference,
    0,
    v_created_at
  );

  return jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'ledger_count', 1,
    'already_completed', false
  );
end;
$$;

create or replace function public.approve_stock_adjustment_atomic(
  p_adjustment_id text,
  p_approved_by text,
  p_approved_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_item_reference text;
  v_difference numeric;
  v_ledger_count integer;
  v_matching_ledger_count integer;
  v_next_ledger integer;
  v_ledger_id text;
begin
  if nullif(btrim(p_adjustment_id), '') is null then
    raise exception 'p_adjustment_id is required';
  end if;
  if nullif(btrim(p_approved_by), '') is null then
    raise exception 'p_approved_by is required';
  end if;

  select status, item_reference, difference
  into v_status, v_item_reference, v_difference
  from public.stock_adjustments
  where id = p_adjustment_id
  for update;
  if not found then
    raise exception 'Stock adjustment % not found', p_adjustment_id;
  end if;
  if v_status = 'REJECTED' then
    raise exception 'Rejected stock adjustment % cannot be approved', p_adjustment_id;
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where item_reference = v_item_reference
        and quantity_change = v_difference
    )::integer
  into v_ledger_count, v_matching_ledger_count
  from public.stock_ledger
  where reference_id = p_adjustment_id
    and transaction_type = 'STOCK_ADJUST';

  if v_ledger_count > 0 then
    if v_ledger_count <> 1 or v_matching_ledger_count <> 1 or v_status <> 'APPROVED' then
      raise exception 'Stock adjustment % has an inconsistent ledger state', p_adjustment_id;
    end if;
    return jsonb_build_object(
      'adjustment_id', p_adjustment_id,
      'ledger_count', 1,
      'already_completed', true
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));
  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0) + 1
  into v_next_ledger
  from public.stock_ledger
  where id ~ '^STK-[0-9]+$';
  v_ledger_id := 'STK-' || lpad(v_next_ledger::text, 3, '0');

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change,
    unit_cost, created_at
  ) values (
    v_ledger_id,
    'STOCK_ADJUST',
    p_adjustment_id,
    v_item_reference,
    v_difference,
    0,
    coalesce(p_approved_at, now())
  );

  update public.stock_adjustments
  set
    status = 'APPROVED',
    approved_by = p_approved_by,
    approved_at = coalesce(p_approved_at, now())
  where id = p_adjustment_id;

  return jsonb_build_object(
    'adjustment_id', p_adjustment_id,
    'ledger_count', 1,
    'already_completed', false
  );
end;
$$;

revoke all on function public.submit_stock_adjustment_atomic(jsonb) from public;
revoke all on function public.submit_stock_adjustment_atomic(jsonb) from anon;
revoke all on function public.submit_stock_adjustment_atomic(jsonb) from authenticated;
grant execute on function public.submit_stock_adjustment_atomic(jsonb) to service_role;

revoke all on function public.approve_stock_adjustment_atomic(text, text, timestamptz) from public;
revoke all on function public.approve_stock_adjustment_atomic(text, text, timestamptz) from anon;
revoke all on function public.approve_stock_adjustment_atomic(text, text, timestamptz) from authenticated;
grant execute on function public.approve_stock_adjustment_atomic(text, text, timestamptz) to service_role;
