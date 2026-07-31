-- recipes.start_date becomes mandatory.
--
-- Until now effectiveness was decided by a read-time fallback
-- (start_date || created_at, lib/recipe-selection.ts). That made two
-- different situations indistinguishable in the data: "start_date is null
-- because it equals created_at" and "start_date is null because nobody set
-- it". Every reader had to remember the fallback, and any reader that forgot
-- it disagreed with the others about when a recipe took effect.
--
-- The write paths already set start_date (0044 save_product_atomic,
-- app/admin/semi-products/actions.ts, app/admin/products/modifiers/actions.ts).
-- The historical nulls were backfilled with created_at by
-- scripts/backfill-recipe-start-date.ts, which proved the change neutral by
-- replaying recipe selection over every order line.
--
-- Guard: this migration fails loudly rather than silently skipping if any
-- null survives, so a partial backfill cannot be mistaken for success.

do $$
declare
  null_count integer;
begin
  select count(*) into null_count from public.recipes where start_date is null;
  if null_count > 0 then
    raise exception
      'Cannot set recipes.start_date NOT NULL: % rows still null. Run scripts/backfill-recipe-start-date.ts --apply first.',
      null_count;
  end if;
end $$;

alter table public.recipes
  alter column start_date set not null;
