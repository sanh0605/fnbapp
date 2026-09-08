-- docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 2,
-- BR-CATALOG-003 (docs/02-rules/business-rules/catalog.md). Owner decision
-- 2026-09-08: a topping with no standalone món can grow one from the
-- Topping screen itself -- "Bán độc lập" on an unlinked modifier creates
-- the CAT-007 product, its single ACTIVE variant, and the join in one
-- transaction, or none of it.
--
-- Trigger check: NOT re-verified against the live catalog -- this session
-- and the peer session both lack a SQL client against production in this
-- environment (no psql on PATH, `supabase db dump --linked` needs a local
-- Docker Postgres that is not running here, PostgREST cannot reach
-- pg_catalog). What follows is derived from migration text instead, dated
-- 2026-09-08: `supabase/migrations/0001_init_schema.sql:417-435` creates
-- touch triggers in a `do $$` loop over an explicit table array that
-- includes products, product_variants and modifiers. Each gets exactly one
-- trigger, `trg_<table>_touch`, BEFORE UPDATE FOR EACH ROW, calling
-- `public.touch_updated_at()` (`new.updated_at = now(); return new;`).
-- Grepped every `create trigger` / `drop trigger` across all 99 migration
-- files: nothing else names any of the three tables. This proves what the
-- migrations create, not what the live catalog currently holds -- a
-- trigger added or dropped by hand outside migration history would be
-- invisible to this method. No queue, no audit, no cascade on any of the
-- three either way.
--
-- Writer inventory (skill step 6, for the new writer into products and
-- product_variants): grepped `insert into public.products` and
-- `insert into public.product_variants` across supabase/migrations/*.sql --
-- the live inserting functions are save_product_atomic
-- (0050_save_product_atomic_reject_backwards_effective.sql, the last
-- create-or-replace of that name) and, after this migration,
-- create_standalone_topping_product_atomic itself. Both mint PROD-/VAR-
-- ids from the same sequences under the same advisory locks, so no two
-- writers can collide on an id even running concurrently.
--
-- Guards (plan Task 0/Task 2, all re-checked under the modifier row's own
-- lock rather than trusted from whatever the client last rendered):
-- already-linked (product_id not null -- covers the double-click/two-tab
-- race), wrong group (only *Thêm Topping* is sellable standalone --
-- *Chọn Size*, *Chọn Đường*, *Chọn Đá* are choices inside a drink, not
-- toppings), non-ACTIVE modifier (the UI list this switch renders from
-- already excludes DELETED, but the RPC does not trust that), and
-- non-positive price (a 0đ món is not a real product). Structurally
-- incapable of ever hitting sync_topping_price_atomic's two-ACTIVE-
-- modifiers-one-product collision (0098's guard): this function always
-- mints a brand-new product, so it can never point two modifiers at one
-- existing product.
--
-- size_name = '1 phần' for the new variant: the real convention measured
-- 2026-09-08 across all 7 currently-linked standalone toppings, every one
-- of which uses that exact string for its single ACTIVE variant.
--
-- Peer review (Opus, 2026-09-08), two findings fixed before this migration
-- was ever run:
--
-- 1. The new variant now gets its own product_price_history row (the
-- launch price), same as save_product_atomic's new-variant path and
-- sync_topping_price_atomic's every-change path -- both siblings record
-- price history; this one did not. Without it, the món's very first price
-- has no record, and 0098's first later edit through it would insert a
-- history row whose "old price" has nothing before it to compare against.
--
-- 2. products carries a table-wide unique index on the ACTIVE name
-- (`ux_products_active_name`, 0065_duplicate_name_guard.sql) -- BR-CATALOG-001
-- level 1. Without a guard here, a name collision (not reachable today:
-- checked, none of the 8 non-DELETED modifier names collide with any of the
-- 47 products) would raise a raw 23505 instead of a message this function's
-- caller can translate. Fixed by catching unique_violation on the insert and
-- re-raising in the same style as the other four guards.
--
-- BR-CATALOG-001 level 2 (the diacritic-stripped near-match warning,
-- `findDiacriticStrippedMatch` + duplicate_warning_confirmed) is
-- deliberately NOT wired into this path -- flagged as an open question
-- back to the plan's author rather than silently decided. Reasoning for the
-- omission: level 2 needs a human answer mid-flow ("đây có phải là một mặt
-- hàng khác không?"), which on every other products-writing screen is a
-- second round trip in a multi-field form. This RPC is called from a single
-- switch-and-confirm interaction with no form to hold a second prompt, and
-- its input name is not free text -- it is copied verbatim from an already-
-- named modifier row (8 total today), a far smaller and more curated source
-- than the free-text product name field level 2 was built to catch. If the
-- owner wants level 2 here too, that is a UX addition to design, not a
-- one-line fix, and belongs in its own task.

create or replace function public.create_standalone_topping_product_atomic(
  p_modifier_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_name text;
  v_name text;
  v_price bigint;
  v_status text;
  v_existing_product_id text;
  v_next_product integer;
  v_next_variant integer;
  v_next_history integer;
  v_product_id text;
  v_variant_id text;
  v_pph_id text;
begin
  if p_modifier_id is null or btrim(p_modifier_id) = '' then
    raise exception 'p_modifier_id is required';
  end if;

  select group_name, name, price, status, product_id
  into v_group_name, v_name, v_price, v_status, v_existing_product_id
  from public.modifiers
  where id = p_modifier_id
  for update;
  if not found then
    raise exception 'Modifier % not found', p_modifier_id;
  end if;

  if v_status <> 'ACTIVE' then
    raise exception 'Modifier % is not ACTIVE -- cannot be sold standalone', p_modifier_id;
  end if;

  if v_existing_product_id is not null then
    raise exception 'Modifier % already has a linked product -- refusing to create a second one', p_modifier_id;
  end if;

  if v_group_name <> 'Thêm Topping' then
    raise exception 'Modifier % is not in the Thêm Topping group -- cannot be sold standalone', p_modifier_id;
  end if;

  if v_price is null or v_price <= 0 then
    raise exception 'Modifier % has price % -- refusing to create a 0đ món', p_modifier_id, coalesce(v_price::text, 'null');
  end if;

  perform pg_advisory_xact_lock(hashtext('products:id'));
  perform pg_advisory_xact_lock(hashtext('product_variants:id'));
  perform pg_advisory_xact_lock(hashtext('product_price_history:id'));

  select coalesce(max(substring(id from '^PROD-([0-9]+)$')::integer), 0) + 1
  into v_next_product
  from public.products
  where id ~ '^PROD-[0-9]+$';
  v_product_id := 'PROD-' || lpad(v_next_product::text, 3, '0');

  select coalesce(max(substring(id from '^VAR-([0-9]+)$')::integer), 0) + 1
  into v_next_variant
  from public.product_variants
  where id ~ '^VAR-[0-9]+$';
  v_variant_id := 'VAR-' || lpad(v_next_variant::text, 3, '0');

  select coalesce(max(substring(id from '^PPH-([0-9]+)$')::integer), 0) + 1
  into v_next_history
  from public.product_price_history
  where id ~ '^PPH-[0-9]+$';
  v_pph_id := 'PPH-' || lpad(v_next_history::text, 3, '0');

  begin
    insert into public.products (
      id, category_id, name, image_url, status, created_at, updated_at
    ) values (
      v_product_id, 'CAT-007', v_name, '', 'ACTIVE', now(), now()
    );
  exception
    when unique_violation then
      raise exception
        'Product name "%" already exists among ACTIVE products -- refusing to create a duplicate',
        v_name;
  end;

  insert into public.product_variants (
    id, product_id, size_name, price, status, created_at, updated_at
  ) values (
    v_variant_id, v_product_id, '1 phần', v_price, 'ACTIVE', now(), now()
  );

  insert into public.product_price_history (
    id, variant_id, old_price, new_price, effective_at, created_at
  ) values (
    v_pph_id, v_variant_id, null, v_price, now(), now()
  );

  update public.modifiers
  set product_id = v_product_id
  where id = p_modifier_id;

  return jsonb_build_object(
    'product_id', v_product_id,
    'variant_id', v_variant_id
  );
end;
$$;

revoke all on function public.create_standalone_topping_product_atomic(text) from public;
revoke all on function public.create_standalone_topping_product_atomic(text) from anon;
revoke all on function public.create_standalone_topping_product_atomic(text) from authenticated;
grant execute on function public.create_standalone_topping_product_atomic(text) to service_role;
