-- supabase/migrations/0132_6d_batch_1a.sql
-- 6d database audit, batch 1a (plan docs/superpowers/plans/2026-10-16-6d-csdl.md, section
-- "Sửa sau phản biện của Sonnet"). NOT YET RUN on the server; the owner approves running it
-- separately from the push, and outside selling hours (it alters orders_v2 and promotions).
--
-- Order: migration-first is safe for every part. No function changes its return type or its
-- arguments, so code that does not know this file keeps working; the new refusals only turn
-- into Vietnamese messages once the code in the same commit (lib/shared/action-error.ts) is
-- live, and until then they show the generic message.
--
-- What it does:
--   1. Drops the dead function get_my_role() and the duplicate index idx_users_username.
--   2. Adds constraints that today have 0 violations (denominators, measured on the server
--      2026-10-16): uom_conversions.conversion_rate > 0 (0 of 180); purchase_order_lines money
--      >= 0 (0 of 362); stock_issues source/link rules (0 of 240 each, 0 double reversals);
--      assets quantity > 0, term > 0, costs >= 0 (0 of 84); band min_unit_price unique and
--      >= 0 (0 of 3); product_variants.price >= 0 (0 of 57); modifiers.price >= 0 (0 of 9);
--      products.category_id NOT NULL (0 null of 45); product_categories active names unique
--      (0 duplicates of 6); promotions dates, value, percent, min order (0 of 2 each).
--   3. asset_disposals_guard also refuses a disposal date before the asset's acquired_date or
--      after today in Vietnam (0 of 2 existing disposals outside the range).
--   4. New trigger: a monthly expense item must sit in an EXPENSE cash category (0 of 4).
--   5. orders_v2: drops the '' defaults of parent_order_id, superseded_by, applied_promotion_id.
--      Both order writers (create_pos_order_atomic_unvalidated_0025 and supersede_order_v2_atomic,
--      read from the server 2026-10-16) list all three columns in their insert, so no insert
--      relies on the default. voided_by_id, void_reason and migration_notes keep theirs (batch 2).
--   6. promotions.min_order_value numeric -> bigint (2 rows, 0 fractional).
--   7. save_product_atomic: old_price of a new price history row is the size's real price, not
--      the last history row (H1). Redefined in full; only that block changes.
--   8. K-12: every id minter drops lpad (which cuts to its width: 1000 became 100). 13 functions
--      redefined in full from the live bodies (pg_get_functiondef, 2026-10-16); the only change is
--      the padding expression. The till's create_pos_order_atomic*, supersede and void functions
--      are deliberately not touched.
--
-- Triggers on the touched tables (queried from the server pg_trigger 2026-10-16): one BEFORE UPDATE
-- touch_updated_at on asset_depreciation_bands, assets, modifiers, monthly_expense_items, orders_v2,
-- product_variants, products, promotions, uom_conversions, users; asset_disposals_guard BEFORE INSERT on
-- asset_disposals. This file updates no row, so no touch trigger fires (ALTER ... TYPE rewrites the
-- 2 promotions rows without firing triggers). None on stock_issues, purchase_order_lines,
-- product_categories.
--
-- Writer inventory for each constraint (skill fnbapp-bulk-data-change, section 6; live bodies read from
-- the server):
--   stock_issues: six functions insert (apply_stocktake_session_atomic, create_issue_slip_atomic,
--     edit_confirmed_stocktake_atomic, edit_issue_slip_atomic, reverse_manual_issue_atomic,
--     reverse_stocktake_session_atomic); tests/migrations/0132-6d-batch-1a.test.ts checks each insert
--     against the rules. Stocktake rows carry session_id, manual rows exactly one of slip / reversal.
--   asset_depreciation_bands: replace_asset_depreciation_bands updates every row in one statement, so
--     the unique constraint is DEFERRABLE INITIALLY DEFERRED (a shift of prices is checked at the end).
--   products.category_id: save_product_atomic (payload category) and
--     create_standalone_topping_product_atomic (always sets one); no other writer.
--   assets: save_purchase_order_atomic; a COMPLETED order refuses a 0 quantity line in the action.

set lock_timeout = '3s';

-- 1. Dead objects.
drop function if exists public.get_my_role();
drop index if exists public.idx_users_username;

-- 2. Constraints.
alter table public.uom_conversions
  drop constraint if exists uom_conversions_rate_positive;
alter table public.uom_conversions
  add constraint uom_conversions_rate_positive check (conversion_rate > 0);

alter table public.purchase_order_lines
  drop constraint if exists purchase_order_lines_money_not_negative;
alter table public.purchase_order_lines
  add constraint purchase_order_lines_money_not_negative check (
    subtotal >= 0 and unit_price >= 0 and base_quantity >= 0
  );

alter table public.stock_issues
  drop constraint if exists stock_issues_session_matches_source;
alter table public.stock_issues
  add constraint stock_issues_session_matches_source check ((source = 'STOCKTAKE') = (session_id is not null));
alter table public.stock_issues
  drop constraint if exists stock_issues_manual_one_link;
alter table public.stock_issues
  add constraint stock_issues_manual_one_link check (
    source <> 'MANUAL' or ((issue_slip_id is not null)::int + (reverses_issue_id is not null)::int) = 1
  );
-- Replaces the plain idx_stock_issues_reverses: one issue is reversed at most once.
drop index if exists public.idx_stock_issues_reverses;
create unique index ux_stock_issues_reverses on public.stock_issues (reverses_issue_id)
  where reverses_issue_id is not null;

alter table public.assets
  drop constraint if exists assets_quantity_positive;
alter table public.assets
  add constraint assets_quantity_positive check (quantity > 0);
alter table public.assets
  drop constraint if exists assets_term_positive;
alter table public.assets
  add constraint assets_term_positive check (term_months > 0);
alter table public.assets
  drop constraint if exists assets_costs_not_negative;
alter table public.assets
  add constraint assets_costs_not_negative check (unit_cost >= 0 and total_cost >= 0);

alter table public.asset_depreciation_bands
  drop constraint if exists asset_depreciation_bands_min_unique;
alter table public.asset_depreciation_bands
  add constraint asset_depreciation_bands_min_unique unique (min_unit_price) deferrable initially deferred;
alter table public.asset_depreciation_bands
  drop constraint if exists asset_depreciation_bands_min_not_negative;
alter table public.asset_depreciation_bands
  add constraint asset_depreciation_bands_min_not_negative check (min_unit_price >= 0);

alter table public.products
  alter column category_id set not null;

create unique index ux_product_categories_active_name on public.product_categories (
  lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
) where status = 'ACTIVE';

alter table public.product_variants
  drop constraint if exists product_variants_price_not_negative;
alter table public.product_variants
  add constraint product_variants_price_not_negative check (price >= 0);
alter table public.modifiers
  drop constraint if exists modifiers_price_not_negative;
alter table public.modifiers
  add constraint modifiers_price_not_negative check (price >= 0);

-- 5-6. Tables the till reads: altered under lock_timeout, a few milliseconds each.
alter table public.orders_v2
  alter column parent_order_id drop default,
  alter column superseded_by drop default,
  alter column applied_promotion_id drop default;

alter table public.promotions
  alter column min_order_value type bigint using min_order_value::bigint;
alter table public.promotions
  drop constraint if exists promotions_dates_ordered;
alter table public.promotions
  add constraint promotions_dates_ordered check (end_date is null or start_date is null or end_date >= start_date);
alter table public.promotions
  drop constraint if exists promotions_value_valid;
alter table public.promotions
  add constraint promotions_value_valid check (
    discount_value >= 0 and (discount_type <> 'PERCENT' or discount_value <= 100)
  );
alter table public.promotions
  drop constraint if exists promotions_min_order_not_negative;
alter table public.promotions
  add constraint promotions_min_order_not_negative check (min_order_value >= 0);

reset lock_timeout;

-- 3. Disposal date, in Vietnam time (the server clock is UTC).
create or replace function public.asset_disposals_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_status text;
  v_quantity integer;
  v_acquired date;
  v_disposed integer;
