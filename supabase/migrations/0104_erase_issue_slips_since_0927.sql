-- One-time exception to BR-INV-009, owner decision 2026-09-28: every issue
-- slip from 2026-09-27 to the moment of the decision is erased, not
-- reversed -- ISL-00075..ISL-00088, their stock_issues lines, and the rows
-- that reverse those lines.
--
-- Measured 2026-09-28 (read-only query against production):
--   * 14 slips, ISL-00075..ISL-00088; every one has lines.
--   * 32 lines carry those slip ids.
--   * 25 reversal rows (issue_slip_id null, reverses_issue_id set), all
--     created 2026-09-27/28, every one reversing a line of ISL-00075..00082
--     (the owner's "Huỷ cả phiếu" at 20:09 on 2026-09-28, plus ISS-00194 at
--     15:13 on 2026-09-27 reversing one line of ISL-00077).
--   * No stock_issues row outside these 57 references any of them; no row
--     created since 2026-09-27 is dated earlier.
-- ISL-00075..00082 are already net zero in quantity (every line reversed);
-- erasing them removes the trail. ISL-00083..00088 (28/09) are live, 7
-- lines -- erasing them raises book stock by exactly those quantities
-- (Sữa tươi Mlekovita 1 l, Sữa yến mạch Oatside 2 l, Sữa đặc La rosee 1 l,
-- Bột sữa B One 1 kg, Bột cà phê Robusta 500 g, Bột cà phê Phin Đậm 500 g).
-- The owner accepted that the next count will show it.
--
-- Triggers, read from migration text (supabase/CLAUDE.md: no session here
-- can query pg_catalog): none on stock_issues (0052 onward) or issue_slips
-- (0060 says so; no later create trigger). Foreign keys: stock_issues.
-- reverses_issue_id -> stock_issues (0058) and stock_issues.issue_slip_id
-- -> issue_slips (0060), neither cascading -- hence the delete order:
-- reversals, then lines, then headers. Nothing else references either
-- table. The guard refuses if any measured count has changed by the time
-- this runs (a new slip in the range, a new reversal, a row pointing in).

do $$
declare
  v_slips integer;
  v_lines integer;
  v_reversals integer;
begin
  select count(*) into v_slips
  from public.issue_slips where id between 'ISL-00075' and 'ISL-00088';
  if v_slips <> 14 then
    raise exception 'Expected 14 issue slips ISL-00075..ISL-00088, found %', v_slips;
  end if;

  select count(*) into v_lines
  from public.stock_issues where issue_slip_id between 'ISL-00075' and 'ISL-00088';
  if v_lines <> 32 then
    raise exception 'Expected 32 lines on ISL-00075..ISL-00088, found %', v_lines;
  end if;

  select count(*) into v_reversals
  from public.stock_issues
  where reverses_issue_id in (
    select id from public.stock_issues where issue_slip_id between 'ISL-00075' and 'ISL-00088'
  );
  if v_reversals <> 25 then
    raise exception 'Expected 25 reversals of those lines, found %', v_reversals;
  end if;

  if exists (
    select 1 from public.stock_issues outside_row
    where outside_row.reverses_issue_id in (
      select id from public.stock_issues
      where issue_slip_id between 'ISL-00075' and 'ISL-00088'
         or reverses_issue_id in (
           select id from public.stock_issues where issue_slip_id between 'ISL-00075' and 'ISL-00088'
         )
    )
    and not (
      outside_row.issue_slip_id is not null and outside_row.issue_slip_id between 'ISL-00075' and 'ISL-00088'
    )
    and outside_row.reverses_issue_id not in (
      select id from public.stock_issues where issue_slip_id between 'ISL-00075' and 'ISL-00088'
    )
  ) then
    raise exception 'A stock_issues row outside the erased set reverses one inside it';
  end if;
end;
$$;

delete from public.stock_issues where reverses_issue_id in (
  select id from public.stock_issues where issue_slip_id between 'ISL-00075' and 'ISL-00088'
);
delete from public.stock_issues where issue_slip_id in (
  select id from public.issue_slips where id between 'ISL-00075' and 'ISL-00088'
);
delete from public.issue_slips where id between 'ISL-00075' and 'ISL-00088';
