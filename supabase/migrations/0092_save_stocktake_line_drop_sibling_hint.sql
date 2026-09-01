-- Step 2 of the ingredient-group removal (OPEN-ITEMS 75), the one function
-- that used base_ingredient_id in a lookup condition, not just a pass-
-- through -- docs/superpowers/plans/2026-09-01-drop-base-ingredient-id-column.md
-- section 1.4.
--
-- BR-INV-005's refusal itself is UNCHANGED: counting more than everything
-- ever purchased is still refused unconditionally. The only thing this
-- removes is the sibling-item suggestion appended to that refusal's
-- message -- the "Mặt hàng cùng nguyên liệu gốc: ..." clause, which
-- listed other purchased items sharing the same base_ingredient_id group
-- along with their own purchased/counted totals, to help answer "did a
-- receipt get recorded against the wrong item code."
--
-- After the tier-2 group table is dropped (this task's own final
-- migration), there is nothing left in the data that says "these two
-- purchased items are the same underlying ingredient" -- matching by name
-- similarity would be a guess, and a wrong guess inside a refusal message
-- is worse than no guess at all (plan section 1.4's own conclusion).
--
-- v_base_ingredient_id, the sibling lateral-join query, and the
-- v_sibling_summary/v_sibling_clause variables are removed entirely. The
-- exception message keeps its first two sentences (the number that was
-- refused, and the "maybe a receipt got recorded against the wrong item
-- code" suggestion, which is not sibling-specific) and drops the third.
create or replace function public.save_stocktake_line_atomic(p_line_id text, p_counted_qty numeric)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
      select name into v_item_name
      from public.purchased_items where id = v_item_reference;

      raise exception 'Số đếm % vượt tổng đã mua % của % (%). Có thể đơn nhập đã bị ghi nhầm sang mã khác.',
        p_counted_qty, v_total_purchased, v_item_name, v_item_reference;
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