begin
  select status, quantity, acquired_date into v_status, v_quantity, v_acquired
  from public.assets where id = new.asset_id for update;
  if not found then
    raise exception 'Không tìm thấy tài sản';
  end if;
  if v_status = 'INACTIVE' then
    raise exception 'Tài sản đã ngừng dùng, không thanh lý được';
  end if;
  if new.disposed_date < v_acquired or new.disposed_date > (now() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'Ngày thanh lý phải từ ngày mua (%) đến hôm nay', v_acquired;
  end if;
  select coalesce(sum(quantity), 0) into v_disposed
  from public.asset_disposals where asset_id = new.asset_id;
  if v_disposed + new.quantity > v_quantity then
    raise exception 'Số lượng thanh lý (%) vượt quá số lượng còn lại (%)', new.quantity, v_quantity - v_disposed;
  end if;
  return new;
end;
$function$;

-- 4. A monthly expense item belongs to an expense group only (BR-CASH-009). A trigger because
-- the rule looks at another table.
create or replace function public.monthly_expense_items_category_guard()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_kind text;
begin
  select kind into v_kind from public.cash_categories where id = new.cash_category_id;
  if v_kind <> 'EXPENSE' then
    raise exception 'Khoản chi hằng tháng chỉ gắn được vào nhóm chi';
  end if;
  return new;
end;
$function$;

drop trigger if exists monthly_expense_items_category_guard on public.monthly_expense_items;
create trigger monthly_expense_items_category_guard before insert or update of cash_category_id on public.monthly_expense_items
  for each row execute function public.monthly_expense_items_category_guard();

revoke all on function public.monthly_expense_items_category_guard() from public;
revoke all on function public.monthly_expense_items_category_guard() from anon;
revoke all on function public.monthly_expense_items_category_guard() from authenticated;

-- 7-8. save_product_atomic (H1 + K-12) and the other id minters (K-12): live bodies, padding only.

CREATE OR REPLACE FUNCTION public.apply_stocktake_session_atomic(p_session_id text, p_confirmed_by_id text, p_confirmed_by_name text, p_dry_run boolean DEFAULT false, p_expected_plan_hash text DEFAULT NULL::text)
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
  v_skipped_ingredients jsonb := '[]'::jsonb;
  -- 0115
  v_book_at_count numeric(18,6);
  v_recomputed_lines jsonb := '[]'::jsonb;
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
    select id, item_reference, item_type, counted_qty, theoretical_at_count, counted_at
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

      -- 0115 (BR-INV-017): the book as of the moment this line was counted, from
      -- every movement dated up to then, including slips and orders entered after
      -- the count.
      select coalesce((
               select sum(pol.base_quantity)
               from public.purchase_order_lines pol
               join public.purchase_orders po on po.id = pol.purchase_order_id
               where po.status = 'COMPLETED' and pol.purchased_item_id = v_line.item_reference
                 and coalesce(po.transaction_date, po.created_at) <= v_line.counted_at
             ), 0)
             - coalesce((
               select sum(si.base_quantity)
               from public.stock_issues si
               left join public.stock_issues o on o.id = si.reverses_issue_id
               where si.purchased_item_id = v_line.item_reference
                 -- A reversal row is dated the day it was written; it counts from
                 -- its original's date, so a slip cancelled after the count nets out.
                 and coalesce(o.issued_at, si.issued_at) <= v_line.counted_at
             ), 0)
      into v_book_at_count;
    else
      -- Phase D blocker fix: this branch has 0 real invocations (Plan D
      -- Gap 1 removed the ability to open a session with a
      -- BASE_INGREDIENT/SEMI_PRODUCT line). Was a stock_ledger sum, feeding
      -- only this row's display fields below -- never count_variance.
      v_current_theoretical_qty := 0;
      -- 0115: nothing to recompute for a line that cannot exist; keep its figure.
      v_book_at_count := v_line.theoretical_at_count;
    end if;

    -- 0115: name every line whose book changed since the count, also when the
    -- variance is now zero (nothing is written for it, but the user is told).
    if v_book_at_count is distinct from v_line.theoretical_at_count then
      v_recomputed_lines := v_recomputed_lines || jsonb_build_array(jsonb_build_object(
        'line_id', v_line.id,
        'item_reference', v_line.item_reference,
        'frozen_qty', v_line.theoretical_at_count,
        'recomputed_qty', v_book_at_count
      ));
      if not p_dry_run then
        update public.stocktake_lines set theoretical_at_count = v_book_at_count where id = v_line.id;
      end if;
    end if;

    v_count_variance := v_line.counted_qty - v_book_at_count;
    v_projected_qty := v_current_theoretical_qty + v_count_variance;

    if v_count_variance = 0 then
      continue;
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'line_id', v_line.id,
      'item_reference', v_line.item_reference,
      'item_type', v_line.item_type,
      'counted_qty', v_line.counted_qty,
      'theoretical_at_count', v_book_at_count,
      'current_theoretical_qty', v_current_theoretical_qty,
      'count_variance', v_count_variance,
      'projected_qty', v_projected_qty
    ));
    v_plan_hash_rows := v_plan_hash_rows || jsonb_build_array(jsonb_build_object(
      'line_id', v_line.id,
      'item_reference', v_line.item_reference,
      'counted_qty', v_line.counted_qty,
      'theoretical_at_count', v_book_at_count,
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
      v_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_next_issue_number::text), 0)) || v_next_issue_number::text;
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
      'issue_ids', v_issue_ids,
      'recomputed_lines', v_recomputed_lines
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
    'issue_ids', v_issue_ids,
    'recomputed_lines', v_recomputed_lines
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_issue_slip_atomic(p_issued_at timestamp with time zone, p_note text, p_created_by_id text, p_created_by_name text, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_note text := coalesce(p_note, '');
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_next_slip_number integer;
  v_slip_id text;
  v_next_issue_number integer;
  v_issue_id text;
  v_line record;
  v_line_index integer := 0;
  v_item_ids text[] := '{}';
  v_remaining numeric[] := '{}';
  v_idx integer;
  v_item_name text;
  v_base_unit_name text;
  v_total_purchased_asof numeric(18,6);
  v_lock text;
  v_results jsonb := '[]'::jsonb;
begin
  if p_issued_at is null then raise exception 'p_issued_at is required'; end if;
  if p_issued_at > now() + interval '5 minutes' then
    raise exception 'p_issued_at (%) cannot be in the future', p_issued_at;
  end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'p_lines must be a non-empty JSON array';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform pg_advisory_xact_lock(hashtext('issue_slips:id'));

  -- 0106 (BR-INV-013, owner 2026-09-29): no new slip on or before the last
  -- confirmed stocktake.
  v_lock := public.issue_slip_stocktake_lock(p_issued_at);
  if v_lock is not null then
    raise exception 'Ngày xuất % nằm trước lần kiểm kê % đã chốt. Chọn ngày sau lần kiểm kê.',
      to_char(p_issued_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'), v_lock;
  end if;

  select coalesce(max(substring(id from '^ISL-([0-9]+)$')::integer), 0) + 1
  into v_next_slip_number
  from public.issue_slips where id ~ '^ISL-[0-9]+$';
  v_slip_id := 'ISL-' || repeat('0', greatest(5 - length(v_next_slip_number::text), 0)) || v_next_slip_number::text;
  insert into public.issue_slips (id, issued_at, note, created_by_id, created_by_name)
  values (v_slip_id, p_issued_at, v_note, v_created_by_id, v_created_by_name);

  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';

  for v_line in
    select * from jsonb_to_recordset(p_lines) as x(purchased_item_id text, base_quantity numeric)
  loop
    v_line_index := v_line_index + 1;

    if nullif(btrim(coalesce(v_line.purchased_item_id, '')), '') is null then
      raise exception 'Dòng %: thiếu mặt hàng', v_line_index;
    end if;
    if v_line.base_quantity is null or v_line.base_quantity <= 0 or v_line.base_quantity = 'NaN'::numeric then
      raise exception 'Dòng %: số lượng phải lớn hơn 0', v_line_index;
    end if;

    select name into v_item_name
    from public.purchased_items where id = v_line.purchased_item_id;
    if v_item_name is null then
      raise exception 'Dòng %: không tìm thấy mặt hàng %', v_line_index, v_line.purchased_item_id;
    end if;

    -- I10: seed the running balance once per distinct purchased item, then
    -- reuse and decrement it for every later line naming the same item.
    v_idx := array_position(v_item_ids, v_line.purchased_item_id);
    if v_idx is null then
      select coalesce(sum(pol.base_quantity), 0)
      into v_total_purchased_asof
      from public.purchase_order_lines pol
      join public.purchase_orders po on po.id = pol.purchase_order_id
      where po.status = 'COMPLETED'
        and pol.purchased_item_id = v_line.purchased_item_id
        and coalesce(po.transaction_date, po.created_at) <= p_issued_at;

      if v_total_purchased_asof = 0 then
        raise exception 'Dòng % (%): chưa có đơn nhập nào tính tới thời điểm %, không thể xuất trước khi nhập',
          v_line_index, v_item_name, p_issued_at;
      end if;

      v_item_ids := array_append(v_item_ids, v_line.purchased_item_id);
      -- 0106: lowest balance from the slip date to now, not only at the date.
      v_remaining := array_append(v_remaining, public.issue_stock_headroom(v_line.purchased_item_id, p_issued_at));
      v_idx := array_length(v_item_ids, 1);
    end if;

    if v_line.base_quantity > v_remaining[v_idx] then
      select u.name into v_base_unit_name
      from public.uom_conversions uc join public.units u on u.id = uc.base_unit
      where uc.purchased_item_id = v_line.purchased_item_id and uc.status = 'ACTIVE'
      order by uc.id
      limit 1;
      raise exception 'Không đủ tồn kho cho %: từ ngày phiếu tới nay có lúc kho chỉ còn % %.',
        v_item_name, v_remaining[v_idx], coalesce(v_base_unit_name, '');
    end if;
    v_remaining[v_idx] := v_remaining[v_idx] - v_line.base_quantity;

    v_next_issue_number := v_next_issue_number + 1;
    v_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_next_issue_number::text), 0)) || v_next_issue_number::text;
    insert into public.stock_issues (
      id, purchased_item_id, issued_at, base_quantity, source, session_id, note, issue_slip_id
    ) values (
      v_issue_id, v_line.purchased_item_id, p_issued_at, v_line.base_quantity, 'MANUAL', null, v_note, v_slip_id
    );
    -- No stock_ledger row: retire-the-stock-ledger plan's phase C, applied
    -- to this function ahead of its planned order because it is what blocks
    -- the owner. stock_issues (keyed on purchased_item_id) is the
    -- authoritative record; computeOnHandByPurchasedItem reads it, not the
    -- ledger.

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'issue_id', v_issue_id,
      'purchased_item_id', v_line.purchased_item_id,
      'base_quantity', v_line.base_quantity,
      'on_hand_after', v_remaining[v_idx]
    ));
  end loop;

  return jsonb_build_object(
    'slip_id', v_slip_id,
    'issued_at', p_issued_at,
    'note', v_note,
    'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name,
    'lines', v_results
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_standalone_topping_product_atomic(p_modifier_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_allow_standalone boolean;
  v_name text;
  v_price bigint;
  v_status text;
  v_existing_product_id text;
  v_next_product integer;
  v_next_variant integer;
  v_next_history integer;
  v_product_id text;
  v_variant_id text;
  v_pph_id text;
begin
  if p_modifier_id is null or btrim(p_modifier_id) = '' then
    raise exception 'p_modifier_id is required';
  end if;

  select m.name, m.price, m.status, m.product_id, coalesce(g.allow_standalone, false)
  into v_name, v_price, v_status, v_existing_product_id, v_allow_standalone
  from public.modifiers m
  left join public.modifier_groups g on g.id = m.group_id
  where m.id = p_modifier_id
  for update of m;
  if not found then
    raise exception 'Modifier % not found', p_modifier_id;
  end if;

  if v_status <> 'ACTIVE' then
    raise exception 'Modifier % is not ACTIVE -- cannot be sold standalone', p_modifier_id;
  end if;

  if v_existing_product_id is not null then
    raise exception 'Modifier % already has a linked product -- refusing to create a second one', p_modifier_id;
  end if;

  if not v_allow_standalone then
    raise exception 'Modifier % is in a group that does not sell options on their own', p_modifier_id;
  end if;

  if v_price is null or v_price <= 0 then
    raise exception 'Modifier % has price % -- refusing to create a 0đ món', p_modifier_id, coalesce(v_price::text, 'null');
  end if;

  perform pg_advisory_xact_lock(hashtext('products:id'));
  perform pg_advisory_xact_lock(hashtext('product_variants:id'));
  perform pg_advisory_xact_lock(hashtext('product_price_history:id'));

  select coalesce(max(substring(id from '^PROD-([0-9]+)$')::integer), 0) + 1
  into v_next_product
  from public.products
  where id ~ '^PROD-[0-9]+$';
  v_product_id := 'PROD-' || repeat('0', greatest(3 - length(v_next_product::text), 0)) || v_next_product::text;

  select coalesce(max(substring(id from '^VAR-([0-9]+)$')::integer), 0) + 1
  into v_next_variant
  from public.product_variants
  where id ~ '^VAR-[0-9]+$';
  v_variant_id := 'VAR-' || repeat('0', greatest(3 - length(v_next_variant::text), 0)) || v_next_variant::text;

  select coalesce(max(substring(id from '^PPH-([0-9]+)$')::integer), 0) + 1
  into v_next_history
  from public.product_price_history
  where id ~ '^PPH-[0-9]+$';
  v_pph_id := 'PPH-' || repeat('0', greatest(3 - length(v_next_history::text), 0)) || v_next_history::text;

  begin
    insert into public.products (
      id, category_id, name, image_url, status, created_at, updated_at
    ) values (
      v_product_id, 'CAT-007', v_name, '', 'ACTIVE', now(), now()
    );
  exception
    when unique_violation then
      raise exception
        'Product name "%" already exists among ACTIVE products -- refusing to create a duplicate',
        v_name;
  end;

  insert into public.product_variants (
    id, product_id, size_name, price, status, created_at, updated_at
  ) values (
    v_variant_id, v_product_id, '1 phần', v_price, 'ACTIVE', now(), now()
  );

  insert into public.product_price_history (
    id, variant_id, old_price, new_price, effective_at, created_at
  ) values (
    v_pph_id, v_variant_id, null, v_price, now(), now()
  );

  update public.modifiers
  set product_id = v_product_id
  where id = p_modifier_id;

  return jsonb_build_object(
    'product_id', v_product_id,
    'variant_id', v_variant_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session_id text := nullif(btrim(coalesce(p_session_id, '')), '');
  v_status text;
  v_confirmed_at timestamptz;
  v_latest_id text;
  v_next_issue_number integer;
  v_entry jsonb;
  v_line_id text;
  v_line record;
  v_new_qty numeric(18,6);
  v_variance numeric(18,6);
  v_existing_issue_id text;
  v_existing_count integer;
  v_issue_id text;
  v_note text;
  v_changed integer := 0;
  -- 0122
  v_items text[] := '{}';
  v_check text;
  v_low numeric;
  v_unit_name text;
  v_issue_ids jsonb := '[]'::jsonb;
begin
  if v_session_id is null then raise exception 'p_session_id is required'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Không có dòng nào để sửa';
  end if;

  select status, confirmed_at into v_status, v_confirmed_at
  from public.stocktake_sessions where id = v_session_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê %', v_session_id; end if;
  if v_status <> 'CONFIRMED' then
    raise exception 'Phiếu kiểm kê % không ở trạng thái đã xác nhận, không sửa được', v_session_id;
  end if;
  if exists (select 1 from public.stocktake_sessions where status = 'OPEN') then
    raise exception 'Đang có một phiếu kiểm kê mở -- xong phiếu đó rồi mới sửa được phiếu cũ';
  end if;
  select id into v_latest_id from public.stocktake_sessions
  where status = 'CONFIRMED' order by confirmed_at desc limit 1;
  if v_latest_id <> v_session_id then
    raise exception 'Chỉ sửa được phiếu kiểm kê mới nhất (%), không phải %', v_latest_id, v_session_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number from public.stock_issues where id ~ '^ISS-[0-9]+$';

  for v_entry in select value from jsonb_array_elements(p_lines) loop
    v_line_id := nullif(btrim(coalesce(v_entry->>'line_id', '')), '');
    if jsonb_typeof(v_entry->'counted_qty') is distinct from 'number' then
      raise exception 'Số đếm của dòng % phải là một số', coalesce(v_line_id, '?');
    end if;
    v_new_qty := (v_entry->>'counted_qty')::numeric;
    if v_new_qty < 0 then raise exception 'Số đếm của dòng % không được âm', v_line_id; end if;

    select id, item_reference, item_type, counted_qty, theoretical_at_count into v_line
    from public.stocktake_lines where id = v_line_id and session_id = v_session_id for update;
    if not found then raise exception 'Dòng % không thuộc phiếu %', coalesce(v_line_id, '?'), v_session_id; end if;
    if v_line.item_type <> 'PURCHASED_ITEM' then
      raise exception 'Dòng % không phải hàng mua, không sửa được', v_line_id;
    end if;
    if v_line.theoretical_at_count is null then
      raise exception 'Dòng % không có số sổ lúc đếm', v_line_id;
    end if;
    if v_line.counted_qty is not distinct from v_new_qty then continue; end if;

    update public.stocktake_lines set counted_qty = v_new_qty where id = v_line_id;
    v_changed := v_changed + 1;
    v_items := array_append(v_items, v_line.item_reference);
    v_variance := v_new_qty - v_line.theoretical_at_count;

    select count(*), min(id) into v_existing_count, v_existing_issue_id
    from public.stock_issues
    where session_id = v_session_id and purchased_item_id = v_line.item_reference and reverses_issue_id is null;
    if v_existing_count > 1 then
      raise exception 'Phiếu % có % dòng xuất cho cùng một hàng, cần kiểm tay', v_session_id, v_existing_count;
    end if;

    -- Same note texts as apply_stocktake_session_atomic (0089), dated the count.
    if v_variance > 0 then
      v_note := 'Hàng tìm lại được (BR-INV-008) -- kiểm kê định kỳ ' ||
        to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
    else
      v_note := 'Kiểm kê định kỳ ' || to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');
    end if;

    if v_variance = 0 then
      if v_existing_issue_id is not null then
        delete from public.stock_issues where id = v_existing_issue_id;
      end if;
    elsif v_existing_issue_id is not null then
      update public.stock_issues set base_quantity = -v_variance, note = v_note where id = v_existing_issue_id;
      v_issue_ids := v_issue_ids || jsonb_build_array(v_existing_issue_id);
    else
      v_next_issue_number := v_next_issue_number + 1;
      v_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_next_issue_number::text), 0)) || v_next_issue_number::text;
      insert into public.stock_issues (id, purchased_item_id, issued_at, base_quantity, source, session_id, note)
      values (v_issue_id, v_line.item_reference, v_confirmed_at, -v_variance, 'STOCKTAKE', v_session_id, v_note);
      v_issue_ids := v_issue_ids || jsonb_build_array(v_issue_id);
    end if;
  end loop;

  -- 0122: after every row is written (so two edited lines of one item count
  -- together), the item's lowest balance from the count's date to now must stay
  -- at or above zero.
  for v_check in select distinct unnest(v_items) loop
    v_low := public.issue_stock_headroom(v_check, v_confirmed_at);
    if v_low < 0 then
      select u.name into v_unit_name
      from public.uom_conversions uc join public.units u on u.id = uc.base_unit
      where uc.purchased_item_id = v_check and uc.status = 'ACTIVE'
      order by uc.id
      limit 1;
      raise exception 'Không sửa được: % sẽ âm kho, thiếu % % tính từ ngày kiểm kê % vì số hàng đó đã được xuất hoặc dùng sau ngày này. Giữ số đếm cao hơn hoặc xử lý phần đã xuất trước.',
        (select pi.name from public.purchased_items pi where pi.id = v_check),
        abs(v_low), coalesce(v_unit_name, ''),
        to_char(v_confirmed_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY');
    end if;
  end loop;

  return jsonb_build_object('session_id', v_session_id, 'changed_count', v_changed, 'issue_ids', v_issue_ids);
end;
$function$;

CREATE OR REPLACE FUNCTION public.edit_issue_slip_atomic(p_slip_id text, p_remove_issue_ids text[], p_replace_issue_ids text[], p_add_lines jsonb, p_created_by_id text, p_created_by_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_slip_id text := nullif(btrim(coalesce(p_slip_id, '')), '');
  v_remove text[] := coalesce(p_remove_issue_ids, '{}'::text[]);
  v_replace text[] := coalesce(p_replace_issue_ids, '{}'::text[]);
  v_all_ids text[];
  v_original record;
  v_reversal_number integer;
  v_add jsonb := coalesce(p_add_lines, '[]'::jsonb);
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_slip record;
  v_lock text;
  v_active integer;
  v_all_distinct integer;
  v_id text;
  v_reversal jsonb;
  v_removed jsonb := '[]'::jsonb;
  v_added jsonb := '[]'::jsonb;
  v_next_issue_number integer;
  v_issue_id text;
  v_line record;
  v_line_index integer := 0;
  v_item_ids text[] := '{}';
  v_remaining numeric[] := '{}';
  v_idx integer;
  v_item_name text;
  v_base_unit_name text;
  v_total_purchased_asof numeric(18,6);
begin
  if v_slip_id is null then raise exception 'p_slip_id is required'; end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;
  if jsonb_typeof(v_add) <> 'array' then raise exception 'p_add_lines must be a JSON array'; end if;
  v_all_ids := v_remove || v_replace;
  if cardinality(v_all_ids) = 0 and jsonb_array_length(v_add) = 0 then
    raise exception 'Chưa có thay đổi nào.';
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));

  select * into v_slip from public.issue_slips where id = v_slip_id for update;
  if v_slip.id is null then raise exception 'Không tìm thấy phiếu %', v_slip_id; end if;

  v_lock := public.issue_slip_stocktake_lock(v_slip.issued_at);
  if v_lock is not null then
    raise exception 'Phiếu % nằm trước lần kiểm kê % nên không sửa được nữa.', v_slip_id, v_lock;
  end if;

  -- A slip with no active line is cancelled (or fully reversed): refuse first.
  select count(*) into v_active
  from public.stock_issues si
  where si.issue_slip_id = v_slip_id
    and not exists (select 1 from public.stock_issues r where r.reverses_issue_id = si.id);
  if v_active = 0 then
    raise exception 'Phiếu xuất % đã huỷ, không sửa được.', v_slip_id;
  end if;

  -- Null and duplicate checks cover remove + replace together: an id in both
  -- lists would reverse one line twice.
  if exists (select 1 from unnest(v_all_ids) as x where x is null) then
    raise exception 'Danh sách dòng bỏ có mã trống.';
  end if;
  select count(distinct x) into v_all_distinct from unnest(v_all_ids) as x;
  if v_all_distinct <> cardinality(v_all_ids) then
    raise exception 'Danh sách dòng bỏ có mã trùng nhau.';
  end if;

  -- Every removed or replaced line leaves; a replaced line comes back as one
  -- of the p_add_lines, which is counted there.
  if v_active - cardinality(v_all_ids) + jsonb_array_length(v_add) <= 0 then
    raise exception 'Phiếu không còn dòng nào. Huỷ phiếu nếu muốn bỏ hết.';
  end if;

  foreach v_id in array v_remove loop
    if not exists (
      select 1 from public.stock_issues si
      where si.id = v_id and si.issue_slip_id = v_slip_id and si.source = 'MANUAL'
        and not exists (select 1 from public.stock_issues r where r.reverses_issue_id = si.id)
    ) then
      raise exception 'Dòng % không thuộc phiếu % hoặc đã trả về kho', v_id, v_slip_id;
    end if;
    v_reversal := public.reverse_manual_issue_atomic(v_id, 'Sửa phiếu ' || v_slip_id, v_created_by_id, v_created_by_name);
    v_removed := v_removed || jsonb_build_array(jsonb_build_object(
      'reversal_issue_id', v_reversal->>'reversal_issue_id',
      'reverses_issue_id', v_reversal->>'reverses_issue_id'
    ));
  end loop;

  -- Replaced lines (quantity changed): the return is dated at the original
  -- row's own date, so the old quantity is back in stock from the slip's date
  -- on (BR-INV-013, owner 2026-09-29). Pure removals above stay dated now.
  foreach v_id in array v_replace loop
    select * into v_original from public.stock_issues si
    where si.id = v_id and si.issue_slip_id = v_slip_id and si.source = 'MANUAL'
      and not exists (select 1 from public.stock_issues r where r.reverses_issue_id = si.id)
    for update;
    if not found then
      raise exception 'Dòng % không thuộc phiếu % hoặc đã trả về kho', v_id, v_slip_id;
    end if;
    select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0) + 1
    into v_reversal_number
    from public.stock_issues where id ~ '^ISS-[0-9]+$';
    v_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_reversal_number::text), 0)) || v_reversal_number::text;
    insert into public.stock_issues (
      id, purchased_item_id, issued_at, base_quantity, source, session_id, note, reverses_issue_id
    ) values (
      v_issue_id, v_original.purchased_item_id, v_original.issued_at, -v_original.base_quantity, 'MANUAL', null,
      'Sửa số lượng phiếu ' || v_slip_id, v_id
    );
    v_removed := v_removed || jsonb_build_array(jsonb_build_object(
      'reversal_issue_id', v_issue_id,
      'reverses_issue_id', v_id
    ));
  end loop;

  -- Order matters: every reversal (removed ones now, replaced ones on the slip
  -- date) is written BEFORE issue_stock_headroom is read below, so a replaced
  -- line's credit at the slip date counts. Lowering is then never refused, and
  -- raising 1.000 g to 1.500 g needs only 500 g of headroom.
  -- Take the next ISS number after the reversals above, which used numbers.
  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';

  for v_line in
    select * from jsonb_to_recordset(v_add) as x(purchased_item_id text, base_quantity numeric)
  loop
    v_line_index := v_line_index + 1;

    if nullif(btrim(coalesce(v_line.purchased_item_id, '')), '') is null then
      raise exception 'Dòng %: thiếu mặt hàng', v_line_index;
    end if;
    if v_line.base_quantity is null or v_line.base_quantity <= 0 or v_line.base_quantity = 'NaN'::numeric then
      raise exception 'Dòng %: số lượng phải lớn hơn 0', v_line_index;
    end if;

    select name into v_item_name
    from public.purchased_items where id = v_line.purchased_item_id;
    if v_item_name is null then
      raise exception 'Dòng %: không tìm thấy mặt hàng %', v_line_index, v_line.purchased_item_id;
    end if;

    -- Seed the running balance once per distinct item (cumulative, as 0094).
    v_idx := array_position(v_item_ids, v_line.purchased_item_id);
    if v_idx is null then
      select coalesce(sum(pol.base_quantity), 0)
      into v_total_purchased_asof
      from public.purchase_order_lines pol
      join public.purchase_orders po on po.id = pol.purchase_order_id
      where po.status = 'COMPLETED'
        and pol.purchased_item_id = v_line.purchased_item_id
        and coalesce(po.transaction_date, po.created_at) <= v_slip.issued_at;

      if v_total_purchased_asof = 0 then
        raise exception 'Dòng % (%): chưa có đơn nhập nào tính tới thời điểm %, không thể xuất trước khi nhập',
          v_line_index, v_item_name, v_slip.issued_at;
      end if;

      v_item_ids := array_append(v_item_ids, v_line.purchased_item_id);
      v_remaining := array_append(v_remaining, public.issue_stock_headroom(v_line.purchased_item_id, v_slip.issued_at));
      v_idx := array_length(v_item_ids, 1);
    end if;

    if v_line.base_quantity > v_remaining[v_idx] then
      select u.name into v_base_unit_name
      from public.uom_conversions uc join public.units u on u.id = uc.base_unit
      where uc.purchased_item_id = v_line.purchased_item_id and uc.status = 'ACTIVE'
      order by uc.id
      limit 1;
      raise exception 'Không đủ tồn kho cho %: từ ngày phiếu tới nay có lúc kho chỉ còn % %.',
        v_item_name, v_remaining[v_idx], coalesce(v_base_unit_name, '');
    end if;
    v_remaining[v_idx] := v_remaining[v_idx] - v_line.base_quantity;

    v_next_issue_number := v_next_issue_number + 1;
    v_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_next_issue_number::text), 0)) || v_next_issue_number::text;
    insert into public.stock_issues (
      id, purchased_item_id, issued_at, base_quantity, source, session_id, note, issue_slip_id
    ) values (
      v_issue_id, v_line.purchased_item_id, v_slip.issued_at, v_line.base_quantity, 'MANUAL', null, v_slip.note, v_slip_id
    );

    v_added := v_added || jsonb_build_array(jsonb_build_object(
      'issue_id', v_issue_id,
      'purchased_item_id', v_line.purchased_item_id,
      'base_quantity', v_line.base_quantity
    ));
  end loop;

  return jsonb_build_object('slip_id', v_slip_id, 'removed', v_removed, 'added', v_added);
