-- docs/superpowers/plans/2026-09-07-link-toppings-to-products.md,
-- BR-CATALOG-003 (docs/02-rules/business-rules/catalog.md). Owner decision
-- 2026-09-07, asked and answered twice: keep both sale paths for a topping
-- (add-on into order_lines_v2.modifiers_snapshot_json, and standalone as a
-- CAT-007 product) and link the two records instead of merging them.
--
-- Trigger check first, per fnbapp-bulk-data-change, re-verified live against
-- production immediately before writing this migration:
--   select tgname, pg_get_triggerdef(oid) from pg_trigger
--    where tgrelid = 'public.modifiers'::regclass and not tgisinternal;
-- Exactly one: trg_modifiers_touch, BEFORE UPDATE, calls touch_updated_at().
-- No queue, no other automation reads from it -- the same shape as the
-- skill's own worked example. The backfill below will bump updated_at on
-- the 8 rows it links; declared here as the one side effect, not a risk.
--
-- Writer inventory (skill step 6, for the new nullable column + FK): the
-- only writer is app/admin/products/modifiers/actions.ts's saveModifierAction,
-- which inserts/updates without ever setting product_id -- a new modifier
-- lands with product_id null, same as MOD-009 today, and stays linkable by
-- a future backfill. Nothing breaks.
--
-- Numbers re-measured 2026-09-07 against production immediately before
-- writing this migration (Task 0 of the plan above), matching BR-CATALOG-003
-- exactly: 9 modifiers, 7 CAT-007 products, 278 add-on units / 1.385.000đ
-- across all 9 modifiers (including MOD-009's single sale), 2 standalone
-- sales (PROD-033 6.000đ 2026-07-14, PROD-034 10.000đ 2026-07-24), 13
-- never-sold products of 47 today.

-- 1. The link. Nullable: MOD-009 ("Hộp sữa chua") has no CAT-007 product
-- today and a future add-on-only modifier may never get one either.
-- RESTRICT: Postgres refuses to erase a product a modifier still points
-- at, independent of any screen -- the same reasoning as
-- 0075_erase_never_sold_product.sql's other three foreign keys into
-- products/product_variants.
alter table public.modifiers
  add column product_id text references public.products(id) on delete restrict;

-- 2. Backfill by exact name against CAT-007 products only. A modifier name
-- matching zero products is expected for exactly MOD-009; anything else
-- matching zero, or any modifier matching more than one product, means the
-- data has moved since this migration was written and the migration must
-- stop rather than link the wrong row.
do $$
declare
  rec record;
  v_match_count integer;
  v_match_id text;
  v_updated integer := 0;
  v_null_ids text[] := array[]::text[];
begin
  for rec in select id, name from public.modifiers order by id loop
    select count(*), max(id) into v_match_count, v_match_id
    from public.products
    where category_id = 'CAT-007' and name = rec.name;

    if v_match_count > 1 then
      raise exception
        'modifier % ("%") matches % CAT-007 products by name -- expected exactly one or zero, refusing to guess',
        rec.id, rec.name, v_match_count;
    elsif v_match_count = 1 then
      update public.modifiers set product_id = v_match_id where id = rec.id;
      v_updated := v_updated + 1;
    else
      v_null_ids := v_null_ids || rec.id;
    end if;
  end loop;

  if v_null_ids <> array['MOD-009'] then
    raise exception
      'expected exactly modifier MOD-009 ("Hộp sữa chua") to have no matching CAT-007 product; got %',
      v_null_ids;
  end if;

  if v_updated <> 8 then
    raise exception 'expected exactly 8 modifiers linked to a CAT-007 product, got %', v_updated;
  end if;

  raise notice 'linked % modifiers to CAT-007 products; % stayed unlinked (no matching product)', v_updated, v_null_ids;
end;
$$;

-- 3. The narrow reader for the product list: distinct modifier ids that
-- appear in any order line's modifiers_snapshot_json. Scanned entirely in
-- Postgres and returned as ids only -- this page's cache entry was already
-- burned once by pulling a whole jsonb payload into Node
-- (docs/superpowers/plans/2026-09-07-products-page-cache-overflow.md,
-- commit b954af2); this must not repeat that.
create or replace function public.find_sold_modifier_ids()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct elem ->> 'id'), array[]::text[])
  from public.order_lines_v2
  cross join lateral jsonb_array_elements(modifiers_snapshot_json) as elem
  where elem ->> 'id' is not null;
$$;

revoke all on function public.find_sold_modifier_ids() from public;
revoke all on function public.find_sold_modifier_ids() from anon;
revoke all on function public.find_sold_modifier_ids() from authenticated;
grant execute on function public.find_sold_modifier_ids() to service_role;
