-- Stock ledger retirement, Phase C, function 6 of 8: submit_stock_adjustment_atomic.
-- docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md section 5.
--
-- Removes the stock_ledger insert. stock_adjustments has 0 rows in
-- production (verified live before Phase B) -- this function has never
-- run for real data. It always inserts the stock_adjustments row with
-- status = 'APPROVED' directly (never PENDING), which is what makes commit
-- 7/8's redesign of approve_stock_adjustment_atomic's idempotency check
-- correct: submit already leaves every adjustment in a terminal state.
--
-- ledger_count dropped from the return entirely -- it was hardcoded to 1,
-- not derived from a row count, so there was never a real guard value
-- here to begin with.
--
-- Signature unchanged, so this is a plain create-or-replace.
--
-- Deploy order (section 5.7): application code must stop reading
-- result.ledgerCount BEFORE this migration is applied, since the field
-- disappears from the return value.

create or replace function public.submit_stock_adjustment_atomic(p_adjustment jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_adjustment_id text;
  v_item_reference text;
  v_difference numeric;
  v_created_at timestamptz;
  v_next_adjustment integer;
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

  select coalesce(max(substring(id from '^SADJ-([0-9]+)$')::integer), 0) + 1
  into v_next_adjustment
  from public.stock_adjustments
  where id ~ '^SADJ-[0-9]+$';

  v_adjustment_id := 'SADJ-' || lpad(v_next_adjustment::text, 3, '0');

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

  return jsonb_build_object(
    'adjustment_id', v_adjustment_id,
    'already_completed', false
  );
end;
$function$;

revoke all on function public.submit_stock_adjustment_atomic(jsonb) from public;
revoke all on function public.submit_stock_adjustment_atomic(jsonb) from anon;
revoke all on function public.submit_stock_adjustment_atomic(jsonb) from authenticated;
grant execute on function public.submit_stock_adjustment_atomic(jsonb) to service_role;
