-- Plan D D9: the issue slip needs multiple lines and a searchable picker.
-- Design: docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md
-- section 5 (I10/I11 "in full") and section 8 (D9).
--
-- Trigger check re-verified live immediately before writing this
-- migration, same result as every prior check this plan: stock_ledger
-- carries only trg_stock_ledger_inventory_balances; stock_issues has none.
-- issue_slips is a new table with no triggers of its own.
--
-- The owner's own review of the finished D7a screen: one item per slip
-- forced five separate trips through the form for one real event (throwing
-- away five spoiled things), and a bare <select> over 52 items was a
-- scrolling exercise. Both trace to the same mistake -- §5 specified I1-I9
-- in terms of what a single stock_issues row must do, and the screen
-- followed the data model one row to one form. Nothing in the schema ever
-- forced that: stock_issues rows are independent, so one slip can write
-- several.
--
-- issue_slips is the header a slip's lines are grouped under, mirroring
-- purchase_orders/purchase_order_lines -- the screen the owner asked this
-- one to become symmetric with. stock_issues keeps writing one row per
-- line (I9 unchanged in shape); issue_slip_id is the only new link.
create table if not exists public.issue_slips (
  id text primary key,
  issued_at timestamptz not null,
  note text not null default '',
  created_by_id text not null,
  created_by_name text not null,
  created_at timestamptz not null default now()
);
alter table public.issue_slips enable row level security;
revoke all on table public.issue_slips from public, anon, authenticated;
grant select, insert on table public.issue_slips to service_role;

alter table public.stock_issues
  add column if not exists issue_slip_id text references public.issue_slips(id);
create index if not exists idx_stock_issues_issue_slip on public.stock_issues(issue_slip_id);

-- create_manual_issue_atomic (0057) is superseded, not paralleled -- a
-- single-line slip is just the degenerate case of a multi-line one, and
-- keeping both would mean the same class of bug (I4/I5 checked wrong) could
-- exist in two places and only get fixed in one. It was never deployed
-- (D7a's screen never shipped), so nothing live depends on it.
drop function if exists public.create_manual_issue_atomic(text, numeric, timestamptz, text, text, text);

-- I10: two lines naming the same purchased item are allowed (matches
-- PurchaseOrderForm's own behaviour -- checked first, it does not merge or
-- refuse duplicates either) and validated CUMULATIVELY: a running
-- remaining-balance per purchased item, seeded once from the on-hand-as-of-
-- issued_at figure (I4's own formula) and decremented as each line in the
-- slip is processed in order, so a later line sees what earlier lines in
-- the SAME slip already committed to before anything is written.
--
-- Atomicity: any exception raised anywhere in the loop propagates straight
-- up (no exception handler swallows it), which aborts the whole
-- transaction -- a bad line on line 4 of 5 leaves nothing written, not
-- lines 1-3 committed and line 4 refused.
--
-- I11 needs no change here: each line still writes its own stock_issues
-- row, so reverse_manual_issue_atomic (D7b) reverses one line exactly as
-- it always has.
create or replace function public.create_issue_slip_atomic(
  p_issued_at timestamptz,
  p_note text,
  p_created_by_id text,
  p_created_by_name text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := coalesce(p_note, '');
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_next_slip_number integer;
  v_slip_id text;
  v_next_issue_number integer;
  v_next_ledger_number integer;
  v_issue_id text;
  v_ledger_id text;
  v_line record;
  v_line_index integer := 0;
  v_item_ids text[] := '{}';
  v_remaining numeric[] := '{}';
  v_idx integer;
  v_item_name text;
  v_base_ingredient_id text;
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
  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));
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
  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0)
  into v_next_ledger_number
  from public.stock_ledger where id ~ '^STK-[0-9]+$';

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

    select name, base_ingredient_id into v_item_name, v_base_ingredient_id
    from public.purchased_items where id = v_line.purchased_item_id;
    if v_item_name is null then
      raise exception 'Dòng %: không tìm thấy mặt hàng %', v_line_index, v_line.purchased_item_id;
    end if;
    if v_base_ingredient_id is null then
      raise exception 'Dòng %: % chưa gắn với nguyên liệu gốc, không thể ghi phiếu xuất', v_line_index, v_item_name;
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
      from public.base_ingredients bi join public.units u on u.id = bi.base_unit
      where bi.id = v_base_ingredient_id;
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

    v_next_ledger_number := v_next_ledger_number + 1;
    v_ledger_id := 'STK-' || lpad(v_next_ledger_number::text, 3, '0');
    insert into public.stock_ledger (
      id, transaction_type, reference_id, item_reference, quantity_change, unit_cost, created_at, notes
    ) values (
      v_ledger_id, 'STOCK_ADJUST', v_issue_id, v_base_ingredient_id, -v_line.base_quantity, 0, p_issued_at,
      'Phiếu xuất thủ công ' || v_slip_id || ' -- dòng ' || v_line_index ||
        coalesce(' -- ' || nullif(btrim(v_note), ''), '')
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'issue_id', v_issue_id,
      'ledger_id', v_ledger_id,
      'purchased_item_id', v_line.purchased_item_id,
      'base_ingredient_id', v_base_ingredient_id,
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
$$;

revoke all on function public.create_issue_slip_atomic(timestamptz, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_issue_slip_atomic(timestamptz, text, text, text, jsonb)
  to service_role;
