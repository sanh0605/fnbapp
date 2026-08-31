-- Delete tier-2 ingredient groups, step 1 (table only) -- part 1 of 2:
-- apply_stocktake_session_atomic must stop joining base_ingredients BEFORE
-- the table is dropped (migration 0090), or every stocktake close (both
-- dry-run preview and real confirm) throws a hard SQL error, not a soft
-- "produces no rows" -- the loop's own FROM clause names the table.
--
-- The removed loop aggregated PURCHASED_ITEM stocktake lines by their
-- linked base_ingredients group (tier-2), producing one summary row per
-- group with a combined count_variance -- display/reporting only, never
-- feeding count_variance on the per-line rows that actually drive
-- stock_issues (see 0086/0087's own header comments). Measured 2026-09-01:
-- 46 groups, 52/146 purchased_items link to one; STK-001 is the one real
-- session that produced output through this loop (38 summary rows). The
-- owner accepted losing this summary on 2026-09-01 ("gộp chỉ mang tính chất
-- thống kê, không còn là nối dữ liệu... dựng lại sau cho đúng chuẩn logic"),
-- per docs/superpowers/plans/2026-09-01-delete-tier-2-ingredient-groups.md
-- section 1.4.
--
-- ledger_count and skipped_ingredients stay in the return shape (read by
-- lib/stocktake-transaction.ts and shown to the owner in the confirm
-- dialog) -- they simply never get incremented/populated by this path
-- again, so the dialog's "sẽ ghi N điều chỉnh sổ kho" always reads 0 going
-- forward. This is the plan's own disclosed, expected consequence, not new
-- breakage -- the per-line PURCHASED_ITEM rows and their frozen
-- count_variance are untouched.
create or replace function public.apply_stocktake_session_atomic(p_session_id text, p_confirmed_by_id text, p_confirmed_by_name text, p_dry_run boolean default false, p_expected_plan_hash text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $$
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

  -- The group-aggregation loop over base_ingredients (join purchased_items
  -- -> base_ingredients, one summary row per tier-2 group) lived here.
  -- Removed along with the table it joined -- see this migration's header.
  -- v_ledger_count and v_skipped_ingredients are no longer populated by
  -- anything (the PURCHASED_ITEM branch above never touches them), so they
  -- stay permanently 0 / [] -- kept in the return shape unchanged below.

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
$$;
