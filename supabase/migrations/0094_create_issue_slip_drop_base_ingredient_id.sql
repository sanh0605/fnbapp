-- Step 2 of the ingredient-group removal (OPEN-ITEMS 75), issue-slip
-- function 2 of 2, last per plan section 2.2's ordering (the 0076 lesson
-- run in this direction: TypeScript stopped reading this key first,
-- non-issue-slip functions went first, issue slips go last) --
-- docs/superpowers/plans/2026-09-01-drop-base-ingredient-id-column.md
-- section 1.3/2.2. create_issue_slip_atomic only ever read
-- base_ingredient_id to relay it back per line in the return payload -- a
-- pass-through. The purchase-before-issue check, the over-issue check,
-- and the running-balance math are all keyed on purchased_item_id,
-- untouched here.
--
-- lib/manual-issue-transaction.ts's parseIssueSlipResult already stopped
-- reading this key (this task's own TypeScript commit, ahead of this
-- migration).
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
  v_total_issued_asof numeric(18,6);
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
        and po.transaction_date <= p_issued_at;

      select coalesce(sum(base_quantity), 0)
      into v_total_issued_asof
      from public.stock_issues
      where purchased_item_id = v_line.purchased_item_id
        and issued_at <= p_issued_at;

      if v_total_purchased_asof = 0 then
        raise exception 'Dòng % (%): chưa có đơn nhập nào tính tới thời điểm %, không thể xuất trước khi nhập',
          v_line_index, v_item_name, p_issued_at;
      end if;

      v_item_ids := array_append(v_item_ids, v_line.purchased_item_id);
      v_remaining := array_append(v_remaining, v_total_purchased_asof - v_total_issued_asof);
      v_idx := array_length(v_item_ids, 1);
    end if;

    if v_line.base_quantity > v_remaining[v_idx] then
      select u.name into v_base_unit_name
      from public.uom_conversions uc join public.units u on u.id = uc.base_unit
      where uc.purchased_item_id = v_line.purchased_item_id and uc.status = 'ACTIVE'
      order by uc.id
      limit 1;
      raise exception 'Dòng % (%): yêu cầu xuất % %, chỉ còn % % tính tới thời điểm % (đã trừ các dòng khác cùng mặt hàng trong phiếu này)',
        v_line_index, v_item_name, v_line.base_quantity, coalesce(v_base_unit_name, ''),
        v_remaining[v_idx], coalesce(v_base_unit_name, ''), p_issued_at;
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
