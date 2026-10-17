-- supabase/migrations/0137_stocktake_package_counts.sql
-- BR-INV-023 (plan docs/superpowers/plans/2026-10-17-kiem-ke-tu-luu.md). NOT YET RUN on the server.
--
--   1. stocktake_lines.package_counts jsonb: what was typed per package size, {"<conversion id>": whole packages}.
--      Nullable, no default, no backfill (lines counted before this keep a total and no split).
--   2. save_stocktake_line_atomic gets a third argument p_package_counts (default null). A null
--      p_counted_qty now clears the line back to "not counted" (counted_qty, theoretical_at_count,
--      counted_at, package_counts all null); the session must still be OPEN.
--
-- Triggers on stocktake_lines: none found in migrations (grep of create trigger ... stocktake_lines).
-- No SQL function calls save_stocktake_line_atomic (grep); only lib/stock/stocktake-transaction.ts does,
-- so dropping the 2-argument version is safe. Run this BEFORE pushing the code that sends p_package_counts.
-- Body otherwise copied from 0136.

alter table public.stocktake_lines add column package_counts jsonb;

drop function public.save_stocktake_line_atomic(text, numeric);

create function public.save_stocktake_line_atomic(p_line_id text, p_counted_qty numeric, p_package_counts jsonb default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_line_id text := nullif(btrim(coalesce(p_line_id, '')), '');
  v_session_id text;
  v_item_reference text;
  v_session_status text;
  v_theoretical numeric(18,6);
  v_total_purchased numeric(18,6);
  v_total_issued numeric(18,6);
  v_item_name text;
  v_counted_at timestamptz := now();
begin
  if v_line_id is null then raise exception 'p_line_id is required'; end if;
  if p_counted_qty < 0 or p_counted_qty = 'NaN'::numeric then
    raise exception 'p_counted_qty must be a finite number >= 0';
  end if;

  select session_id, item_reference into v_session_id, v_item_reference
  from public.stocktake_lines where id = v_line_id;
  if v_session_id is null then raise exception 'Unknown stocktake line: %', v_line_id; end if;

  select status into v_session_status from public.stocktake_sessions where id = v_session_id for update;
  if v_session_status <> 'OPEN' then
    raise exception 'Stocktake session % is not open (status=%)', v_session_id, v_session_status;
  end if;

  if p_counted_qty is null then
    update public.stocktake_lines set
      counted_qty = null, theoretical_at_count = null, counted_at = null, package_counts = null
    where id = v_line_id;

    return jsonb_build_object(
      'id', v_line_id, 'session_id', v_session_id, 'item_reference', v_item_reference,
      'counted_qty', null, 'theoretical_at_count', null, 'counted_at', null
    );
  end if;

  select coalesce(sum(pol.base_quantity), 0)
  into v_total_purchased
  from public.purchase_order_lines pol
  join public.purchase_orders po on po.id = pol.purchase_order_id
  where po.status = 'COMPLETED' and pol.purchased_item_id = v_item_reference;

  select coalesce(sum(base_quantity), 0)
  into v_total_issued
  from public.stock_issues
  where purchased_item_id = v_item_reference;

  v_theoretical := v_total_purchased - v_total_issued;

  -- BR-INV-005: counted more than everything ever purchased is still
  -- refused unconditionally -- no amount of "found" stock explains more
  -- than was ever bought. counted > v_theoretical but <= v_total_purchased
  -- falls through with no exception: BR-INV-008, goods found.
  if p_counted_qty > v_total_purchased then
    select name into v_item_name
    from public.purchased_items where id = v_item_reference;

    raise exception 'Số đếm % vượt tổng đã mua % của % (%). Có thể đơn nhập đã bị ghi nhầm sang mã khác.',
      p_counted_qty, v_total_purchased, v_item_name, v_item_reference;
  end if;

  update public.stocktake_lines set
    counted_qty = p_counted_qty, theoretical_at_count = v_theoretical, counted_at = v_counted_at,
    package_counts = p_package_counts
  where id = v_line_id;

  return jsonb_build_object(
    'id', v_line_id, 'session_id', v_session_id, 'item_reference', v_item_reference,
    'counted_qty', p_counted_qty, 'theoretical_at_count', v_theoretical, 'counted_at', v_counted_at
  );
end;
$function$;

revoke all on function public.save_stocktake_line_atomic(text, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_stocktake_line_atomic(text, numeric, jsonb)
  to service_role;
