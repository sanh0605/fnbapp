-- Plan D D5 (docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md).
-- Gap 3: counting by purchased item fixed cost (stock_issues) but never
-- fixed the stock number -- the PURCHASED_ITEM branch of
-- apply_stocktake_session_atomic wrote stock_issues only, never
-- stock_ledger, so an ingredient's quantity stayed at its inflated
-- post-cutover value forever no matter how carefully it was counted.
--
-- Trigger check first, per fnbapp-bulk-data-change, re-verified live
-- against production immediately before writing this migration:
--   select tgname, pg_get_triggerdef(oid) from pg_trigger
--    where tgrelid = 'public.stock_ledger'::regclass and not tgisinternal;
-- Exactly one: trg_stock_ledger_inventory_balances, AFTER INSERT OR DELETE
-- OR UPDATE OF item_reference, quantity_change. This is the mechanism the
-- new ingredient-correction insert below relies on to update
-- inventory_balances -- not a risk to guard against, not touched here.
--
-- S1/S2/S2b: after the existing per-line pass (unchanged), a new pass
-- finds every base_ingredient that owns at least one confirmed
-- PURCHASED_ITEM line this session. An ingredient is corrected only if
-- EVERY purchased-item line belonging to it in THIS session (confirmed or
-- not) has counted_qty set -- a partial sum is not a count (S2).
-- Completeness is checked against this session's own lines, not a freshly
-- re-queried "eligible purchased items" set: which purchased items belong
-- to a session was already decided at open time (Gap 1/C17, D4), and a
-- purchased item added afterward is out of scope for this session (C14),
-- so S2b (an inactive purchased item that still has stock) is already
-- handled by D4's filterByC17 keeping its line in the session -- nothing
-- extra is needed here.
--
-- S5: the correction and the issues above both read the exact same
-- stocktake_lines.counted_qty values for this session -- one query per
-- figure (SUM for the ingredient, the line's own value for the issue),
-- never independently recomputed.
--
-- Ingredient-correction rows are folded into the SAME ledger_count/
-- ledger_ids/rows the existing BASE_INGREDIENT/SEMI_PRODUCT branch already
-- returns, tagged item_type = 'BASE_INGREDIENT' (item_reference = the
-- ingredient id) rather than inventing a new item_type: D4 already removed
-- BASE_INGREDIENT lines from every new session, so that tag is free to mean
-- exactly this -- an ingredient-level stock_ledger correction -- without
-- touching the StocktakeItemType union or the row shape the TypeScript
-- wrapper (lib/stocktake-transaction.ts) already validates.
--
-- Skipped ingredients (S2) are NOT added to rows -- a skipped ingredient
-- writes nothing, and rows' existing contract is "one entry per row this
-- apply actually writes" (lib/stocktake-transaction.ts:155 enforces
-- ledger_count + issue_count === rows.length). They go in a new,
-- separate skipped_ingredients field instead.
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
  v_next_issue_number integer;
  v_ledger_id text;
  v_issue_id text;
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
  v_ledger_ids jsonb := '[]'::jsonb;
  v_issue_ids jsonb := '[]'::jsonb;
  -- Plan D D5: ingredient-level correction for counted purchased items.
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

  -- Serialize ID allocation with every existing stock-ledger and stock-issue
  -- writer, and lock all count lines under the already-locked session before
  -- building a plan.
  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));
  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform 1
  from public.stocktake_lines
  where session_id = v_session_id
  for update;

  if not p_dry_run then
    select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0)
    into v_next_ledger_number
    from public.stock_ledger
    where id ~ '^STK-[0-9]+$';

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
    -- Current theoretical is read fresh for the confirmation preview. The
    -- adjustment itself uses the count-time delta so later movements
    -- (ledger or issues) remain intact after this session is applied.
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
      insert into public.stock_issues (
        id, purchased_item_id, issued_at, base_quantity, source, session_id, note
      ) values (
        v_issue_id,
        v_line.item_reference,
        v_confirmed_at,
        -v_count_variance,
        'STOCKTAKE',
        v_session_id,
        'Kiểm kê định kỳ ' || to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
      );
      v_issue_ids := v_issue_ids || jsonb_build_array(v_issue_id);
    else
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
      v_ledger_ids := v_ledger_ids || jsonb_build_array(v_ledger_id);
    end if;
  end loop;

  -- Plan D D5 / Gap 3: correct each base ingredient that owns at least one
  -- counted PURCHASED_ITEM line this session, but only when every one of
  -- that ingredient's purchased-item lines in this session is confirmed.
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

    v_ingredient_variance := v_ingredient_summed_counted - v_ingredient_current_theoretical;

    if v_ingredient_variance = 0 then
      continue;
    end if;

    -- Tagged item_type = 'BASE_INGREDIENT' deliberately -- D4 already
    -- removed BASE_INGREDIENT lines from every new session, so this tag is
    -- free to mean "an ingredient-level correction" without adding a new
    -- item_type the TypeScript wrapper's closed union does not know about.
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
      v_ingredient.ingredient_id,
      v_ingredient_variance,
      0,
      v_confirmed_at,
      'Kiểm kê định kỳ ' || to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') ||
        ' -- điều chỉnh tồn nguyên liệu theo tổng đã đếm của các hàng mua'
    );
    v_ledger_ids := v_ledger_ids || jsonb_build_array(v_ledger_id);
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
      'ledger_ids', v_ledger_ids,
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
    'ledger_ids', v_ledger_ids,
    'issue_ids', v_issue_ids
  );
end;
$$;

revoke all on function public.apply_stocktake_session_atomic(text, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.apply_stocktake_session_atomic(text, text, text, boolean, text)
  to service_role;
