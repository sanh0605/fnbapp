-- Plan D D7a: a manual issue slip (Gap 2 -- until now nothing wrote
-- stock_issues with source = 'MANUAL'; the only writer was the stocktake
-- RPC). Design: docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md
-- section 8, D7a.
--
-- Triggers on the two tables this migration writes to, checked live
-- immediately before writing this file (supabase db query --linked):
--   stock_ledger: trg_stock_ledger_inventory_balances (AFTER INSERT OR
--     DELETE OR UPDATE OF item_reference, quantity_change) -- fires on the
--     ingredient-correction row this RPC inserts (I9) and keeps
--     inventory_balances in sync, same as every other stock_ledger writer.
--     detect_backdated_ledger_entry no longer exists -- Plan C Task 6
--     retired the whole backdated-correction machinery, confirmed absent in
--     this same live check.
--   stock_issues: no triggers.
--
-- I4 ("issuing more than on hand must block before writing, not let
-- computeIssueCosting throw after the fact") and I5 ("issue dated before
-- any purchase") are both enforced here against the on-hand snapshot AS OF
-- p_issued_at -- total purchased from COMPLETED orders transacted at or
-- before p_issued_at, minus total issued at or before p_issued_at -- not
-- today's global total. A backdated slip is checked against what was
-- actually on the shelf at that moment, not what is on the shelf now.
--
-- Not attempted here: proving a backdated insert cannot retroactively
-- invalidate some LATER already-existing issue (push its own on-hand
-- negative). stock_issues holds zero real rows today, so no such later
-- event exists yet to endanger; flagged in the plan (D7a) as a known,
-- accepted scope limit for a single-admin, low-concurrency shop tool,
-- not a silent gap.
--
-- I9 ("an issue slip must also correct the ingredient quantity") is the
-- same shape as D5's S4, minus D5's completeness machinery (C6/S1/S2) --
-- those exist because a stocktake count can be partial and blank must not
-- silently mean zero. A manual issue slip is one deliberate, complete
-- action on one purchased item: its ingredient correction is written in
-- the same transaction, for the same quantity, unconditionally.
create or replace function public.create_manual_issue_atomic(
  p_purchased_item_id text,
  p_base_quantity numeric,
  p_issued_at timestamptz,
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
  v_purchased_item_id text := nullif(btrim(coalesce(p_purchased_item_id, '')), '');
  v_note text := coalesce(p_note, '');
  v_created_by_id text := nullif(btrim(coalesce(p_created_by_id, '')), '');
  v_created_by_name text := nullif(btrim(coalesce(p_created_by_name, '')), '');
  v_item_name text;
  v_base_ingredient_id text;
  v_base_unit text;
  v_total_purchased_asof numeric(18,6);
  v_total_issued_asof numeric(18,6);
  v_on_hand_asof numeric(18,6);
  v_next_issue_number integer;
  v_next_ledger_number integer;
  v_issue_id text;
  v_ledger_id text;
begin
  if v_purchased_item_id is null then raise exception 'p_purchased_item_id is required'; end if;
  if p_base_quantity is null or p_base_quantity <= 0 or p_base_quantity = 'NaN'::numeric then
    raise exception 'p_base_quantity must be a finite number > 0';
  end if;
  if p_issued_at is null then raise exception 'p_issued_at is required'; end if;
  if p_issued_at > now() + interval '5 minutes' then
    raise exception 'p_issued_at (%) cannot be in the future', p_issued_at;
  end if;
  if v_created_by_id is null then raise exception 'p_created_by_id is required'; end if;
  if v_created_by_name is null then raise exception 'p_created_by_name is required'; end if;

  select name, base_ingredient_id into v_item_name, v_base_ingredient_id
  from public.purchased_items where id = v_purchased_item_id;
  if v_item_name is null then raise exception 'Unknown purchased item: %', v_purchased_item_id; end if;
  if v_base_ingredient_id is null then
    raise exception 'Mặt hàng % chưa gắn với nguyên liệu gốc, không thể ghi phiếu xuất', v_item_name;
  end if;
  -- Resolve the unit's display name, not its id -- error messages read by
  -- the owner must say "g" or "ml", not "UNT-017" (CLAUDE.md section 5).
  select u.name into v_base_unit
  from public.base_ingredients bi
  join public.units u on u.id = bi.base_unit
  where bi.id = v_base_ingredient_id;

  -- Serialize with every other stock_issues/stock_ledger writer (stocktake
  -- apply reuses the exact same two lock names) so two slips for the same
  -- item cannot both read the same stale on-hand and both succeed.
  perform pg_advisory_xact_lock(hashtext('stock_issues:id'));
  perform pg_advisory_xact_lock(hashtext('stock_ledger:id'));

  select coalesce(sum(pol.base_quantity), 0)
  into v_total_purchased_asof
  from public.purchase_order_lines pol
  join public.purchase_orders po on po.id = pol.purchase_order_id
  where po.status = 'COMPLETED'
    and pol.purchased_item_id = v_purchased_item_id
    and po.transaction_date <= p_issued_at;

  select coalesce(sum(base_quantity), 0)
  into v_total_issued_asof
  from public.stock_issues
  where purchased_item_id = v_purchased_item_id
    and issued_at <= p_issued_at;

  v_on_hand_asof := v_total_purchased_asof - v_total_issued_asof;

  if v_total_purchased_asof = 0 then
    raise exception 'Chưa có đơn nhập nào cho % (%) tính tới thời điểm %, không thể xuất trước khi nhập',
      v_item_name, v_purchased_item_id, p_issued_at;
  end if;
  if p_base_quantity > v_on_hand_asof then
    raise exception 'Xuất % % vượt tồn kho % của % (%) tính tới thời điểm %',
      p_base_quantity, coalesce(v_base_unit, ''), v_on_hand_asof, v_item_name, v_purchased_item_id, p_issued_at;
  end if;

  select coalesce(max(substring(id from '^ISS-([0-9]+)$')::integer), 0) + 1
  into v_next_issue_number
  from public.stock_issues where id ~ '^ISS-[0-9]+$';
  v_issue_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');

  insert into public.stock_issues (
    id, purchased_item_id, issued_at, base_quantity, source, session_id, note
  ) values (
    v_issue_id, v_purchased_item_id, p_issued_at, p_base_quantity, 'MANUAL', null, v_note
  );

  select coalesce(max(substring(id from '^STK-([0-9]+)$')::integer), 0) + 1
  into v_next_ledger_number
  from public.stock_ledger where id ~ '^STK-[0-9]+$';
  v_ledger_id := 'STK-' || lpad(v_next_ledger_number::text, 3, '0');

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change, unit_cost, created_at, notes
  ) values (
    v_ledger_id, 'STOCK_ADJUST', v_issue_id, v_base_ingredient_id, -p_base_quantity, 0, p_issued_at,
    'Phiếu xuất thủ công ' || v_issue_id || coalesce(' -- ' || nullif(v_note, ''), '')
  );

  return jsonb_build_object(
    'issue_id', v_issue_id,
    'ledger_id', v_ledger_id,
    'purchased_item_id', v_purchased_item_id,
    'base_ingredient_id', v_base_ingredient_id,
    'base_quantity', p_base_quantity,
    'issued_at', p_issued_at,
    'on_hand_before', v_on_hand_asof,
    'on_hand_after', v_on_hand_asof - p_base_quantity,
    'created_by_id', v_created_by_id,
    'created_by_name', v_created_by_name
  );
end;
$$;

revoke all on function public.create_manual_issue_atomic(text, numeric, timestamptz, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_manual_issue_atomic(text, numeric, timestamptz, text, text, text)
  to service_role;
