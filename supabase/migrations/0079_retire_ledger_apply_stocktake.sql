-- Stock ledger retirement, Phase C, function 2 of 8: apply_stocktake_session_atomic.
-- docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md section 5.
--
-- This function has two stock_ledger write sites, not one -- section 2d
-- flags it as "not a mechanical migration" for exactly this reason:
--
--   1. The per-line loop's non-PURCHASED_ITEM branch (a BASE_INGREDIENT or
--      SEMI_PRODUCT line counted directly). Never fired for real data --
--      all 50 real stocktake lines are PURCHASED_ITEM type (section 2d.3)
--      -- but still live code, reachable if a direct BASE_INGREDIENT/
--      SEMI_PRODUCT count line is ever entered.
--   2. The second loop, which aggregates PURCHASED_ITEM lines up to their
--      base_ingredient_id and books an ingredient-level correction. This
--      is the one that produced the real 38 STK- rows.
--
-- Both writes are removed. The PURCHASED_ITEM branch's stock_issues insert
-- (the real COGS path) is untouched -- section 5.5 scope. The ingredient
-- correction's COMPUTATION stays, and the row still appears in the
-- returned `rows` array with its own count_variance/projected_qty, because
-- it has real reporting value for the owner (section 2d.3) even though
-- nothing is persisted for it anymore. ledger_count keeps counting these
-- rows (still a valid structural check against `rows`); ledger_ids is
-- removed from the contract since nothing is ever inserted to give an id
-- to -- same as 0076 did for issue slips' ledger_id.
--
-- What this migration deliberately does NOT touch, per section 2d.3: the
-- two SELECT reads from stock_ledger that compute a "current theoretical
-- qty" display value for BASE_INGREDIENT/SEMI_PRODUCT lines. Once nothing
-- writes to stock_ledger, those reads return an increasingly stale number.
-- That is flagged in the plan as needing separate verification, independent
-- of phases B-D, and is out of scope here.
--
-- Deploy order (section 5.7): application code must stop reading
-- result.ledger_ids BEFORE this migration is applied, since the field
-- disappears from the return value. p_dry_run/p_expected_plan_hash are
-- unchanged in shape, so the plan_hash contract is unaffected.

