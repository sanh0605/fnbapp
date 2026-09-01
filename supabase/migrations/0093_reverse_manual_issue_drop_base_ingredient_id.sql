-- Step 2 of the ingredient-group removal (OPEN-ITEMS 75), issue-slip
-- function 1 of 2 -- docs/superpowers/plans/2026-09-01-drop-base-ingredient-id-column.md
-- section 1.3/2.2. reverse_manual_issue_atomic only ever read
-- base_ingredient_id to relay it back in the return payload -- a pass-
-- through, never used to decide anything (the reversal quantity, the
-- refusal checks, and the running-balance math are all keyed on
-- purchased_item_id, untouched here).
--
-- lib/manual-issue-transaction.ts's parseReversalResult stopped reading
-- this key first (this task's own TypeScript commit, ahead of this
-- migration, per the 0076 lesson) -- so dropping it from the return
-- payload here is safe: no code left expects it.
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
