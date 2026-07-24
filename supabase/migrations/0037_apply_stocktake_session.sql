-- INV-COUNT-1 phase S2: atomically confirm a stocktake session and write
-- only its server-saved count-time variance. This preserves legitimate
-- ledger movements recorded after a physical item count.

create or replace function public.apply_stocktake_session_atomic(
  p_session_id text,
  p_confirmed_by_id text,
  p_confirmed_by_name text,
  p_dry_run boolean default false,
  p_expected_plan_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text := nullif(btrim(coalesce(p_session_id, '')), '');
  v_confirmed_by_id text := nullif(btrim(coalesce(p_confirmed_by_id, '')), '');
  v_confirmed_by_name text := nullif(btrim(coalesce(p_confirmed_by_name, '')), '');
  v_status text;
  v_confirmed_at timestamptz := now();
  v_next_ledger_number integer;
  v_ledger_id text;
  v_ledger_count integer := 0;
  v_line record;
  v_current_theoretical_qty numeric(18,6);
  v_count_variance numeric(18,6);
  v_projected_qty numeric(18,6);
  v_rows jsonb := '[]'::jsonb;
  v_plan_hash_rows jsonb := '[]'::jsonb;
  v_plan_hash text;
  v_ledger_ids jsonb := '[]'::jsonb;
begin
  if v_session_id is null then raise exception 'p_session_id is required'; end if;
  if v_confirmed_by_id is null then raise exception 'p_confirmed_by_id is required'; end if;
  if v_confirmed_by_name is null then raise exception 'p_confirmed_by_name is required'; end if;

  select status into v_status
  from public.stocktake_sessions
  where id = v_session_id
  for update;
  if v_status is null then raise exception 'Unknown stocktake session: %', v_session_id; end if;
  if v_status <> 'OPEN' then
    raise exception 'Stocktake session % cannot be applied (status=%)', v_session_id, v_status;
  end if;

  -- Serialize ID allocation with every existing stock-ledger writer and lock
  -- all count lines under the already-locked session before building a plan.
  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));
  perform 1
  from public.stocktake_lines
  where session_id = v_session_id
  for update;

  if not p_dry_run then
    select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0)
    into v_next_ledger_number
    from public.stock_ledger
    where id ~ '^STK-[0-9]+$';
  end if;

  for v_line in
    select id, item_reference, item_type, counted_qty, theoretical_at_count
    from public.stocktake_lines
    where session_id = v_session_id
      and counted_qty is not null
    order by id
  loop
    -- Current theoretical is read fresh for the confirmation preview. The
    -- adjustment itself uses the count-time delta so later ledger movements
    -- remain intact after this session is applied.
    select coalesce(sum(quantity_change), 0)
    into v_current_theoretical_qty
    from public.stock_ledger
    where item_reference = v_line.item_reference;

    v_count_variance := v_line.counted_qty - v_line.theoretical_at_count;
    v_projected_qty := v_current_theoretical_qty + v_count_variance;

    if v_count_variance = 0 then
      continue;
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'line_id', v_line.id,
      'item_reference', v_line.item_reference,
      'item_type', v_line.item_type,
      'counted_qty', v_line.counted_qty,
      'theoretical_at_count', v_line.theoretical_at_count,
      'current_theoretical_qty', v_current_theoretical_qty,
      'count_variance', v_count_variance,
      'projected_qty', v_projected_qty
    ));
    v_plan_hash_rows := v_plan_hash_rows || jsonb_build_array(jsonb_build_object(
      'line_id', v_line.id,
      'item_reference', v_line.item_reference,
      'counted_qty', v_line.counted_qty,
      'theoretical_at_count', v_line.theoretical_at_count,
      'count_variance', v_count_variance
    ));

    if p_dry_run then
      continue;
    end if;

    v_next_ledger_number := v_next_ledger_number + 1;
    v_ledger_id := 'STK-' || lpad(v_next_ledger_number::text, 3, '0');
    insert into public.stock_ledger (
      id, transaction_type, reference_id, item_reference, quantity_change,
        unit_cost, created_at, notes
    ) values (
      v_ledger_id,
      'STOCK_ADJUST',
      v_session_id,
      v_line.item_reference,
      v_count_variance,
      0,
      v_confirmed_at,
      'Kiểm kê định kỳ ' || to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
    );
    v_ledger_count := v_ledger_count + 1;
    v_ledger_ids := v_ledger_ids || jsonb_build_array(v_ledger_id);
  end loop;

  v_plan_hash := md5(v_plan_hash_rows::text);

  if p_dry_run then
    return jsonb_build_object(
      'session_id', v_session_id,
      'status', 'OPEN',
      'dry_run', true,
      'ledger_count', jsonb_array_length(v_rows),
      'rows', v_rows,
      'plan_hash', v_plan_hash,
      'ledger_ids', v_ledger_ids
    );
  end if;

  if nullif(btrim(coalesce(p_expected_plan_hash, '')), '') is null then
    raise exception 'p_expected_plan_hash is required when applying a stocktake';
  end if;
  if p_expected_plan_hash <> v_plan_hash then
    raise exception 'Stocktake plan changed; request a new preview before applying';
  end if;

  update public.stocktake_sessions set
    status = 'CONFIRMED',
    confirmed_by_id = v_confirmed_by_id,
    confirmed_by_name = v_confirmed_by_name,
    confirmed_at = v_confirmed_at
  where id = v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'status', 'CONFIRMED',
    'dry_run', false,
    'ledger_count', v_ledger_count,
    'rows', v_rows,
    'plan_hash', v_plan_hash,
    'ledger_ids', v_ledger_ids
  );
end;
$$;

revoke all on function public.apply_stocktake_session_atomic(text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.apply_stocktake_session_atomic(text, text, text, boolean, text)
  to service_role;
