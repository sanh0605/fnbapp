-- Widens 0027_backdated_recipe_detection.sql's detection to cover the case
-- the owner actually uses in practice: editing an existing recipe's
-- end_date to shorten its window (an UPDATE), not just inserting a new
-- recipe row with a past created_at. Also switches the backdating test to
-- the column that actually decides effectiveness (start_date, falling back
-- to created_at -- lib/recipe-selection.ts's selectEffectiveRecipe), since
-- a recipe can be inserted today with created_at = today but
-- start_date deliberately set weeks in the past, which the old
-- created_at-only test could not see.
--
-- Exactly three changes from flag_backdated_recipe_entry() in 0027:
--   1. Threshold test uses coalesce(new.start_date, new.created_at), not
--      new.created_at alone.
--   2. Trigger fires after insert or update on public.recipes, not insert
--      only.
--   3. (Falls out of 1+2, no extra branch needed) an UPDATE that shortens a
--      predecessor's end_date now gets caught: that predecessor's own
--      coalesce(start_date, created_at) is already older than 5 minutes by
--      the time such an edit happens, so the same threshold test fires on
--      the update.
--
-- The app.mac_drift_recovery skip and the 5-minute threshold are unchanged
-- from 0027 -- migration 0042's rebuild suppression depends on that skip,
-- and removing it would flood this table again on every replay.

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
  -- flag_backdated_ledger_entry for stock_ledger). Effectiveness is decided
  -- by start_date, falling back to created_at when start_date is null.
  if coalesce(new.start_date, new.created_at) < now() - interval '5 minutes' then
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
      coalesce(new.start_date, new.created_at),
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

drop trigger if exists detect_backdated_recipe_entry
  on public.recipes;

create trigger detect_backdated_recipe_entry
after insert or update on public.recipes
for each row
execute function public.flag_backdated_recipe_entry();
