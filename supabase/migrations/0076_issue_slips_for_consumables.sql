-- Fixes docs/superpowers/plans/2026-08-30-issue-slips-for-consumables.md.
-- Blocking the owner now: create_issue_slip_atomic refuses any purchased
-- item with no base_ingredient_id, and consumables (cups, lids, straws,
-- bags) have none by design -- every one of the 95 issue rows ever
-- recorded is a raw ingredient, zero consumables, ever.
--
-- Re-derived before writing this (CLAUDE.md section 4, live query, not the
-- plan's prose): base_ingredient_id is used in create_issue_slip_atomic for
-- exactly three things -- the guard itself, a unit name lookup for an error
-- message, and keying the stock_ledger row this migration stops writing.
-- reverse_manual_issue_atomic carries the same guard, same three uses,
-- minus the running-balance seed (it has none -- BR-INV-009, a reversal
-- always returns an already-issued quantity, so nothing to check against).
--
-- The unit-name source is switched from base_ingredients (via
-- base_ingredient_id, null for a consumable) to uom_conversions (via
-- purchased_item_id, present on every item). Verified live before writing
-- this migration: all 146 ACTIVE purchased items carry at least one ACTIVE
-- uom_conversions row, none disagree with each other on base_unit where an
-- item has more than one, and for the 52 raw items that carry both, the
-- conversion's base_unit is identical to the ingredient's own base_unit in
-- all 52 -- so this switch changes nothing about the message an existing
-- raw-ingredient over-issue refusal shows today.
--
-- A second guard was found and fixed here that the plan did not name: both
-- RPCs' TypeScript callers (lib/manual-issue-transaction.ts) hard-require a
-- non-null ledger_id in the RPC's own JSON response, left over from when
-- this function still generated one. Removing the stock_ledger write
-- without touching that check would have broken every issue slip and every
-- reversal, raw ingredient or consumable alike, the moment this migration
-- went live -- not the bug in the screenshot, a new and strictly worse one
-- with the same shape. See that file's companion change, same commit.
--
-- Trigger check re-verified live immediately before writing this migration:
-- stock_ledger carries only trg_stock_ledger_inventory_balances (AFTER
-- INSERT OR DELETE OR UPDATE), which never fires here because this
-- migration removes the insert into stock_ledger that used to fire it.
-- stock_issues and issue_slips carry no triggers, unchanged since 0060/0058.
--
-- Everything else -- the running-balance seed, the purchase-before-issue
-- refusal, the over-issue refusal, the already-reversed / not-MANUAL
-- refusals -- is copied forward byte-identical, the discipline 0074 used.
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
  v_issue_id text;
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

    select name, base_ingredient_id into v_item_name, v_base_ingredient_id
    from public.purchased_items where id = v_line.purchased_item_id;
    if v_item_name is null then
      raise exception 'Dòng %: không tìm thấy mặt hàng %', v_line_index, v_line.purchased_item_id;
    end if;
    -- The base_ingredient_id guard that used to sit here was checked only
    -- for keying the stock_ledger row this migration stops writing -- a
    -- consumable (no base_ingredient_id by design) is now allowed through
    -- exactly like a raw ingredient.

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
      -- Unit name for the message: was base_ingredients via
      -- v_base_ingredient_id (null for a consumable, so this branch could
      -- never be reached for one). Now uom_conversions via
      -- purchased_item_id, present on every item; order by id + limit 1 is
      -- only for determinism when an item carries more than one ACTIVE
      -- conversion -- verified live, none of the 146 disagree on base_unit.
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

-- reverse_manual_issue_atomic carries the same guard (0058:74). A
-- consumable slip that cannot be reversed is worse than one that cannot be
-- written -- fixed together with create_issue_slip_atomic above, not left
-- for later. cancel_issue_slip_atomic (0062) calls this function directly
-- rather than duplicating its logic, so cancelling a whole slip that
-- includes a consumable line is fixed by this alone, no separate change.
create or replace function public.reverse_manual_issue_atomic(
  p_issue_id text,
  p_note text,
  p_created_by_id text,
  p_created_by_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue_id text := nullif(btrim(coalesce(p_issue_id, '')), '');
  v_note text := coalesce(p_note, '');
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_original record;
  v_already_reversed_by text;
  v_base_ingredient_id text;
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

  select base_ingredient_id into v_base_ingredient_id
  from public.purchased_items where id = v_original.purchased_item_id;
  -- The base_ingredient_id guard that used to sit here was checked only for
  -- keying the stock_ledger row this migration stops writing -- a
  -- consumable's issue can now be reversed exactly like a raw ingredient's.

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
    'base_ingredient_id', v_base_ingredient_id,
    'base_quantity', -v_original.base_quantity,
    'issued_at', v_now,
    'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name
  );
end;
$$;

revoke all on function public.reverse_manual_issue_atomic(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reverse_manual_issue_atomic(text, text, text, text)
  to service_role;
