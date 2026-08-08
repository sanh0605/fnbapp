-- Plan D D5b (docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md),
-- BR-INV-008 ("hàng tìm lại được"): the rule was owner-approved and written
-- into BUSINESS-RULES.md, but nothing was ever assigned to build it -- the
-- law existed on paper while the machine still refused it. Two places block
-- it end to end; both are fixed here, and neither touches
-- apply_stocktake_session_atomic's counting math or lib/issue-costing.ts's
-- K6, which already compute the correct signed result once these two
-- refusals are lifted.

-- ============================================================
-- 1. stock_issues.base_quantity: allow a found event's negative value,
--    keep the NaN guard.
-- ============================================================
-- The live constraint, confirmed before writing this migration:
--   CHECK ((base_quantity > (0)::numeric) AND (base_quantity <> 'NaN'::numeric))
-- Dropping the whole clause and writing "<> 0" alone would silently lose
-- the NaN guard, not just leave it redundant. In Postgres numeric
-- ordering, NaN compares as greater than every value, so 'NaN' > 0 is
-- TRUE -- the ">0" half never actually excluded NaN, which is exactly why
-- 0052 needed the second clause in the first place. 'NaN' <> 0 is also
-- TRUE, for the same reason. Confirmed live:
--   select 'NaN'::numeric > 0, 'NaN'::numeric <> 0;  -- both true
-- So the replacement keeps both clauses, only loosening the sign check.
alter table public.stock_issues
  drop constraint stock_issues_base_quantity_check;

alter table public.stock_issues
  add constraint stock_issues_base_quantity_check
  check (base_quantity <> 0 and base_quantity <> 'NaN'::numeric);

-- ============================================================
-- save_stocktake_line_atomic
-- ============================================================
-- BR-INV-008 boundary: counted > theoretical but <= total_purchased is
-- goods found, not an error -- accepted, no longer refused. counted >
-- total_purchased is unchanged and still refused (BR-INV-005): that bound
-- cannot come from goods reappearing, since a found event's magnitude can
-- never exceed what has already been issued for that purchased item (a
-- found event is bounded by counted <= total_purchased, so it can only
-- return theoretical up to total_purchased, never past it -- see D5b's
-- worked example and the "theoretical never exceeds total_purchased"
-- invariant verified live below, not just argued).
create or replace function public.save_stocktake_line_atomic(
  p_line_id text,
  p_counted_qty numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    select coalesce(sum(quantity_change), 0) into v_theoretical
    from public.stock_ledger where item_reference = v_item_reference;
  end if;

  update public.stocktake_lines set
    counted_qty = p_counted_qty, theoretical_at_count = v_theoretical, counted_at = v_counted_at
  where id = v_line_id;

  return jsonb_build_object(
    'id', v_line_id, 'session_id', v_session_id, 'item_reference', v_item_reference,
    'counted_qty', p_counted_qty, 'theoretical_at_count', v_theoretical, 'counted_at', v_counted_at
  );
end;
$$;

revoke all on function public.save_stocktake_line_atomic(text, numeric)
  from public, anon, authenticated;
grant execute on function public.save_stocktake_line_atomic(text, numeric)
  to service_role;

-- ============================================================
-- apply_stocktake_session_atomic
-- ============================================================
-- Only the PURCHASED_ITEM issue note changes -- a negative base_quantity
-- (BR-INV-008, goods found) gets a note that explains itself in Vietnamese
-- rather than the generic stocktake note, since it is the owner who reads
-- it, possibly months later. Everything else (the variance math, the
-- ingredient-correction pass added in 0055) is byte-identical to 0055 --
-- both already compute and store the correct signed value once the two
-- refusals above are lifted; neither needed to change.
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
  v_ledger_ids jsonb := '[]'::jsonb;
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
