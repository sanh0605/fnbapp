-- Issue-slip edit: edit_issue_slip_atomic, stock headroom (lowest balance
-- from a slip's date to now), and the stocktake lock (BR-INV-013).
-- Sources: docs/superpowers/plans/2026-09-29-phieu-xuat.md, spec
-- docs/superpowers/specs/2026-09-29-phieu-xuat-danh-sach-design.md sections 4
-- and 6, and BR-INV-013 (owner 2026-09-29: stock check covers the slip date
-- through now; no slip dated on or before the latest CONFIRMED stocktake).
--
-- Triggers, read from migration text (supabase/CLAUDE.md: no session here can
-- query pg_catalog; grep of every `create trigger` / `drop trigger`):
--   stock_issues: none, ever (0052 onward; 0062 and 0104 say the same).
--     Rows written here (new lines, reversal rows) fire nothing; on-hand is
--     summed at read time from stock_issues and purchase_order_lines.
--   issue_slips: none, ever (0060; no later create trigger). This migration
--     only locks and reads it.
--   Also read, never written: stocktake_sessions has trg_stocktake_sessions_touch
--     (0036, BEFORE UPDATE, sets updated_at); nothing here updates it.
--
-- Order of rollout: code of Tasks 5-8 goes up together with this file. The
-- new functions have no caller until that code lands, and the three redefined
-- functions (reverse_manual_issue_atomic, cancel_issue_slip_atomic,
-- create_issue_slip_atomic) keep their signatures and return shapes, so
-- running this a few minutes before or after the code does not break the POS
-- or the old pages. Not applied by the author; the owner approves separately.
--
-- Bodies of the three redefined functions are copied verbatim from their
-- latest definitions (0093, 0063, 0094), converted to $function$ delimiters,
-- with only the lock / headroom additions marked "0106".

create or replace function public.issue_stock_headroom(p_purchased_item_id text, p_at timestamptz)
returns numeric language sql stable security definer set search_path to 'public' as $function$
  -- Lowest balance from p_at to now. Purchases only raise the balance, so the
  -- minimum sits at p_at or right after a later positive issue. Mirrors the
  -- costing engine's order: a purchase at the same instant lands first.
  with points as (
    select p_at as at
    union
    select si.issued_at from public.stock_issues si
    where si.purchased_item_id = p_purchased_item_id and si.issued_at > p_at and si.base_quantity > 0
  )
  select min(
    coalesce((select sum(pol.base_quantity) from public.purchase_order_lines pol
              join public.purchase_orders po on po.id = pol.purchase_order_id
              where po.status = 'COMPLETED' and pol.purchased_item_id = p_purchased_item_id
                and coalesce(po.transaction_date, po.created_at) <= points.at), 0)
    - coalesce((select sum(si.base_quantity) from public.stock_issues si
                where si.purchased_item_id = p_purchased_item_id and si.issued_at <= points.at), 0)
  ) from points;
$function$;

create or replace function public.issue_slip_stocktake_lock(p_issued_at timestamptz)
returns text language sql stable security definer set search_path to 'public' as $function$
  -- The latest CONFIRMED session locks every slip dated on or before its
  -- confirmation (BR-INV-013). An undone session is REVERSED, so it drops out.
  select case when p_issued_at <= latest.confirmed_at then latest.id end
  from (
    select s.id, s.confirmed_at from public.stocktake_sessions s
    where s.status = 'CONFIRMED' and s.confirmed_at is not null
    order by s.confirmed_at desc limit 1
  ) latest
$function$;

revoke all on function public.issue_stock_headroom(text, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_stock_headroom(text, timestamptz) to service_role;
revoke all on function public.issue_slip_stocktake_lock(timestamptz) from public, anon, authenticated;
grant execute on function public.issue_slip_stocktake_lock(timestamptz) to service_role;

-- reverse_manual_issue_atomic: 0093 body + stocktake lock.
create or replace function public.reverse_manual_issue_atomic(p_issue_id text, p_note text, p_created_by_id text, p_created_by_name text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  v_reversal_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');

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

revoke all on function public.reverse_manual_issue_atomic(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reverse_manual_issue_atomic(text, text, text, text)
  to service_role;

-- cancel_issue_slip_atomic: 0063 body + stocktake lock before the loop.
create or replace function public.cancel_issue_slip_atomic(
  p_slip_id text,
  p_reason text,
  p_created_by_id text,
  p_created_by_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_slip_id text := nullif(btrim(coalesce(p_slip_id, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_note text;
  v_row record;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_slip_issued_at timestamptz;
  v_lock text;
begin
  if v_slip_id is null then raise exception 'p_slip_id is required'; end if;
  if v_reason is null then raise exception 'Lý do huỷ phiếu là bắt buộc'; end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;

  select issued_at into v_slip_issued_at from public.issue_slips where id = v_slip_id;
  if not found then
    raise exception 'Không tìm thấy phiếu xuất kho: %', v_slip_id;
  end if;

  -- 0106 (BR-INV-013): nothing dated on or before the last confirmed count.
  v_lock := public.issue_slip_stocktake_lock(v_slip_issued_at);
  if v_lock is not null then
    raise exception 'Phiếu % nằm trước lần kiểm kê % nên không huỷ được nữa.', v_slip_id, v_lock;
  end if;

  v_note := 'Huỷ cả phiếu ' || v_slip_id || ' -- ' || v_reason;

  for v_row in
    select si.id
    from public.stock_issues si
    where si.issue_slip_id = v_slip_id
      and not exists (select 1 from public.stock_issues r where r.reverses_issue_id = si.id)
    order by si.id
  loop
    v_result := public.reverse_manual_issue_atomic(v_row.id, v_note, v_created_by_id, v_created_by_name);
    v_results := v_results || jsonb_build_array(v_result);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Phiếu % không còn dòng nào để huỷ -- có thể đã được đảo toàn bộ trước đó', v_slip_id;
  end if;

  return jsonb_build_object(
    'slip_id', v_slip_id,
    'reason', v_reason,
    'reversed_count', v_count,
    'reversals', v_results
  );
end;
$function$;

revoke all on function public.cancel_issue_slip_atomic(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cancel_issue_slip_atomic(text, text, text, text)
  to service_role;

-- create_issue_slip_atomic: 0094 body; the running balance is seeded from
-- issue_stock_headroom (lowest balance from the slip date to now) and a slip
-- dated on or before the last confirmed stocktake is refused.
create or replace function public.create_issue_slip_atomic(p_issued_at timestamp with time zone, p_note text, p_created_by_id text, p_created_by_name text, p_lines jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  v_slip_id := 'ISL-' || lpad(v_next_slip_number::text, 5, '0');
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
    v_issue_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');
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

revoke all on function public.create_issue_slip_atomic(timestamp with time zone, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_issue_slip_atomic(timestamp with time zone, text, text, text, jsonb)
  to service_role;

-- edit_issue_slip_atomic: reverse some lines of a slip and add new ones dated
-- on the slip, in one transaction. Task 5 loads the slip's original lines
-- server-side and passes only the ids to remove and the lines to add; nothing
-- here trusts a client-supplied original.
-- p_remove_issue_ids: pure deletes, reversed now (BR-INV-009). p_replace_issue_ids:
-- quantity changes, reversed on the original row's own date (BR-INV-013, owner
-- 2026-09-29); the new quantity arrives in p_add_lines.
create or replace function public.edit_issue_slip_atomic(
  p_slip_id text,
  p_remove_issue_ids text[],
  p_replace_issue_ids text[],
  p_add_lines jsonb,
  p_created_by_id text,
  p_created_by_name text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    v_issue_id := 'ISS-' || lpad(v_reversal_number::text, 5, '0');
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
    v_issue_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');
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

revoke all on function public.edit_issue_slip_atomic(text, text[], text[], jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.edit_issue_slip_atomic(text, text[], text[], jsonb, text, text)
  to service_role;
