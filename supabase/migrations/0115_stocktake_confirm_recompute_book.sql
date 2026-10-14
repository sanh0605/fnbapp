-- supabase/migrations/0115_stocktake_confirm_recompute_book.sql
-- BR-INV-017 (owner 2026-10-14, audit item A2, chose "Tu tinh lai luc xac nhan"):
-- confirming a stocktake recomputes each counted line's book quantity as of the
-- moment that line was counted, instead of using the figure frozen at the count
-- (theoretical_at_count, 0092).
--
-- Example: Sữa tươi is counted 8 at 15:00 against a frozen book of 10. An issue
-- slip of 2 dated 14:00 is entered afterwards. Recomputed as of 15:00 the book is
-- 8, so the count matches: nothing is written for Sữa tươi, and it is reported
-- in recomputed_lines as 10 -> 8. Before this, confirming wrote a shortfall of 2
-- and took the 2 off twice.
--
-- Book as of a moment = completed purchase lines dated up to it, minus stock_issues
-- dated up to it, the same expression issue_stock_headroom (0106) uses (purchase
-- date = transaction_date, else created_at; a purchase at the same instant counts,
-- like the costing engine). One difference: a reversal row (cancelled slip, undone
-- stocktake; reverses_issue_id set) is dated the day it was written, so it counts
-- from its original row's date instead; a slip cancelled after the count nets out.
-- No SQL function returns "the balance at a moment" by itself, so the expression
-- is used inline here rather than inventing a second definition of it.
--
-- Changes against the 0089 body (the latest apply_stocktake_session_atomic), all
-- marked "0115":
--   - each counted line's book is recomputed as of its counted_at; the variance,
--     the plan hash and the written shortfall/found rows come from it;
--   - a line whose book differs from the frozen figure is listed in the new
--     recomputed_lines key (also when its variance becomes zero), and at a real
--     confirm its stocktake_lines.theoretical_at_count is set to the recomputed
--     figure, so the stocktake page and edit_confirmed_stocktake_atomic (0110,
--     which reads that column) start from the figure that was acted on;
--   - blank lines stay uncounted (BR-INV-011): the loop still reads only lines
--     with a counted quantity.
-- The preview (dry run) recomputes the same way and writes nothing, so the plan
-- hash a user confirms is the one the confirm checks; if a slip is entered
-- between preview and confirm the hash differs and the confirm asks for a new
-- preview, as before.
--
-- Triggers, read from migration text (supabase/CLAUDE.md: no session here can
-- query pg_catalog; grep of every `create trigger` / `drop trigger`):
--   stocktake_lines: none, ever (0036 creates only the stocktake_sessions touch
--     trigger). The update added here fires nothing.
--   stocktake_sessions: trg_stocktake_sessions_touch (0036, BEFORE UPDATE, sets
--     updated_at); already fired by the confirm update below, unchanged.
--   stock_issues: none, ever.
--
-- Deploy order: the TypeScript wrapper (lib/stock/stocktake-transaction.ts)
-- reads the new recomputed_lines key and defaults it to [] when absent, so the
-- new code works against the old function; the old code ignores the new key. The
-- two go up together, with separate owner approvals. Not applied by the author.
create or replace function public.apply_stocktake_session_atomic(p_session_id text, p_confirmed_by_id text, p_confirmed_by_name text, p_dry_run boolean default false, p_expected_plan_hash text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
      v_issue_id := 'ISS-' || lpad(v_next_issue_number::text, 5, '0');
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

revoke all on function public.apply_stocktake_session_atomic(text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.apply_stocktake_session_atomic(text, text, text, boolean, text) to service_role;
