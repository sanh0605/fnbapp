-- 0043's flag_backdated_recipe_entry() tests
-- coalesce(new.start_date, new.created_at) because start_date could be
-- null. 0048 made it NOT NULL, so the coalesce is dead code that keeps the
-- old ambiguity readable in the schema. Drop it so the trigger states the
-- same rule the application now states.
--
-- Behaviour is identical for every row that can exist after 0048. The
-- trigger (detect_backdated_recipe_entry, created in 0043) is unchanged --
-- only the function body it calls, flag_backdated_recipe_entry(), changes.

create or replace function public.flag_backdated_recipe_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip during recovery because replay writes old timestamps intentionally.
  if current_setting('app.mac_drift_recovery', true) = 'on' then
    return new;
  end if;

  -- Five minutes allows normal transaction latency without suppressing
  -- intentional operator backdating (same threshold as
  -- flag_backdated_ledger_entry for stock_ledger). start_date is NOT NULL
  -- as of 0048, so it alone decides effectiveness -- no fallback needed.
  if new.start_date < now() - interval '5 minutes' then
    insert into public.backdated_recipe_events (
      recipe_id,
      target_type,
      target_id,
      effective_timestamp,
      visibility_timestamp
    ) values (
      new.id,
      new.target_type,
      new.target_id,
      new.start_date,
      now()
    )
    on conflict (recipe_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.flag_backdated_recipe_entry() from public;
revoke all on function public.flag_backdated_recipe_entry() from anon;
revoke all on function public.flag_backdated_recipe_entry() from authenticated;