end;
$function$;

CREATE OR REPLACE FUNCTION public.open_stocktake_session_atomic(p_created_by_id text, p_created_by_name text, p_items jsonb, p_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_existing_open_id text;
  v_session_id text;
  v_next_session_number integer;
  v_next_line_number integer;
  v_created_at timestamptz := now();
  v_line_id text;
  v_item record;
begin
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must contain at least one item';
  end if;

  perform pg_advisory_xact_lock(hashtext('stocktake_session:open'));

  select id into v_existing_open_id from public.stocktake_sessions where status = 'OPEN' limit 1;
  if v_existing_open_id is not null then
    raise exception 'A stocktake session is already open (session_id=%)', v_existing_open_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('stocktake_sessions:id'));
  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0) + 1
  into v_next_session_number from public.stocktake_sessions where id ~ '^STK-[0-9]+$';
  v_session_id := 'STK-' || repeat('0', greatest(3 - length(v_next_session_number::text), 0)) || v_next_session_number::text;

  insert into public.stocktake_sessions (id, status, created_by_id, created_by_name, created_at, notes)
  values (v_session_id, 'OPEN', v_created_by_id, v_created_by_name, v_created_at, coalesce(p_notes, ''));

  perform pg_advisory_xact_lock(hashtext('stocktake_lines:id'));
  select coalesce(max(substring(id from '^SKL-([0-9]+)$')::integer), 0)
  into v_next_line_number from public.stocktake_lines where id ~ '^SKL-[0-9]+$';

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(item_reference text, item_type text)
  loop
    if nullif(btrim(coalesce(v_item.item_reference, '')), '') is null then
      raise exception 'Each item requires an item_reference';
    end if;
    if v_item.item_type not in ('BASE_INGREDIENT', 'SEMI_PRODUCT', 'PURCHASED_ITEM') then
      raise exception 'Invalid item_type for %: %', v_item.item_reference, v_item.item_type;
    end if;

    v_next_line_number := v_next_line_number + 1;
    v_line_id := 'SKL-' || repeat('0', greatest(5 - length(v_next_line_number::text), 0)) || v_next_line_number::text;

    insert into public.stocktake_lines (id, session_id, item_reference, item_type)
    values (v_line_id, v_session_id, v_item.item_reference, v_item.item_type);
  end loop;

  return jsonb_build_object(
    'id', v_session_id, 'status', 'OPEN', 'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name, 'created_at', v_created_at,
    'notes', coalesce(p_notes, '')
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.replace_asset_depreciation_bands(p_bands jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prev_min bigint := null;
  v_row record;
  v_next_number integer;
  v_ids jsonb := '[]'::jsonb;
  v_new_id text;
begin
  if p_bands is null or jsonb_typeof(p_bands) <> 'array' or jsonb_array_length(p_bands) = 0 then
    raise exception 'Phải có ít nhất một khung khấu hao';
  end if;

  lock table public.asset_depreciation_bands in share row exclusive mode;

  create temporary table tmp_bands on commit drop as
  select
    nullif(btrim(e->>'id'), '') as id,
    (e->>'min_unit_price')::bigint as min_unit_price,
    (e->>'term_months')::integer as term_months,
    lead((e->>'min_unit_price')::bigint) over (order by (e->>'min_unit_price')::bigint) as max_unit_price
  from jsonb_array_elements(p_bands) as e;


  for v_row in select * from tmp_bands order by min_unit_price loop
    if v_row.min_unit_price is null or v_row.term_months is null or v_row.term_months < 1 then
      raise exception 'Số tháng khấu hao phải là số nguyên từ 1 trở lên';
    end if;
    if v_prev_min is null then
      if v_row.min_unit_price <> 0 then
        raise exception 'Khung đầu tiên phải bắt đầu từ 0đ';
      end if;
    elsif v_row.min_unit_price <= v_prev_min then
      raise exception 'Giá bắt đầu của mỗi khung phải lớn hơn khung trước (% không lớn hơn %)', v_row.min_unit_price, v_prev_min;
    end if;
    v_prev_min := v_row.min_unit_price;
  end loop;

  if exists (select 1 from tmp_bands where id is not null group by id having count(*) > 1) then
    raise exception 'Một khung xuất hiện hai lần';
  end if;
  if exists (
    select 1 from tmp_bands t
    where t.id is not null
      and not exists (select 1 from public.asset_depreciation_bands b where b.id = t.id)
  ) then
    raise exception 'Không tìm thấy khung khấu hao đang sửa';
  end if;

  delete from public.asset_depreciation_bands
  where id not in (select id from tmp_bands where id is not null);

  update public.asset_depreciation_bands b
  set min_unit_price = t.min_unit_price,
      max_unit_price = t.max_unit_price,
      term_months = t.term_months
  from tmp_bands t
  where b.id = t.id;

  perform pg_advisory_xact_lock(hashtext('asset_depreciation_bands:id'));
  select coalesce(max((substring(id from '^KH-([0-9]+)$'))::integer), 0)
  into v_next_number
  from public.asset_depreciation_bands;

  for v_row in select * from tmp_bands where id is null order by min_unit_price loop
    v_next_number := v_next_number + 1;
    v_new_id := 'KH-' || repeat('0', greatest(3 - length(v_next_number::text), 0)) || v_next_number::text;
    insert into public.asset_depreciation_bands (id, min_unit_price, max_unit_price, term_months)
    values (v_new_id, v_row.min_unit_price, v_row.max_unit_price, v_row.term_months);
  end loop;

  select coalesce(jsonb_agg(id order by min_unit_price), '[]'::jsonb)
  into v_ids
  from public.asset_depreciation_bands;

  return v_ids;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_manual_issue_atomic(p_issue_id text, p_note text, p_created_by_id text, p_created_by_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_issue_id text := nullif(btrim(coalesce(p_issue_id, '')), '');
  v_note text := coalesce(p_note, '');
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_original record;
  v_already_reversed_by text;
  v_now timestamptz := now();
  v_next_issue_number integer;
  v_reversal_id text;
begin
  if v_issue_id is null then raise exception 'p_issue_id is required'; end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));

  select * into v_original from public.stock_issues where id = v_issue_id for update;
  if v_original.id is null then raise exception 'Không tìm thấy phiếu xuất: %', v_issue_id; end if;
  if v_original.source <> 'MANUAL' then
    raise exception 'Chỉ đảo được phiếu xuất thủ công -- % có nguồn %, không phải MANUAL',
      v_issue_id, v_original.source;
  end if;

  select id into v_already_reversed_by
  from public.stock_issues where reverses_issue_id = v_issue_id;
  if v_already_reversed_by is not null then
    raise exception 'Phiếu % đã được đảo bởi % trước đó, không đảo hai lần', v_issue_id, v_already_reversed_by;
  end if;

  -- 0106 (BR-INV-013): nothing dated on or before the last confirmed count.
  if public.issue_slip_stocktake_lock(v_original.issued_at) is not null then
    raise exception 'Dòng % nằm trước lần kiểm kê % nên không trả về kho được nữa.',
      v_issue_id, public.issue_slip_stocktake_lock(v_original.issued_at);
  end if;

  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0) + 1
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';
  v_reversal_id := 'ISS-' || repeat('0', greatest(5 - length(v_next_issue_number::text), 0)) || v_next_issue_number::text;

  -- BR-INV-009: negative base_quantity, dated now -- the same shape as a
  -- BR-INV-008 found-stock row. reverses_issue_id is the link; the original
  -- row is never updated (kept exactly as posted).
  insert into public.stock_issues (
    id, purchased_item_id, issued_at, base_quantity, source, session_id, note, reverses_issue_id
  ) values (
    v_reversal_id, v_original.purchased_item_id, v_now, -v_original.base_quantity, 'MANUAL', null,
    'Đảo phiếu ' || v_issue_id || ' (ghi nhầm)' || coalesce(' -- ' || nullif(btrim(v_note), ''), ''),
    v_issue_id
  );
  -- No stock_ledger row: same phase-C removal as create_issue_slip_atomic
  -- above, applied to the reversal path.

  return jsonb_build_object(
    'reversal_issue_id', v_reversal_id,
    'reverses_issue_id', v_issue_id,
    'purchased_item_id', v_original.purchased_item_id,
    'base_quantity', -v_original.base_quantity,
    'issued_at', v_now,
    'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_stocktake_session_atomic(p_session_id text, p_reason text, p_reversed_by_id text, p_reversed_by_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session_id text := nullif(btrim(coalesce(p_session_id, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_reversed_by_id text := nullif(btrim(coalesce(p_reversed_by_id, '')), '');
  v_reversed_by_name text := nullif(btrim(coalesce(p_reversed_by_name, '')), '');
  v_status text;
  v_most_recent_confirmed_id text;
  v_any_open boolean;
  v_now timestamptz := now();
  v_next_issue_number integer;
  v_issue_row record;
  v_reversal_issue_id text;
  v_note text;
  v_issue_ids jsonb := '[]'::jsonb;
  v_issue_count integer := 0;
  v_check record;
  v_low numeric;
  v_unit_name text;
begin
  if v_session_id is null then raise exception 'p_session_id is required'; end if;
  if v_reason is null then raise exception 'Lý do huỷ phiên kiểm kê là bắt buộc'; end if;
  if v_reversed_by_id is null then raise exception 'p_reversed_by_id is required'; end if;
  if v_reversed_by_name is null then raise exception 'p_reversed_by_name is required'; end if;

  select status into v_status from public.stocktake_sessions where id = v_session_id for update;
  if v_status is null then raise exception 'Unknown stocktake session: %', v_session_id; end if;
  if v_status <> 'CONFIRMED' then
    raise exception 'Phiên % không ở trạng thái đã áp dụng (status=%), không thể huỷ', v_session_id, v_status;
  end if;

  select exists (select 1 from public.stocktake_sessions where status = 'OPEN')
  into v_any_open;
  if v_any_open then
    raise exception 'Đang có một phiên kiểm kê đang mở -- xử lý xong phiên đó trước khi huỷ phiên đã áp dụng';
  end if;

  select id into v_most_recent_confirmed_id
  from public.stocktake_sessions
  where status = 'CONFIRMED'
  order by confirmed_at desc
  limit 1;
  if v_most_recent_confirmed_id <> v_session_id then
    raise exception 'Chỉ phiên đã áp dụng gần nhất (%) mới được huỷ, không phải %', v_most_recent_confirmed_id, v_session_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));

  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0)
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';

  v_note := 'Huỷ phiên kiểm kê ' || v_session_id || ' -- ' || v_reason;

  for v_issue_row in
    select * from public.stock_issues where session_id = v_session_id order by id
  loop
    v_next_issue_number := v_next_issue_number + 1;
    v_reversal_issue_id := 'ISS-' || repeat('0', greatest(5 - length(v_next_issue_number::text), 0)) || v_next_issue_number::text;
    insert into public.stock_issues (
      id, purchased_item_id, issued_at, base_quantity, source, session_id, note, reverses_issue_id
    ) values (
      v_reversal_issue_id, v_issue_row.purchased_item_id, v_now, -v_issue_row.base_quantity,
      'STOCKTAKE', v_session_id, v_note, v_issue_row.id
    );
    v_issue_ids := v_issue_ids || jsonb_build_array(v_reversal_issue_id);
    v_issue_count := v_issue_count + 1;
  end loop;

  -- 0111: a found-at-count line (negative base_quantity) is reversed by a
  -- positive row that takes the goods out again. Checked once per item after
  -- every reverse row is written, so a loss line of the same item (which puts
  -- goods back) counts in the balance and the row order cannot matter.
  for v_check in
    select distinct si.purchased_item_id
    from public.stock_issues si
    where si.session_id = v_session_id and si.reverses_issue_id is null and si.base_quantity < 0
  loop
    v_low := public.issue_stock_headroom(v_check.purchased_item_id, v_now);
    if v_low < 0 then
      select u.name into v_unit_name
      from public.uom_conversions uc join public.units u on u.id = uc.base_unit
      where uc.purchased_item_id = v_check.purchased_item_id and uc.status = 'ACTIVE'
      order by uc.id
      limit 1;
      raise exception 'Không huỷ được phiên kiểm kê %: % sẽ âm kho (còn % %) vì số hàng tìm thấy lúc kiểm đã được xuất hoặc dùng. Xử lý phần đã xuất trước.',
        v_session_id,
        (select pi.name from public.purchased_items pi where pi.id = v_check.purchased_item_id),
        v_low, coalesce(v_unit_name, '');
    end if;
  end loop;

  update public.stocktake_sessions set
    status = 'REVERSED',
    reversed_by_id = v_reversed_by_id,
    reversed_by_name = v_reversed_by_name,
    reversed_at = v_now,
    reversed_reason = v_reason
  where id = v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'status', 'REVERSED',
    'reason', v_reason,
    'reversed_by_id', v_reversed_by_id,
    'reversed_by_name', v_reversed_by_name,
    'reversed_at', v_now,
    'issue_count', v_issue_count,
    'issue_ids', v_issue_ids
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_product_atomic(p_is_edit boolean, p_product jsonb, p_variants jsonb DEFAULT '[]'::jsonb, p_removed_variant_ids jsonb DEFAULT '[]'::jsonb, p_effective_at timestamp with time zone DEFAULT now(), p_option_group_ids text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_product_id text;
  v_variant jsonb;
  v_variant_id text;
  v_variant_product_id text;
  v_variant_status text;
  v_old_price bigint;
  v_new_price bigint;
  v_removed_variant_id text;
  v_next_product integer;
  v_next_variant integer;
  v_next_history integer;
  v_variant_count integer := 0;
  v_price_history_count integer := 0;
  v_removed_variant_count integer := 0;
  v_affected integer := 0;
begin
  if p_is_edit is null then
    raise exception 'p_is_edit is required';
  end if;
  if p_product is null or jsonb_typeof(p_product) <> 'object' then
    raise exception 'p_product must be a JSON object';
  end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array'
     or jsonb_array_length(p_variants) = 0 then
    raise exception 'p_variants must be a non-empty JSON array';
  end if;
  if p_removed_variant_ids is null
     or jsonb_typeof(p_removed_variant_ids) <> 'array' then
    raise exception 'p_removed_variant_ids must be a JSON array';
  end if;
  if nullif(btrim(p_product->>'name'), '') is null
     or nullif(btrim(p_product->>'category_id'), '') is null then
    raise exception 'Product name and category_id are required';
  end if;

  perform pg_advisory_xact_lock(hashtext('products:id'));
  perform pg_advisory_xact_lock(hashtext('product_variants:id'));
  perform pg_advisory_xact_lock(hashtext('product_price_history:id'));

  select coalesce(max(substring(id from '^PROD-([0-9]+)$')::integer), 0) + 1
  into v_next_product
  from public.products
  where id ~ '^PROD-[0-9]+$';
  select coalesce(max(substring(id from '^VAR-([0-9]+)$')::integer), 0) + 1
  into v_next_variant
  from public.product_variants
  where id ~ '^VAR-[0-9]+$';
  select coalesce(max(substring(id from '^PPH-([0-9]+)$')::integer), 0) + 1
  into v_next_history
  from public.product_price_history
  where id ~ '^PPH-[0-9]+$';

  if p_is_edit then
    v_product_id := nullif(btrim(p_product->>'id'), '');
    if v_product_id is null then
      raise exception 'p_product.id is required for edit';
    end if;
    perform 1
    from public.products
    where id = v_product_id
    for update;
    if not found then
      raise exception 'Product % not found', v_product_id;
    end if;
    update public.products
    set
      category_id = p_product->>'category_id',
      name = p_product->>'name',
      image_url = coalesce(p_product->>'image_url', ''),
      updated_at = now()
    where id = v_product_id;
  else
    v_product_id := 'PROD-' || repeat('0', greatest(3 - length(v_next_product::text), 0)) || v_next_product::text;
    insert into public.products (
      id, category_id, name, image_url, status, created_at, updated_at
    ) values (
      v_product_id,
      p_product->>'category_id',
      p_product->>'name',
      coalesce(p_product->>'image_url', ''),
      'ACTIVE',
      coalesce(nullif(p_product->>'created_at', '')::timestamptz, now()),
      now()
    );
  end if;

  for v_variant in
    select value from jsonb_array_elements(p_variants)
  loop
    if nullif(btrim(v_variant->>'size_name'), '') is null then
      raise exception 'Variant size_name is required';
    end if;
    v_new_price := nullif(v_variant->>'price', '')::bigint;
    if v_new_price is null or v_new_price < 0 then
      raise exception 'Variant price must be non-negative';
    end if;

    v_variant_id := nullif(btrim(v_variant->>'id'), '');
    if v_variant_id is null then
      v_variant_id := 'VAR-' || repeat('0', greatest(3 - length(v_next_variant::text), 0)) || v_next_variant::text;
      v_next_variant := v_next_variant + 1;
      insert into public.product_variants (
        id, product_id, size_name, price, status, created_at, updated_at
      ) values (
        v_variant_id,
        v_product_id,
        v_variant->>'size_name',
        v_new_price,
        'ACTIVE',
        coalesce(p_effective_at, now()),
        now()
      );
      v_old_price := null;
    else
      select product_id, status, price
      into v_variant_product_id, v_variant_status, v_old_price
      from public.product_variants
      where id = v_variant_id
      for update;
      if not found then
        raise exception 'Variant % not found', v_variant_id;
      end if;
      if v_variant_product_id <> v_product_id or v_variant_status = 'DELETED' then
        raise exception 'Variant % does not belong to active product %',
          v_variant_id, v_product_id;
      end if;
      update public.product_variants
      set
        size_name = v_variant->>'size_name',
        price = v_new_price,
        updated_at = now()
      where id = v_variant_id;
    end if;
    v_variant_count := v_variant_count + 1;

    if v_old_price is null or v_old_price <> v_new_price then
      insert into public.product_price_history (
        id, variant_id, old_price, new_price, effective_at, created_at
      ) values (
        'PPH-' || repeat('0', greatest(3 - length(v_next_history::text), 0)) || v_next_history::text,
        v_variant_id,
        v_old_price,
        v_new_price,
        coalesce(p_effective_at, now()),
        coalesce(p_effective_at, now())
      );
      v_next_history := v_next_history + 1;
      v_price_history_count := v_price_history_count + 1;
    end if;
  end loop;

  for v_removed_variant_id in
    select value from jsonb_array_elements_text(p_removed_variant_ids)
  loop
    update public.product_variants
    set status = 'DELETED', updated_at = now()
    where id = v_removed_variant_id
      and product_id = v_product_id
      and status <> 'DELETED';
    get diagnostics v_affected = row_count;
    if v_affected <> 1 then
      raise exception 'Removed variant % is missing or already deleted',
        v_removed_variant_id;
    end if;
    v_removed_variant_count := v_removed_variant_count + 1;
  end loop;

  if v_variant_count <> jsonb_array_length(p_variants) then
    raise exception 'Variant count mismatch';
  end if;
  if v_removed_variant_count <> jsonb_array_length(p_removed_variant_ids) then
    raise exception 'Removed variant count mismatch';
  end if;

  if p_option_group_ids is not null then
    delete from public.modifier_group_products
    where product_id = v_product_id and group_id <> all (p_option_group_ids);
    insert into public.modifier_group_products (id, group_id, product_id)
    select g || ':' || v_product_id, g, v_product_id from unnest(p_option_group_ids) as g
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'product_id', v_product_id,
    'variant_count', v_variant_count,
    'price_history_count', v_price_history_count,
    'removed_variant_count', v_removed_variant_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_purchase_order_atomic(p_order jsonb, p_lines jsonb DEFAULT '[]'::jsonb, p_replace_existing boolean DEFAULT false, p_assets jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_po_id text;
  v_next_number integer;
  v_existing_id text;
  v_existing_status text;
  v_existing_created_at timestamptz;
  v_stored public.purchase_orders%rowtype;
  v_lock text;
  v_moves boolean;
  v_line_count integer;
  -- 0112
  v_old_at timestamptz;
  v_new_at timestamptz;
  v_from timestamptz;
  v_items text[] := '{}';
  v_before numeric[] := '{}';
  v_after numeric;
  v_i integer;
  v_unit_name text;
  v_next_asset_number integer;
  v_asset record;
  -- 0116
  v_prev_status text;
  v_prev_created_at timestamptz;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'p_order must be a JSON object';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array';
  end if;
  if p_assets is not null and jsonb_typeof(p_assets) <> 'object' then
    raise exception 'p_assets must be a JSON object';
  end if;

  -- 0108: a cancelled order is written only by cancel_purchase_order_atomic.
  if coalesce(nullif(p_order->>'status', ''), 'DRAFT') not in ('DRAFT', 'COMPLETED') then
    raise exception 'p_order.status must be DRAFT or COMPLETED';
  end if;

  v_po_id := nullif(btrim(p_order->>'id'), '');

  -- 0116 (BR-INV-018, owner 2026-10-14): a new completed order, or a draft being
  -- completed, dated on or before the last confirmed stocktake is refused: the
  -- count already holds those goods, so the book would gain them twice. A draft
  -- save, and a save of an order already stored as COMPLETED (0112's edit rules
  -- below), are not touched. The stock lock is taken first, as the slip writers
  -- do, so a stocktake confirming at the same instant is seen.
  if coalesce(nullif(p_order->>'status', ''), 'DRAFT') = 'COMPLETED' then
    perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
    if p_replace_existing then
      select po.status, po.created_at into v_prev_status, v_prev_created_at
      from public.purchase_orders po where po.id = v_po_id;
    end if;
    if v_prev_status is distinct from 'COMPLETED' then
      v_new_at := coalesce(
        nullif(p_order->>'transaction_date', '')::timestamptz,
        v_prev_created_at,
        nullif(p_order->>'created_at', '')::timestamptz,
        now()
      );
      v_lock := public.issue_slip_stocktake_lock(v_new_at);
      if v_lock is not null then
        raise exception 'Phiếu nhập ngày % nằm trước lần kiểm kê % (%) nên không ghi nhận hoàn thành được: lần kiểm kê đã đếm lại hàng trên kệ. Chọn ngày sau lần kiểm kê, hoặc lưu nháp. Muốn ghi lùi ngày, huỷ các lần kiểm kê từ mới nhất trở về trước (BR-INV-018).',
          to_char(v_new_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'), v_lock,
          to_char((select s.confirmed_at from public.stocktake_sessions s where s.id = v_lock) at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY');
      end if;
    end if;
  end if;

  if v_po_id is null then
    perform pg_advisory_xact_lock(hashtext('purchase_orders:id'));
    select coalesce(
      max((substring(id from '^PO-([0-9]+)$'))::integer),
      0
    ) + 1
    into v_next_number
    from public.purchase_orders;
    v_po_id := 'PO-' || repeat('0', greatest(3 - length(v_next_number::text), 0)) || v_next_number::text;
  elsif not p_replace_existing and exists (
    select 1 from public.purchase_orders where id = v_po_id
  ) then
    raise exception 'Purchase order % already exists', v_po_id;
  end if;

  if p_replace_existing then
    -- 0112 (A3a): the same stock lock as cancel_purchase_order_atomic and the
    -- slip writers, taken before the row lock (cancel takes them in this order
    -- too), so a slip saved at the same instant waits and the balance read below
    -- is settled.
    perform pg_advisory_xact_lock(hashtext('stock_issues:id'));

    select * into v_stored
    from public.purchase_orders
    where id = v_po_id
    for update;
    v_existing_id := v_stored.id;
    v_existing_status := v_stored.status;
    v_existing_created_at := v_stored.created_at;
    v_old_at := coalesce(v_stored.transaction_date, v_stored.created_at);

    if v_existing_id is null then
      raise exception 'Purchase order % does not exist', v_po_id;
    end if;
    -- 0108: a save that waited on a cancel meets CANCELLED here.
    if v_existing_status = 'CANCELLED' then
      raise exception 'Phiếu đã huỷ, không sửa được';
    end if;

    -- 0112 (A3a): a completed order counts in stock. Measure every item of the
    -- old and the new lines from the earlier of the old and the new date, now,
    -- before anything is written.
    if v_existing_status = 'COMPLETED' then
      select coalesce(array_agg(distinct s.item), '{}') into v_items
      from (
        select l.purchased_item_id as item
        from public.purchase_order_lines l where l.purchase_order_id = v_po_id
        union
        select nullif(x.purchased_item_id, '')
        from jsonb_to_recordset(p_lines) as x(purchased_item_id text)
      ) s
      where s.item is not null;

      v_new_at := coalesce(nullif(p_order->>'transaction_date', '')::timestamptz, v_existing_created_at);

      -- 0112 (BR-INV-018, owner 2026-10-14, audit A3b): an order dated on or
      -- before the last confirmed stocktake keeps its stock and cost, like the
      -- cancel (BR-INV-015). Only an edit that moves stock or cost is refused:
      -- the date, the amounts or the lines. Notes, invoice code and payment
      -- details are not compared and stay editable.
      -- The date is compared to the second: the form sends no milliseconds, an
      -- order saved with a blank picker is stored with them.
      v_moves := date_trunc('second', v_new_at) is distinct from date_trunc('second', v_old_at)
        or v_stored.subtotal_amount is distinct from coalesce(nullif(p_order->>'subtotal_amount', ''), '0')::bigint
        or v_stored.shipping_fee is distinct from coalesce(nullif(p_order->>'shipping_fee', ''), '0')::bigint
        or v_stored.tax_amount is distinct from coalesce(nullif(p_order->>'tax_amount', ''), '0')::bigint
        or v_stored.voucher_amount is distinct from coalesce(nullif(p_order->>'voucher_amount', ''), '0')::bigint
        or v_stored.discount_amount is distinct from coalesce(nullif(p_order->>'discount_amount', ''), '0')::bigint
        or v_stored.total_amount is distinct from coalesce(nullif(p_order->>'total_amount', ''), '0')::bigint
        or (select count(*) from public.purchase_order_lines l where l.purchase_order_id = v_po_id)
           <> jsonb_array_length(p_lines)
        or exists (
          (select coalesce(l.purchased_item_id, ''), coalesce(l.unit, ''), coalesce(l.quantity, 0),
                  coalesce(l.unit_price, 0), coalesce(l.subtotal, 0), coalesce(l.base_quantity, 0)
           from public.purchase_order_lines l where l.purchase_order_id = v_po_id)
          except all
          (select coalesce(x.purchased_item_id, ''), coalesce(x.unit, ''), coalesce(x.quantity, 0),
                  coalesce(x.unit_price, 0), coalesce(x.subtotal, 0), coalesce(x.base_quantity, 0)
           from jsonb_to_recordset(p_lines) as x(purchased_item_id text, unit text, quantity numeric,
                                                 unit_price bigint, subtotal bigint, base_quantity numeric))
        )
        or exists (
          (select coalesce(x.purchased_item_id, ''), coalesce(x.unit, ''), coalesce(x.quantity, 0),
                  coalesce(x.unit_price, 0), coalesce(x.subtotal, 0), coalesce(x.base_quantity, 0)
           from jsonb_to_recordset(p_lines) as x(purchased_item_id text, unit text, quantity numeric,
                                                 unit_price bigint, subtotal bigint, base_quantity numeric))
          except all
          (select coalesce(l.purchased_item_id, ''), coalesce(l.unit, ''), coalesce(l.quantity, 0),
                  coalesce(l.unit_price, 0), coalesce(l.subtotal, 0), coalesce(l.base_quantity, 0)
           from public.purchase_order_lines l where l.purchase_order_id = v_po_id)
        );
      if v_moves then
        v_lock := public.issue_slip_stocktake_lock(v_old_at);
        if v_lock is null then
          v_lock := public.issue_slip_stocktake_lock(v_new_at);
        end if;
        if v_lock is not null then
          raise exception 'Phiếu % nằm trước lần kiểm kê % (%) nên không sửa được hàng, tiền hay ngày nữa: lần kiểm kê đã đếm lại hàng trên kệ. Muốn sửa, huỷ các lần kiểm kê từ mới nhất trở về trước.',
            v_po_id, v_lock,
            to_char((select s.confirmed_at from public.stocktake_sessions s where s.id = v_lock) at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY');
        end if;
      end if;
      v_from := least(v_old_at, v_new_at);
      for v_i in 1..coalesce(cardinality(v_items), 0) loop
        v_before[v_i] := public.issue_stock_headroom(v_items[v_i], v_from);
      end loop;
    end if;

    update public.purchase_orders
    set
      supplier_id = nullif(p_order->>'supplier_id', ''),
      source_id = nullif(p_order->>'source_id', ''),
      transaction_date = nullif(p_order->>'transaction_date', '')::timestamptz,
      supplier_invoice_code = nullif(p_order->>'supplier_invoice_code', ''),
      notes = nullif(p_order->>'notes', ''),
      subtotal_amount = coalesce(nullif(p_order->>'subtotal_amount', ''), '0')::bigint,
      shipping_fee = coalesce(nullif(p_order->>'shipping_fee', ''), '0')::bigint,
      tax_amount = coalesce(nullif(p_order->>'tax_amount', ''), '0')::bigint,
      voucher_amount = coalesce(nullif(p_order->>'voucher_amount', ''), '0')::bigint,
      discount_amount = coalesce(nullif(p_order->>'discount_amount', ''), '0')::bigint,
      total_amount = coalesce(nullif(p_order->>'total_amount', ''), '0')::bigint,
      status = coalesce(nullif(p_order->>'status', ''), 'DRAFT'),
      payment_method = nullif(p_order->>'payment_method', ''),
      bank_account_id = nullif(p_order->>'bank_account_id', ''),
      updated_at = now()
    where id = v_po_id;

    delete from public.purchase_order_lines
    where purchase_order_id = v_po_id;
  else
    insert into public.purchase_orders (
      id,
      supplier_id,
      source_id,
      transaction_date,
      supplier_invoice_code,
      notes,
      subtotal_amount,
      shipping_fee,
      tax_amount,
      voucher_amount,
      discount_amount,
      total_amount,
      status,
      payment_method,
      bank_account_id,
      created_by_id,
      created_by_name,
      created_at
    )
    values (
      v_po_id,
      nullif(p_order->>'supplier_id', ''),
      nullif(p_order->>'source_id', ''),
      nullif(p_order->>'transaction_date', '')::timestamptz,
      nullif(p_order->>'supplier_invoice_code', ''),
      nullif(p_order->>'notes', ''),
      coalesce(nullif(p_order->>'subtotal_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'shipping_fee', ''), '0')::bigint,
      coalesce(nullif(p_order->>'tax_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'voucher_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'discount_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'total_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'status', ''), 'DRAFT'),
      nullif(p_order->>'payment_method', ''),
      nullif(p_order->>'bank_account_id', ''),
      nullif(p_order->>'created_by_id', ''),
      nullif(p_order->>'created_by_name', ''),
      coalesce(
        nullif(p_order->>'created_at', '')::timestamptz,
        now()
      )
    );
  end if;

  insert into public.purchase_order_lines (
    id,
    purchase_order_id,
    purchased_item_id,
    unit,
    quantity,
    unit_price,
    subtotal,
    conversion_id,
    base_unit,
    base_quantity,
    created_at
  )
  select
    row.id,
    v_po_id,
    nullif(row.purchased_item_id, ''),
    nullif(row.unit, ''),
    coalesce(row.quantity, 0),
    coalesce(row.unit_price, 0),
    coalesce(row.subtotal, 0),
    nullif(row.conversion_id, ''),
    nullif(row.base_unit, ''),
    coalesce(row.base_quantity, 0),
    coalesce(row.created_at, now())
  from jsonb_to_recordset(p_lines) as row(
    id text,
    purchased_item_id text,
    unit text,
    quantity numeric,
    unit_price bigint,
    subtotal bigint,
    conversion_id text,
    base_unit text,
    base_quantity numeric,
    created_at timestamptz
  );
  get diagnostics v_line_count = row_count;

  -- 0112 (A3a): the balance again, with the new lines in place. Refused only
  -- when the item is under zero AND lower than before this edit; the raise
  -- rolls the whole save back.
  if v_existing_status = 'COMPLETED' then
    for v_i in 1..coalesce(cardinality(v_items), 0) loop
      v_after := public.issue_stock_headroom(v_items[v_i], v_from);
      if v_after < 0 and v_after < v_before[v_i] then
        select u.name into v_unit_name
        from public.uom_conversions uc join public.units u on u.id = uc.base_unit
        where uc.purchased_item_id = v_items[v_i] and uc.status = 'ACTIVE'
        order by uc.id
        limit 1;
        raise exception 'Không sửa được phiếu %: % sẽ âm kho -- từ ngày phiếu tới nay có lúc kho chỉ còn % %. Hàng này đã được xuất hoặc dùng.',
          v_po_id,
          (select pi.name from public.purchased_items pi where pi.id = v_items[v_i]),
          v_after, coalesce(v_unit_name, '');
      end if;
    end loop;
  end if;

  -- 0112 (A7): the assets of this order, in the same transaction.
  if p_assets is not null then
    perform pg_advisory_xact_lock(hashtext('assets:id'));

    update public.assets
    set status = 'INACTIVE'
    where id in (select jsonb_array_elements_text(coalesce(p_assets->'retire', '[]'::jsonb)));

    for v_asset in
      select * from jsonb_to_recordset(coalesce(p_assets->'update', '[]'::jsonb)) as x(id text, patch jsonb)
    loop
      update public.assets
      set
        quantity = coalesce((v_asset.patch->>'quantity')::int, quantity),
        unit_cost = coalesce((v_asset.patch->>'unit_cost')::bigint, unit_cost),
        total_cost = coalesce((v_asset.patch->>'total_cost')::bigint, total_cost),
        term_months = coalesce((v_asset.patch->>'term_months')::int, term_months),
        acquired_date = coalesce((v_asset.patch->>'acquired_date')::date, acquired_date)
      where id = v_asset.id;
    end loop;

    -- Same id shape as generateNewId("assets", "TS"): TS-001, never cut at 3
    -- digits (lpad would turn 1000 into 100).
    select coalesce(max(substring(id from '^TS-([0-9]+)$')::integer), 0)
    into v_next_asset_number
    from public.assets where id ~ '^TS-[0-9]+$';

    for v_asset in
      select * from jsonb_to_recordset(coalesce(p_assets->'create', '[]'::jsonb)) as x(
        purchased_item_id text,
        purchase_order_line_id text,
        name_snapshot text,
        acquired_date date,
        unit_cost bigint,
        total_cost bigint,
        quantity int,
        term_months int
      )
    loop
      v_next_asset_number := v_next_asset_number + 1;
      insert into public.assets (
        id, purchased_item_id, purchase_order_line_id, name_snapshot, acquired_date,
        unit_cost, total_cost, quantity, term_months
      ) values (
        'TS-' || repeat('0', greatest(3 - length(v_next_asset_number::text), 0)) || v_next_asset_number::text,
        v_asset.purchased_item_id, v_asset.purchase_order_line_id, v_asset.name_snapshot, v_asset.acquired_date,
        v_asset.unit_cost, v_asset.total_cost, v_asset.quantity, v_asset.term_months
      );
    end loop;
  end if;

  return jsonb_build_object(
    'purchase_order_id', v_po_id,
    'line_count', v_line_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_purchased_item_atomic(p_item_id text, p_name text, p_category_id text, p_is_non_inventory boolean, p_warning_confirmed boolean, p_confirmed_by text, p_base_unit text, p_conversions jsonb, p_retire_asset_ids text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id text := nullif(btrim(coalesce(p_item_id, '')), '');
  v_conv jsonb;
  v_conv_id text;
  v_next integer;
  v_kept text[] := '{}';
  v_old record;
begin
  perform pg_advisory_xact_lock(hashtext('save_purchased_item_atomic'));

  begin
    if v_id is null then
      select coalesce(max(substring(id from '^SPM-([0-9]+)$')::integer), 0) + 1
        into v_next from public.purchased_items where id ~ '^SPM-[0-9]+$';
      v_id := 'SPM-' || repeat('0', greatest(3 - length(v_next::text), 0)) || v_next::text;
      insert into public.purchased_items (
        id, name, item_category_id, is_non_inventory,
        duplicate_warning_confirmed, duplicate_warning_confirmed_by, duplicate_warning_confirmed_at
      ) values (
        v_id, p_name, nullif(p_category_id, ''), coalesce(p_is_non_inventory, false),
        coalesce(p_warning_confirmed, false),
        case when p_warning_confirmed then p_confirmed_by end,
        case when p_warning_confirmed then now() end
      );
    else
      -- base_ingredient_id and status are deliberately left alone, as before.
      update public.purchased_items set
        name = p_name,
        item_category_id = nullif(p_category_id, ''),
        is_non_inventory = coalesce(p_is_non_inventory, false),
        duplicate_warning_confirmed = duplicate_warning_confirmed or coalesce(p_warning_confirmed, false),
        duplicate_warning_confirmed_by = case when p_warning_confirmed then p_confirmed_by else duplicate_warning_confirmed_by end,
        duplicate_warning_confirmed_at = case when p_warning_confirmed then now() else duplicate_warning_confirmed_at end
      where id = v_id;
      if not found then
        raise exception 'Không tìm thấy hàng hoá.';
      end if;
    end if;
  exception
    when unique_violation then
      raise exception 'Đã có hàng hoá đang dùng tên "%". Hãy chọn tên khác.', p_name;
  end;

  update public.assets set status = 'INACTIVE'
  where id = any(coalesce(p_retire_asset_ids, '{}'));

  if p_conversions is not null then
    for v_conv in select * from jsonb_array_elements(p_conversions) loop
      v_conv_id := nullif(v_conv->>'id', '');
      if v_conv_id is not null then
        -- Only this item's own row: a foreign id sent by the form changes nothing.
        update public.uom_conversions set
          purchased_unit = v_conv->>'name',
          base_unit = p_base_unit,
          conversion_rate = (v_conv->>'conversion_rate')::numeric
        where id = v_conv_id and purchased_item_id = v_id;
      else
        select coalesce(max(substring(id from '^QD-([0-9]+)$')::integer), 0) + 1
          into v_next from public.uom_conversions where id ~ '^QD-[0-9]+$';
        v_conv_id := 'QD-' || repeat('0', greatest(3 - length(v_next::text), 0)) || v_next::text;
        insert into public.uom_conversions (id, purchased_item_id, purchased_unit, base_unit, conversion_rate)
        values (v_conv_id, v_id, v_conv->>'name', p_base_unit, (v_conv->>'conversion_rate')::numeric);
      end if;
      v_kept := v_kept || v_conv_id;
    end loop;

    -- Rows the form no longer lists. A brand-new item has none.
    for v_old in
      select c.id, exists (select 1 from public.purchase_order_lines l where l.conversion_id = c.id) as used
      from public.uom_conversions c
      where c.purchased_item_id = v_id and c.id <> all(v_kept)
    loop
      if v_old.used then
        update public.uom_conversions set status = 'INACTIVE' where id = v_old.id;
      else
        delete from public.uom_conversions where id = v_old.id;
      end if;
    end loop;
  end if;

  return jsonb_build_object('item_id', v_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_topping_price_atomic(p_modifier_id text, p_price bigint, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_product_id text;
  v_active_modifier_count integer;
  v_variant_id text;
  v_active_variant_count integer;
  v_old_variant_price bigint;
  v_next_history integer;
  v_pph_id text;
  v_history_rows jsonb := '[]'::jsonb;
begin
  if p_modifier_id is null or btrim(p_modifier_id) = '' then
    raise exception 'p_modifier_id is required';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'p_price must be non-negative';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'p_name is required';
  end if;

  select product_id into v_product_id
  from public.modifiers
  where id = p_modifier_id
  for update;
  if not found then
    raise exception 'Modifier % not found', p_modifier_id;
  end if;

  if v_product_id is not null then
    select count(*) into v_active_modifier_count
    from public.modifiers
    where product_id = v_product_id and status = 'ACTIVE';
    if v_active_modifier_count > 1 then
      raise exception
        'Product % has % ACTIVE modifiers -- price sync needs exactly one writer',
        v_product_id, v_active_modifier_count;
    end if;

    select count(*) into v_active_variant_count
    from public.product_variants
    where product_id = v_product_id and status = 'ACTIVE';
    if v_active_variant_count <> 1 then
      raise exception
        'Product % has % ACTIVE variants -- "the standalone price" is not a single number',
        v_product_id, v_active_variant_count;
    end if;
  end if;

  update public.modifiers
  set price = p_price, name = p_name
  where id = p_modifier_id;

  if v_product_id is null then
    -- No linked product, nothing else to sync. Not an error.
    return jsonb_build_object(
      'modifier_id', p_modifier_id,
      'variant_id', null,
      'price_history', '[]'::jsonb
    );
  end if;

  select id, price into v_variant_id, v_old_variant_price
  from public.product_variants
  where product_id = v_product_id and status = 'ACTIVE'
  for update;

  update public.product_variants
  set price = p_price
  where id = v_variant_id;

  if v_old_variant_price is null or v_old_variant_price <> p_price then
    perform pg_advisory_xact_lock(hashtext('product_price_history:id'));
    select coalesce(max(substring(id from '^PPH-([0-9]+)$')::integer), 0) + 1
    into v_next_history
    from public.product_price_history
    where id ~ '^PPH-[0-9]+$';
    v_pph_id := 'PPH-' || repeat('0', greatest(3 - length(v_next_history::text), 0)) || v_next_history::text;

    insert into public.product_price_history (
      id, variant_id, old_price, new_price, effective_at, created_at
    ) values (
      v_pph_id, v_variant_id, v_old_variant_price, p_price, now(), now()
    );
    v_history_rows := jsonb_build_array(jsonb_build_object(
      'id', v_pph_id, 'variant_id', v_variant_id,
      'old_price', v_old_variant_price, 'new_price', p_price
    ));
  end if;

  return jsonb_build_object(
    'modifier_id', p_modifier_id,
    'variant_id', v_variant_id,
    'price_history', v_history_rows
  );
end;
$function$;
