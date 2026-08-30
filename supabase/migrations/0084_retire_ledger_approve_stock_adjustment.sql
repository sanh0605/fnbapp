-- Stock ledger retirement, Phase C, function 7 of 8: approve_stock_adjustment_atomic.
-- docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md section 5.
--
-- Removes the stock_ledger insert. Like submit (commit 6/8), this has
-- never run for real data -- stock_adjustments has 0 rows in production.
--
-- Its idempotency check is redesigned, not just trimmed: the live function
-- detected "already approved" by SELECTing a matching STOCK_ADJUST row from
-- stock_ledger for this adjustment_id. Once nothing is ever written there,
-- that check would always read 0 rows and treat every call as brand new --
-- silently degrading instead of correctly staying idempotent, exactly what
-- section 5.4's "throw, not degrade" principle warns against. Since commit
-- 6/8's submit_stock_adjustment_atomic already always leaves a new
-- adjustment in status = 'APPROVED' (never PENDING), that column is a
-- direct, already-available substitute: idempotency is now checked against
-- stock_adjustments.status = 'APPROVED' instead of a stock_ledger read.
-- This is a real behavior change to the idempotency mechanism, not a
-- mechanical deletion -- called out explicitly because zero real
-- invocations exist to have depended on the old mechanism.
--
-- ledger_count dropped from the return entirely, same as commit 6/8 (it
-- was hardcoded to 1, never a real row-count guard).
--
-- Signature unchanged, so this is a plain create-or-replace.
--
-- Deploy order (section 5.7): application code must stop reading
-- result.ledgerCount BEFORE this migration is applied.

create or replace function public.approve_stock_adjustment_atomic(p_adjustment_id text, p_approved_by text, p_approved_at timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
begin
  if nullif(btrim(p_adjustment_id), '') is null then
    raise exception 'p_adjustment_id is required';
  end if;
  if nullif(btrim(p_approved_by), '') is null then
    raise exception 'p_approved_by is required';
  end if;

  select status
  into v_status
  from public.stock_adjustments
  where id = p_adjustment_id
  for update;
  if not found then
    raise exception 'Stock adjustment % not found', p_adjustment_id;
  end if;
  if v_status = 'REJECTED' then
    raise exception 'Rejected stock adjustment % cannot be approved', p_adjustment_id;
  end if;

  if v_status = 'APPROVED' then
    return jsonb_build_object(
      'adjustment_id', p_adjustment_id,
      'already_completed', true
    );
  end if;

  update public.stock_adjustments
  set
    status = 'APPROVED',
    approved_by = p_approved_by,
    approved_at = coalesce(p_approved_at, now())
  where id = p_adjustment_id;

  return jsonb_build_object(
    'adjustment_id', p_adjustment_id,
    'already_completed', false
  );
end;
$function$;

revoke all on function public.approve_stock_adjustment_atomic(text, text, timestamptz) from public;
revoke all on function public.approve_stock_adjustment_atomic(text, text, timestamptz) from anon;
revoke all on function public.approve_stock_adjustment_atomic(text, text, timestamptz) from authenticated;
grant execute on function public.approve_stock_adjustment_atomic(text, text, timestamptz) to service_role;
