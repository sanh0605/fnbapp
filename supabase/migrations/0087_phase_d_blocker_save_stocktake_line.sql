-- Phase D blockers, function 2 of 2: save_stocktake_line_atomic.
-- docs/superpowers/plans/2026-09-01-phase-d-blockers.md section 2.2 (2).
--
-- Removes the one remaining read of stock_ledger, in the non-PURCHASED_ITEM
-- branch. Never fired for real data -- Plan D Gap 1 removed the ability to
-- open a session with a BASE_INGREDIENT/SEMI_PRODUCT line at all, so a
-- line of that item_type has never existed to reach this branch (matching
-- apply_stocktake_session_atomic's identical dead branch, migration 0086).
--
-- Worth naming precisely, unlike 0086's two sites: this one is NOT purely
-- display. v_theoretical here is persisted onto
-- stocktake_lines.theoretical_at_count, which IS what
-- apply_stocktake_session_atomic later reads to compute count_variance
-- (counted_qty - theoretical_at_count) -- the value that drives the whole
-- close. If this branch were ever exercised, changing it from a real
-- ledger sum to 0 would change count_variance for that line. It is safe
-- here specifically because it is provably unreachable, not because the
-- value doesn't matter: no session opened since Plan D Gap 1 (2026-08-07)
-- can offer a line of any type other than PURCHASED_ITEM, and no session
-- from before that gap still has an OPEN, uncounted line of that type
-- waiting to be saved (every real session on record, including the
-- oldest, STK-001, is 100% PURCHASED_ITEM -- confirmed live, not assumed).
--
-- Return shape is unchanged. Signature unchanged, so this is a plain
-- create-or-replace.
--
-- Deploy order (section 4, same as 0086): code ships before this migration
-- is applied. Not applied here.

create or replace function public.save_stocktake_line_atomic(p_line_id text, p_counted_qty numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_line_id text := nullif(btrim(coalesce(p_line_id, '')), '');
  v_session_id text;
  v_item_reference text;
  v_item_type text;
  v_session_status text;
  v_theoretical numeric(18,6);
  v_total_purchased numeric(18,6);
  v_total_issued numeric(18,6);
  v_item_name text;
  v_base_ingredient_id text;
  v_sibling_summary text;
  v_sibling_clause text;
  v_counted_at timestamptz := now();
begin
  if v_line_id is null then raise exception 'p_line_id is required'; end if;
  if p_counted_qty is null or p_counted_qty < 0 or p_counted_qty = 'NaN'::numeric then
    raise exception 'p_counted_qty must be a finite number >= 0';
  end if;

  select session_id, item_reference, item_type into v_session_id, v_item_reference, v_item_type
  from public.stocktake_lines where id = v_line_id;
  if v_session_id is null then raise exception 'Unknown stocktake line: %', v_line_id; end if;

  select status into v_session_status from public.stocktake_sessions where id = v_session_id for update;
  if v_session_status <> 'OPEN' then
    raise exception 'Stocktake session % is not open (status=%)', v_session_id, v_session_status;
  end if;

  if v_item_type = 'PURCHASED_ITEM' then
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
      select name, base_ingredient_id into v_item_name, v_base_ingredient_id
      from public.purchased_items where id = v_item_reference;

      select string_agg(
        format('%s: đã mua %s, đã đếm %s',
          pi.name,
          coalesce(sib.total_purchased, 0),
          coalesce(sess_line.counted_qty::text, 'chưa đếm')
        ),
        '; ' order by pi.name
      )
      into v_sibling_summary
      from public.purchased_items pi
      left join lateral (
        select sum(pol.base_quantity) as total_purchased
        from public.purchase_order_lines pol
        join public.purchase_orders po on po.id = pol.purchase_order_id
        where po.status = 'COMPLETED' and pol.purchased_item_id = pi.id
      ) sib on true
      left join public.stocktake_lines sess_line
        on sess_line.session_id = v_session_id and sess_line.item_reference = pi.id
      where pi.base_ingredient_id = v_base_ingredient_id
        and pi.id <> v_item_reference;

      if v_sibling_summary is null then
        v_sibling_clause := 'Không có mặt hàng nào khác cùng nguyên liệu gốc để đối chiếu.';
      else
        v_sibling_clause := 'Mặt hàng cùng nguyên liệu gốc: ' || v_sibling_summary || '.';
      end if;

      raise exception 'Số đếm % vượt tổng đã mua % của % (%). Có thể đơn nhập đã bị ghi nhầm sang mã khác. %',
        p_counted_qty, v_total_purchased, v_item_name, v_item_reference, v_sibling_clause;
    end if;
  else
    -- Phase D blocker fix: unreachable since Plan D Gap 1 (see migration
    -- header) -- was a stock_ledger sum. Would feed count_variance if ever
    -- reached, unlike 0086's two display-only sites; safe here only
    -- because this branch has 0 real invocations, confirmed live.
    v_theoretical := 0;
  end if;

  update public.stocktake_lines set
    counted_qty = p_counted_qty, theoretical_at_count = v_theoretical, counted_at = v_counted_at
  where id = v_line_id;

  return jsonb_build_object(
    'id', v_line_id, 'session_id', v_session_id, 'item_reference', v_item_reference,
    'counted_qty', p_counted_qty, 'theoretical_at_count', v_theoretical, 'counted_at', v_counted_at
  );
end;
$function$;
