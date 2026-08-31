-- Phase D blockers, function 1 of 2: apply_stocktake_session_atomic.
-- docs/superpowers/plans/2026-09-01-phase-d-blockers.md section 2.2 (1).
--
-- Removes the two remaining reads of stock_ledger, so this function no
-- longer errors the moment stock_ledger is dropped (a future, separately
-- approved phase D). Both reads feed DISPLAY fields only
-- (current_theoretical_qty / theoretical_at_count / projected_qty on a row
-- in the returned `rows` array) -- neither one feeds count_variance, the
-- value that actually drives the stocktake close (the stock_issues rows it
-- writes, and the COGS those produce). The lines computing
-- v_count_variance and v_ingredient_variance are copied forward byte-for-
-- byte unchanged from the live function, precisely so that guarantee is
-- checkable by diff, not just by argument:
--
--   v_count_variance := v_line.counted_qty - v_line.theoretical_at_count;
--   ...
--   select coalesce(sum(sl4.counted_qty - sl4.theoretical_at_count), 0)
--   into v_ingredient_variance
--   from public.stocktake_lines sl4 ...
--
-- Neither line mentions stock_ledger. Both draw only from
-- stocktake_lines.theoretical_at_count, itself frozen at count-time by
-- save_stocktake_line_atomic (function 2 of 2, migration 0087) from
-- purchase_order_lines/stock_issues for every PURCHASED_ITEM line -- the
-- only line type any real session has ever used (50/50 lines on STK-001,
-- confirmed live, matching every other session on record).
--
-- Read site 1 (the per-line loop's non-PURCHASED_ITEM branch): never fired
-- for real data -- Plan D Gap 1 removed the ability to open a session with
-- a BASE_INGREDIENT/SEMI_PRODUCT line at all, so this branch has 0 real
-- invocations. v_current_theoretical_qty := 0 in its place.
--
-- Read site 2 (the ingredient-aggregation loop): DOES run for real data --
-- this is the loop that produced the real 38 STK- rows before Phase C
-- retired the write (2026-09-01), and it still runs on every stocktake
-- close where a counted PURCHASED_ITEM's variance rolls up to its
-- base_ingredient_id. Its result feeds three DISPLAY fields on the
-- BASE_INGREDIENT rollup rows the owner sees in the confirm-preview screen
-- ("Tồn hiện tại" / "Dự kiến sau áp dụng", StocktakeClient.tsx) -- those
-- will read 0 after this migration instead of a stale, frozen-since-01/09
-- ledger sum. This is the one real, owner-visible consequence of this
-- migration; flagged in the handoff, not silently absorbed here.
-- v_ingredient_current_theoretical := 0 in its place.
--
-- Return shape is unchanged -- same keys, only two of the values inside
-- `rows` entries change from a frozen ledger sum to 0. Checked against
-- lib/stocktake-transaction.ts before writing this: parseApplyResult does
-- `Number(row.current_theoretical_qty) || 0` etc., plain pass-through with
-- no value-based guard, so no TypeScript change is needed for this
-- function (unlike section 2.2's own warning about 0076/Phase C's
-- lib/stocktake-transaction.ts precedent -- checked explicitly here, not
-- assumed to repeat).
--
-- Signature unchanged, so this is a plain create-or-replace.
--
-- Deploy order (section 4, same discipline as 0076): this code must ship
-- BEFORE this migration is applied, and the owner confirms live that
-- closing a stocktake session and the Daily report still work before the
-- migration runs. Not applied here.

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
      -- Phase D blocker fix: this branch has 0 real invocations (Plan D
      -- Gap 1 removed the ability to open a session with a
      -- BASE_INGREDIENT/SEMI_PRODUCT line). Was a stock_ledger sum, feeding
      -- only this row's display fields below -- never count_variance.
      v_current_theoretical_qty := 0;
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
    -- stock_ledger (Phase C). Already counted into v_ledger_count above;
    -- the row is already in v_rows above.
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

    -- Phase D blocker fix: was a stock_ledger sum. Feeds only this row's
    -- display fields below (theoretical_at_count / current_theoretical_qty
    -- / projected_qty) -- v_ingredient_variance just below, the value that
    -- actually becomes this row's count_variance, never read it and is
    -- unchanged by this fix. This is the one read site that DID run for
    -- real data (the 38 real STK- rows, before Phase C retired the write)
    -- -- see this migration's header for the resulting UI-visible change.
    v_ingredient_current_theoretical := 0;

    -- S6 fix: sum of each line's own FROZEN count_variance, not
    -- summed_counted minus a fresh ledger re-read (see migration header).
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
    -- No longer inserted into stock_ledger (Phase C). The correction is
    -- still computed and still reported in v_rows/plan_hash for the
    -- owner's benefit.
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
