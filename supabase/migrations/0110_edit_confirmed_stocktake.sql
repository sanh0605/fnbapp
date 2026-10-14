-- BR-INV-012 (owner 2026-09-28 1b/2a, 2026-10-14 Q4 "a", "1a 2b 3b"):
-- the owner edits counted quantities of the most recent confirmed stocktake;
-- the session's stock_issues rows move in place, dated the confirmation
-- instant, so the change lands on the count's own date. No reason, no
-- history (owner: added when someone else takes over editing).
--
-- Trigger check first (supabase/CLAUDE.md). Derived from migration text, not
-- from the live server: grep of every `create trigger` / `drop trigger`.
--   stocktake_sessions: trg_stocktake_sessions_touch (0036), before update,
--     body `new.updated_at = <current time>`. This function only reads and
--     locks that table, so it never fires.
--   stocktake_lines: none (0052 header). This function updates counted_qty.
--   stock_issues: none (0052 header). This function inserts, updates, deletes.
-- Foreign keys into stock_issues: only reverses_issue_id (0058), set by the
-- reversal and manual-issue paths. A CONFIRMED session has no reversal rows
-- (reversing flips it to REVERSED), so no delete here can be blocked by it.
-- stock_issues.base_quantity must be non-zero (0056): a variance of 0 deletes
-- the row, it never writes a zero row.
create or replace function public.edit_confirmed_stocktake_atomic(p_session_id text, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
      v_issue_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');
      insert into public.stock_issues (id, purchased_item_id, issued_at, base_quantity, source, session_id, note)
      values (v_issue_id, v_line.item_reference, v_confirmed_at, -v_variance, 'STOCKTAKE', v_session_id, v_note);
      v_issue_ids := v_issue_ids || jsonb_build_array(v_issue_id);
    end if;
  end loop;

  return jsonb_build_object('session_id', v_session_id, 'changed_count', v_changed, 'issue_ids', v_issue_ids);
end;
$$;

revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from public;
revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from anon;
revoke all on function public.edit_confirmed_stocktake_atomic(text, jsonb) from authenticated;
grant execute on function public.edit_confirmed_stocktake_atomic(text, jsonb) to service_role;
