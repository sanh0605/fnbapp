-- Issue-based COGS, Plan B Task 3: count purchased items, produce issues.
-- Design: docs/superpowers/specs/2026-08-02-issue-based-cogs-design.md
-- Plan: docs/superpowers/plans/2026-08-04-cogs-plan-b-parallel-path.md
--
-- Carries one correction from Task 2: stock_issues.purchased_item_id was
-- created as bare text, with no reference to purchased_items. Both other
-- tables holding that column reference it (0001_init_schema.sql:184, :334).

alter table public.stock_issues
  add constraint stock_issues_purchased_item_id_fkey
  foreign key (purchased_item_id) references public.purchased_items(id) on delete restrict;

-- ============================================================
-- save_stocktake_line_atomic
-- ============================================================
-- BASE_INGREDIENT / SEMI_PRODUCT: unchanged, byte for byte -- still reads
-- stock_ledger exactly as before.
--
-- PURCHASED_ITEM: theoretical stock is (purchases to a COMPLETED order) minus
-- (stock_issues, unconditional -- no time filter, mirroring how the other two
-- types read stock_ledger with no time filter either).
--
-- theoretical <= total_purchased always, since issued is never negative
-- (stock_issues.base_quantity > 0 by constraint). So "counted > theoretical"
-- covers "counted > total_purchased" as a subset -- one comparison, two
-- distinct causes, two distinct Vietnamese messages so the owner reads the
-- right one:
--   counted > total_purchased  -> BR-INV-005: goods with no purchase behind
--     them. Refuse, name siblings sharing base_ingredient_id.
--   counted > theoretical, <= total_purchased -> an earlier count already
--     recorded more as issued than actually left. No reversal rule exists
--     yet (stock_issues forbids a negative base_quantity by construction) --
--     OPEN-ITEMS.md item 32. Refuse rather than silently absorbing it.
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

    if p_counted_qty > v_theoretical then
      select name, base_ingredient_id into v_item_name, v_base_ingredient_id
      from public.purchased_items where id = v_item_reference;

      if p_counted_qty > v_total_purchased then
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
      else
        raise exception 'Số đếm % vượt tồn lý thuyết % của % (%), nhưng vẫn trong tổng đã mua %. Có khả năng một lần kiểm kê trước đã ghi nhận xuất kho nhiều hơn thực tế, khiến giá vốn kỳ đó bị tính dư -- chưa có luật xử lý số dư này. Báo chủ quán trước khi ghi nhận lần đếm này.',
          p_counted_qty, v_theoretical, v_item_name, v_item_reference, v_total_purchased;
      end if;
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
-- BASE_INGREDIENT / SEMI_PRODUCT: unchanged write path -- stock_ledger
-- STOCK_ADJUST, byte for byte.
--
-- PURCHASED_ITEM: writes stock_issues only, never stock_ledger, so
-- trg_stock_ledger_inventory_balances and detect_backdated_ledger_entry
-- (checked live before Task 2) never fire for a purchased-item count.
--
-- v_count_variance is computed from the count-time snapshot
-- (theoretical_at_count), which save_stocktake_line_atomic now guarantees
-- is >= counted_qty for every PURCHASED_ITEM line -- it refuses to store
-- the line otherwise. So v_count_variance is never positive here; only 0
-- (skipped, same as every other type) or negative (a genuine shortfall,
-- written as -v_count_variance, which is positive and satisfies
-- stock_issues' base_quantity > 0 constraint).
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

  v_plan_hash := md5(v_plan_hash_rows::text);

  if p_dry_run then
    return jsonb_build_object(
      'session_id', v_session_id,
      'status', 'OPEN',
      'dry_run', true,
      'ledger_count', v_ledger_count,
      'issue_count', v_issue_count,
      'rows', v_rows,
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
