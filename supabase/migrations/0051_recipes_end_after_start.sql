-- A recipe cannot stop applying before it starts. Enforced in the database so
-- no path -- action, RPC, or service-role script -- can produce the row.
-- Two rows violated this before 0051 (RC-033, RC-036), both from an effective
-- date typed earlier than the superseded recipe's start_date. Task 6 Step 6
-- (scripts/fix-backwards-recipe-intervals.ts) deactivated both rather than
-- rewriting their dates, so the impossible interval stays on record as
-- evidence of the defect.
--
-- Both the guard and the constraint are scoped to status = 'ACTIVE': an
-- INACTIVE row's broken interval is deliberately kept exactly as it was
-- (docs/COLLABORATION.md forbids deleting master data), and must not block
-- this migration or any future one. Only ACTIVE rows are required to satisfy
-- the invariant going forward.

do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
    from public.recipes
   where status = 'ACTIVE'
     and end_date is not null
     and start_date is not null
     and end_date < start_date;
  if bad_count > 0 then
    raise exception
      'Cannot add recipes_end_after_start: % active rows still violate it. Run scripts/fix-backwards-recipe-intervals.ts --apply first.',
      bad_count;
  end if;
end $$;

alter table public.recipes
  add constraint recipes_end_after_start
  check (
    status <> 'ACTIVE'
    or end_date is null
    or start_date is null
    or end_date >= start_date
  );
