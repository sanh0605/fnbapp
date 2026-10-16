-- supabase/migrations/0136_6d_batch_2c.sql
-- 6d batch 2c (plan docs/superpowers/plans/2026-10-16-6d-csdl.md). NOT YET RUN on the server.
--
-- WHAT IT DOES
--   1. Redefines six functions (bodies copied from the live server, pg_get_functiondef, 2026-10-17)
--      so they no longer read or write the three columns below. Signatures and return types are
--      unchanged, so no second overload appears and the existing grants stay.
--        open_stocktake_session_atomic   ignores p_notes; no longer reads item_type from p_items
--                                        or writes it; drops the 'notes' key of the result.
--        apply_stocktake_session_atomic  drops the dead BASE_INGREDIENT/SEMI_PRODUCT branches and
--                                        the item_type reads; drops the 'item_type' key of each row.
--        edit_confirmed_stocktake_atomic drops the item_type check.
--        save_stocktake_line_atomic      drops the item_type read and its dead branch.
--        create_issue_slip_atomic        ignores p_note; no issue_slips.note; writes '' to
--                                        stock_issues.note; keeps the 'note' key of the result as ''.
--        edit_issue_slip_atomic          writes '' (was v_slip.note) to stock_issues.note.
--   2. Drops issue_slips.note (empty on 102/102), stocktake_sessions.notes (empty on 1/1) and
--      stocktake_lines.item_type (PURCHASED_ITEM on 50/50; its check constraint
--      stocktake_lines_item_type_check goes with it). No foreign key is added: an older backup
--      still holds stocktake lines that point at old ING-... codes.
--
-- WHY THE FUNCTIONS FIRST: plpgsql does not track what a body uses, so the drop itself would
-- succeed and every later call that still names a column would fail at run time.
--
-- Triggers on the three tables (queried from the server 2026-10-17, pg_trigger, non-internal):
--   issue_slips          none
--   stocktake_lines      none
--   stocktake_sessions   trg_stocktake_sessions_touch, BEFORE UPDATE, touch_updated_at():
--                        sets updated_at; does not read notes.
--
-- ORDER: the code ships first. It stops reading the columns, and still sends item_type
-- "PURCHASED_ITEM" in p_items, because the old open function inserts it (the column has no
-- default). The owner approves this migration separately, after the push.
-- DO NOT roll Vercel back past this migration: older code reads stocktake_lines.item_type
-- (package lines) and issue_slips.note, which no longer exist.

set lock_timeout = '3s';

create or replace function public.open_stocktake_session_atomic(p_created_by_id text, p_created_by_name text, p_items jsonb, p_notes text DEFAULT ''::text)
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

  insert into public.stocktake_sessions (id, status, created_by_id, created_by_name, created_at)
  values (v_session_id, 'OPEN', v_created_by_id, v_created_by_name, v_created_at);

  perform pg_advisory_xact_lock(hashtext('stocktake_lines:id'));
  select coalesce(max(substring(id from '^SKL-([0-9]+)$')::integer), 0)
  into v_next_line_number from public.stocktake_lines where id ~ '^SKL-[0-9]+$';

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(item_reference text)
  loop
    if nullif(btrim(coalesce(v_item.item_reference, '')), '') is null then
      raise exception 'Each item requires an item_reference';
    end if;

    v_next_line_number := v_next_line_number + 1;
    v_line_id := 'SKL-' || repeat('0', greatest(5 - length(v_next_line_number::text), 0)) || v_next_line_number::text;

    insert into public.stocktake_lines (id, session_id, item_reference)
    values (v_line_id, v_session_id, v_item.item_reference);
  end loop;

  return jsonb_build_object(
    'id', v_session_id, 'status', 'OPEN', 'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name, 'created_at', v_created_at
  );
end;
$function$;

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
    select id, item_reference, counted_qty, theoretical_at_count, counted_at
    from public.stocktake_lines
    where session_id = v_session_id
      and counted_qty is not null
    order by id
  loop
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

    v_issue_count := v_issue_count + 1;

    if p_dry_run then
      continue;
    end if;

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

create or replace function public.edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb)
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

    select id, item_reference, counted_qty, theoretical_at_count into v_line
    from public.stocktake_lines where id = v_line_id and session_id = v_session_id for update;
    if not found then raise exception 'Dòng % không thuộc phiếu %', coalesce(v_line_id, '?'), v_session_id; end if;
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

  select session_id, item_reference into v_session_id, v_item_reference
  from public.stocktake_lines where id = v_line_id;
  if v_session_id is null then raise exception 'Unknown stocktake line: %', v_line_id; end if;

  select status into v_session_status from public.stocktake_sessions where id = v_session_id for update;
  if v_session_status <> 'OPEN' then
    raise exception 'Stocktake session % is not open (status=%)', v_session_id, v_session_status;
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
    counted_qty = p_counted_qty, theoretical_at_count = v_theoretical, counted_at = v_counted_at
  where id = v_line_id;

  return jsonb_build_object(
    'id', v_line_id, 'session_id', v_session_id, 'item_reference', v_item_reference,
    'counted_qty', p_counted_qty, 'theoretical_at_count', v_theoretical, 'counted_at', v_counted_at
  );
end;
$function$;

create or replace function public.create_issue_slip_atomic(p_issued_at timestamp with time zone, p_note text, p_created_by_id text, p_created_by_name text, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
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
  insert into public.issue_slips (id, issued_at, created_by_id, created_by_name)
  values (v_slip_id, p_issued_at, v_created_by_id, v_created_by_name);

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
      v_issue_id, v_line.purchased_item_id, p_issued_at, v_line.base_quantity, 'MANUAL', null, '', v_slip_id
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
    'note', '',
    'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name,
    'lines', v_results
  );
end;
$function$;

create or replace function public.edit_issue_slip_atomic(p_slip_id text, p_remove_issue_ids text[], p_replace_issue_ids text[], p_add_lines jsonb, p_created_by_id text, p_created_by_name text)
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
      v_issue_id, v_line.purchased_item_id, v_slip.issued_at, v_line.base_quantity, 'MANUAL', null, '', v_slip_id
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

alter table public.issue_slips drop column note;
alter table public.stocktake_sessions drop column notes;
alter table public.stocktake_lines drop column item_type;

reset lock_timeout;