create or replace function public.apply_stocktake_session_atomic(p_session_id text, p_confirmed_by_id text, p_confirmed_by_name text, p_dry_run boolean DEFAULT false, p_expected_plan_hash text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session_id text := nullif(btrim(coalesce(p_session_id, '')), '');
  v_confirmed_by_id text := nullif(btrim(coalesce(p_confirmed_by_id, '')), '');
  v_confirmed_by_name text := nullif(btrim(coalesce(p_confirmed_by_name, '')), '');
  v_status text;
  v_confirmed_at timestamptz := now();
  v_next_issue_number integer;
  v_issue_id text;
  v_issue_note text;
  v_ledger_count integer := 0;
  v_issue_count integer := 0;
  v_line record;
  v_current_theoretical_qty numeric(18,6);
  v_total_purchased numeric(18,6);
  v_total_issued numeric(18,6);
  v_count_variance numeric(18,6);
  v_projected_qty numeric(18,6);
  v_rows jsonb := '[]'::jsonb;
  v_plan_hash_rows jsonb := '[]'::jsonb;
  v_plan_hash text;
  v_issue_ids jsonb := '[]'::jsonb;
  v_ingredient record;
  v_ingredient_incomplete boolean;
  v_ingredient_summed_counted numeric(18,6);
  v_ingredient_current_theoretical numeric(18,6);
  v_ingredient_variance numeric(18,6);
  v_skipped_ingredients jsonb := '[]'::jsonb;
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

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform 1
  from public.stocktake_lines
  where session_id = v_session_id
  for update;

  if not p_dry_run then
    select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
    into v_next_issue_number
    from public.stock_issues
    where id ~ '^ISS-[0-9]+$';
  end if;

  for v_line in
    select id, item_reference, item_type, counted_qty, theoretical_at_count
    from public.stocktake_lines
    where session_id = v_session_id
      and counted_qty is not null
    order by id
  loop
    if v_line.item_type = 'PURCHASED_ITEM' then
      select coalesce(sum(pol.base_quantity), 0)
      into v_total_purchased
      from public.purchase_order_lines pol
      join public.purchase_orders po on po.id = pol.purchase_order_id
      where po.status = 'COMPLETED' and pol.purchased_item_id = v_line.item_reference;

      select coalesce(sum(base_quantity), 0)
      into v_total_issued
      from public.stock_issues
      where purchased_item_id = v_line.item_reference;

      v_current_theoretical_qty := v_total_purchased - v_total_issued;
    else
      select coalesce(sum(quantity_change), 0)
      into v_current_theoretical_qty
      from public.stock_ledger
      where item_reference = v_line.item_reference;
    end if;

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

    if v_line.item_type = 'PURCHASED_ITEM' then
      v_issue_count := v_issue_count + 1;
    else
      v_ledger_count := v_ledger_count + 1;
    end if;

    if p_dry_run then
      continue;
    end if;

    if v_line.item_type = 'PURCHASED_ITEM' then
      v_next_issue_number := v_next_issue_number + 1;
      v_issue_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');
      if v_count_variance > 0 then
        -- BR-INV-008: counted more than theoretical -- goods found, not a
        -- shortfall. base_quantity below is negative (-v_count_variance);
        -- say so in the note, since a negative issue row would otherwise
        -- read as a data error months later.
        v_issue_note := 'Hàng tìm lại được (BR-INV-008) -- kiểm kê định kỳ ' ||
          to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
      else
        v_issue_note := 'Kiểm kê định kỳ ' || to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
      end if;
      insert into public.stock_issues (
        id, purchased_item_id, issued_at, base_quantity, source, session_id, note
      ) values (
        v_issue_id,
        v_line.item_reference,
        v_confirmed_at,
        -v_count_variance,
        'STOCKTAKE',
        v_session_id,
        v_issue_note
      );
      v_issue_ids := v_issue_ids || jsonb_build_array(v_issue_id);
    end if;
    -- BASE_INGREDIENT/SEMI_PRODUCT direct counts no longer write to
    -- stock_ledger (this migration). Already counted into v_ledger_count
    -- above; the row is already in v_rows above.
  end loop;

  for v_ingredient in
    select distinct bi.id as ingredient_id
    from public.stocktake_lines sl
    join public.purchased_items pi on pi.id = sl.item_reference
    join public.base_ingredients bi on bi.id = pi.base_ingredient_id
    where sl.session_id = v_session_id
      and sl.item_type = 'PURCHASED_ITEM'
      and sl.counted_qty is not null
    order by bi.id
  loop
    select exists (
      select 1
      from public.stocktake_lines sl2
      join public.purchased_items pi2 on pi2.id = sl2.item_reference
      where sl2.session_id = v_session_id
        and sl2.item_type = 'PURCHASED_ITEM'
        and pi2.base_ingredient_id = v_ingredient.ingredient_id
        and sl2.counted_qty is null
    ) into v_ingredient_incomplete;

    if v_ingredient_incomplete then
      v_skipped_ingredients := v_skipped_ingredients || jsonb_build_array(jsonb_build_object(
        'ingredient_id', v_ingredient.ingredient_id,
        'reason', 'not_every_purchased_item_counted'
      ));
      continue;
    end if;

    select coalesce(sum(sl3.counted_qty), 0)
    into v_ingredient_summed_counted
    from public.stocktake_lines sl3
    join public.purchased_items pi3 on pi3.id = sl3.item_reference
    where sl3.session_id = v_session_id
      and sl3.item_type = 'PURCHASED_ITEM'
      and pi3.base_ingredient_id = v_ingredient.ingredient_id;

    select coalesce(sum(quantity_change), 0)
    into v_ingredient_current_theoretical
    from public.stock_ledger
    where item_reference = v_ingredient.ingredient_id;

    -- S6 fix: sum of each line's own FROZEN count_variance, not
    -- summed_counted minus a fresh ledger re-read (see migration header).
    -- v_ingredient_current_theoretical is kept only for the row's own
    -- display fields (theoretical_at_count/current_theoretical_qty/
    -- projected_qty) -- it no longer participates in the variance itself.
    select coalesce(sum(sl4.counted_qty - sl4.theoretical_at_count), 0)
    into v_ingredient_variance
    from public.stocktake_lines sl4
    join public.purchased_items pi4 on pi4.id = sl4.item_reference
    where sl4.session_id = v_session_id
      and sl4.item_type = 'PURCHASED_ITEM'
      and pi4.base_ingredient_id = v_ingredient.ingredient_id;

    if v_ingredient_variance = 0 then
      continue;
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'line_id', null,
      'item_reference', v_ingredient.ingredient_id,
      'item_type', 'BASE_INGREDIENT',
      'counted_qty', v_ingredient_summed_counted,
      'theoretical_at_count', v_ingredient_current_theoretical,
      'current_theoretical_qty', v_ingredient_current_theoretical,
      'count_variance', v_ingredient_variance,
      'projected_qty', v_ingredient_current_theoretical + v_ingredient_variance
    ));
    v_plan_hash_rows := v_plan_hash_rows || jsonb_build_array(jsonb_build_object(
      'ingredient_id', v_ingredient.ingredient_id,
      'summed_counted_qty', v_ingredient_summed_counted,
      'ingredient_variance', v_ingredient_variance
    ));
    v_ledger_count := v_ledger_count + 1;
    -- No longer inserted into stock_ledger (this migration). The
    -- correction is still computed and still reported in v_rows/plan_hash
    -- for the owner's benefit (section 2d.3).
  end loop;

  v_plan_hash := md5(v_plan_hash_rows::text);

  if p_dry_run then
    return jsonb_build_object(
      'session_id', v_session_id,
      'status', 'OPEN',
      'dry_run', true,
      'ledger_count', v_ledger_count,
      'issue_count', v_issue_count,
      'rows', v_rows,
      'skipped_ingredients', v_skipped_ingredients,
      'plan_hash', v_plan_hash,
      'issue_ids', v_issue_ids
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
    'issue_count', v_issue_count,
    'rows', v_rows,
    'skipped_ingredients', v_skipped_ingredients,
    'plan_hash', v_plan_hash,
    'issue_ids', v_issue_ids
  );
end;
$function$;

revoke all on function public.apply_stocktake_session_atomic(text, text, text, boolean, text) from public;
revoke all on function public.apply_stocktake_session_atomic(text, text, text, boolean, text) from anon;
revoke all on function public.apply_stocktake_session_atomic(text, text, text, boolean, text) from authenticated;
grant execute on function public.apply_stocktake_session_atomic(text, text, text, boolean, text) to service_role;
