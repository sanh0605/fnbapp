-- Owner decision 2026-09-28 ("Ok gỡ"): drop the 10 abandoned tables mapped in
-- docs/superpowers/specs/2026-09-28-ban-do-bang-du-lieu.md, and every live
-- function that still touched them. Plan:
-- docs/superpowers/plans/2026-09-28-go-10-bang-bo-hoang.md.
--
-- Release order: the app code that stops sending recipe fields ships FIRST,
-- then this migration (CLAUDE.md: a function whose result changes goes live
-- with its reader, never before it). Between the two, saving a product
-- fails; nothing else is affected.

-- 1. save_product_atomic without recipes.
-- Recipes were removed by owner decision 2026-08-27; since then every new
-- size still wrote an empty recipe (REC-001, Test11 500ml, is the only one).
-- Copied from 0050 with every recipe variable, lock, id scan, validation and
-- write removed. The result drops 'recipe_count'; the other four counts are
-- unchanged. Signature and grants are unchanged.

create or replace function public.save_product_atomic(
  p_is_edit boolean,
  p_product jsonb,
  p_variants jsonb default '[]'::jsonb,
  p_removed_variant_ids jsonb default '[]'::jsonb,
  p_effective_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id text;
  v_variant jsonb;
  v_variant_id text;
  v_variant_product_id text;
  v_variant_status text;
  v_old_price bigint;
  v_history_old_price bigint;
  v_new_price bigint;
  v_removed_variant_id text;
  v_next_product integer;
  v_next_variant integer;
  v_next_history integer;
  v_variant_count integer := 0;
  v_price_history_count integer := 0;
  v_removed_variant_count integer := 0;
  v_affected integer := 0;
begin
  if p_is_edit is null then
    raise exception 'p_is_edit is required';
  end if;
  if p_product is null or jsonb_typeof(p_product) <> 'object' then
    raise exception 'p_product must be a JSON object';
  end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array'
     or jsonb_array_length(p_variants) = 0 then
    raise exception 'p_variants must be a non-empty JSON array';
  end if;
  if p_removed_variant_ids is null
     or jsonb_typeof(p_removed_variant_ids) <> 'array' then
    raise exception 'p_removed_variant_ids must be a JSON array';
  end if;
  if nullif(btrim(p_product->>'name'), '') is null
     or nullif(btrim(p_product->>'category_id'), '') is null then
    raise exception 'Product name and category_id are required';
  end if;

  perform pg_advisory_xact_lock(hashtext('products:id'));
  perform pg_advisory_xact_lock(hashtext('product_variants:id'));
  perform pg_advisory_xact_lock(hashtext('product_price_history:id'));

  select coalesce(max(substring(id from '^PROD-([0-9]+)$')::integer), 0) + 1
  into v_next_product
  from public.products
  where id ~ '^PROD-[0-9]+$';
  select coalesce(max(substring(id from '^VAR-([0-9]+)$')::integer), 0) + 1
  into v_next_variant
  from public.product_variants
  where id ~ '^VAR-[0-9]+$';
  select coalesce(max(substring(id from '^PPH-([0-9]+)$')::integer), 0) + 1
  into v_next_history
  from public.product_price_history
  where id ~ '^PPH-[0-9]+$';

  if p_is_edit then
    v_product_id := nullif(btrim(p_product->>'id'), '');
    if v_product_id is null then
      raise exception 'p_product.id is required for edit';
    end if;
    perform 1
    from public.products
    where id = v_product_id
    for update;
    if not found then
      raise exception 'Product % not found', v_product_id;
    end if;
    update public.products
    set
      category_id = p_product->>'category_id',
      name = p_product->>'name',
      image_url = coalesce(p_product->>'image_url', ''),
      updated_at = now()
    where id = v_product_id;
  else
    v_product_id := 'PROD-' || lpad(v_next_product::text, 3, '0');
    insert into public.products (
      id, category_id, name, image_url, status, created_at, updated_at
    ) values (
      v_product_id,
      p_product->>'category_id',
      p_product->>'name',
      coalesce(p_product->>'image_url', ''),
      'ACTIVE',
      coalesce(nullif(p_product->>'created_at', '')::timestamptz, now()),
      now()
    );
  end if;

  for v_variant in
    select value from jsonb_array_elements(p_variants)
  loop
    if nullif(btrim(v_variant->>'size_name'), '') is null then
      raise exception 'Variant size_name is required';
    end if;
    v_new_price := nullif(v_variant->>'price', '')::bigint;
    if v_new_price is null or v_new_price < 0 then
      raise exception 'Variant price must be non-negative';
    end if;

    v_variant_id := nullif(btrim(v_variant->>'id'), '');
    v_history_old_price := null;
    if v_variant_id is null then
      v_variant_id := 'VAR-' || lpad(v_next_variant::text, 3, '0');
      v_next_variant := v_next_variant + 1;
      insert into public.product_variants (
        id, product_id, size_name, price, status, created_at, updated_at
      ) values (
        v_variant_id,
        v_product_id,
        v_variant->>'size_name',
        v_new_price,
        'ACTIVE',
        coalesce(p_effective_at, now()),
        now()
      );
      v_old_price := null;
    else
      select product_id, status, price
      into v_variant_product_id, v_variant_status, v_old_price
      from public.product_variants
      where id = v_variant_id
      for update;
      if not found then
        raise exception 'Variant % not found', v_variant_id;
      end if;
      if v_variant_product_id <> v_product_id or v_variant_status = 'DELETED' then
        raise exception 'Variant % does not belong to active product %',
          v_variant_id, v_product_id;
      end if;
      if v_old_price <> v_new_price then
        select history.new_price
        into v_history_old_price
        from public.product_price_history as history
        where history.variant_id = v_variant_id
        order by history.created_at desc, history.id desc
        limit 1;
      end if;
      update public.product_variants
      set
        size_name = v_variant->>'size_name',
        price = v_new_price,
        updated_at = now()
      where id = v_variant_id;
    end if;
    v_variant_count := v_variant_count + 1;

    if v_old_price is null or v_old_price <> v_new_price then
      insert into public.product_price_history (
        id, variant_id, old_price, new_price, effective_at, created_at
      ) values (
        'PPH-' || lpad(v_next_history::text, 3, '0'),
        v_variant_id,
        v_history_old_price,
        v_new_price,
        coalesce(p_effective_at, now()),
        coalesce(p_effective_at, now())
      );
      v_next_history := v_next_history + 1;
      v_price_history_count := v_price_history_count + 1;
    end if;
  end loop;

  for v_removed_variant_id in
    select value from jsonb_array_elements_text(p_removed_variant_ids)
  loop
    update public.product_variants
    set status = 'DELETED', updated_at = now()
    where id = v_removed_variant_id
      and product_id = v_product_id
      and status <> 'DELETED';
    get diagnostics v_affected = row_count;
    if v_affected <> 1 then
      raise exception 'Removed variant % is missing or already deleted',
        v_removed_variant_id;
    end if;
    v_removed_variant_count := v_removed_variant_count + 1;
  end loop;

  if v_variant_count <> jsonb_array_length(p_variants) then
    raise exception 'Variant count mismatch';
  end if;
  if v_removed_variant_count <> jsonb_array_length(p_removed_variant_ids) then
    raise exception 'Removed variant count mismatch';
  end if;

  return jsonb_build_object(
    'product_id', v_product_id,
    'variant_count', v_variant_count,
    'price_history_count', v_price_history_count,
    'removed_variant_count', v_removed_variant_count
  );
end;
$$;

revoke all on function public.save_product_atomic(
  boolean, jsonb, jsonb, jsonb, timestamptz
) from public;
revoke all on function public.save_product_atomic(
  boolean, jsonb, jsonb, jsonb, timestamptz
) from anon;
revoke all on function public.save_product_atomic(
  boolean, jsonb, jsonb, jsonb, timestamptz
) from authenticated;
grant execute on function public.save_product_atomic(
  boolean, jsonb, jsonb, jsonb, timestamptz
) to service_role;

-- 2. Stock adjustment screen ("Điều chỉnh Tồn kho") removed: there was
-- never a way to create an adjustment (only a "Duyệt" button on an
-- always-empty list). stock_adjustments has 0 rows in production. UI
-- removal (Gemini) ships before this migration -- see plan Release order.
-- Argument lists copied verbatim from each function's last create-or-
-- replace: 0083 (submit_stock_adjustment_atomic) and 0084
-- (approve_stock_adjustment_atomic).

drop function if exists public.submit_stock_adjustment_atomic(jsonb);
drop function if exists public.approve_stock_adjustment_atomic(text, text, timestamp with time zone);

-- 3. Drop the 10 abandoned tables (owner decision 2026-09-28, "Ok gỡ" --
-- docs/superpowers/specs/2026-09-28-ban-do-bang-du-lieu.md group C, all 10
-- plus the stock-adjustment menu entry).
--
-- Trigger inventory (read from migration text -- supabase/CLAUDE.md: no
-- session here can query pg_catalog directly): the only triggers on any of
-- these 10 tables are trg_shifts_touch (0033, on shifts) and
-- prune_data_recovery_changes_trigger (0045, on data_recovery_changes).
-- Both are defined ON the table they trigger on, so dropping the table
-- drops the trigger with it -- no separate `drop trigger` needed. No live
-- table outside this set has a trigger that writes into any of these 10.
--
-- Foreign-key inventory (same method): purchased_items.semi_product_id ->
-- semi_products (0001) is the only FK from a table that survives this
-- migration, handled by the column drop below, before semi_products is
-- dropped. production_orders.semi_product_id -> semi_products,
-- production_items.production_order_id -> production_orders (0001), and
-- shift_stock_checks.shift_id -> shifts (0033) are all between tables in
-- this same drop list, so the child-first order below is enough; no other
-- live table references any of these 10 by foreign key.
--
-- Guard: this migration was written against counts measured live
-- 2026-09-28 (docs/superpowers/specs/2026-09-28-ban-do-bang-du-lieu.md).
-- If any of them changed since -- new real usage the plan did not account
-- for -- refuse rather than silently discard data.
do $$
declare
  v_recipes_total integer;
  v_recipes_nonempty integer;
  v_semi_products integer;
  v_production_orders integer;
  v_production_items integer;
  v_stock_adjustments integer;
  v_shifts integer;
  v_data_recovery_changes integer;
  v_purchased_items_with_semi_product integer;
begin
  select count(*) into v_recipes_total from public.recipes;
  if v_recipes_total > 1 then
    raise exception 'Guard: public.recipes has % rows, expected <= 1 (measured 2026-09-28: only REC-001, empty)', v_recipes_total;
  end if;
  select count(*) into v_recipes_nonempty
  from public.recipes
  where ingredients_json is not null
    and ingredients_json <> '[]'::jsonb
    and ingredients_json <> '{}'::jsonb;
  if v_recipes_nonempty > 0 then
    raise exception 'Guard: public.recipes has % row(s) with a non-empty ingredients_json', v_recipes_nonempty;
  end if;

  select count(*) into v_semi_products from public.semi_products;
  if v_semi_products <> 0 then
    raise exception 'Guard: public.semi_products has % rows, expected 0', v_semi_products;
  end if;

  select count(*) into v_production_orders from public.production_orders;
  if v_production_orders <> 0 then
    raise exception 'Guard: public.production_orders has % rows, expected 0', v_production_orders;
  end if;

  select count(*) into v_production_items from public.production_items;
  if v_production_items <> 0 then
    raise exception 'Guard: public.production_items has % rows, expected 0', v_production_items;
  end if;

  select count(*) into v_stock_adjustments from public.stock_adjustments;
  if v_stock_adjustments <> 0 then
    raise exception 'Guard: public.stock_adjustments has % rows, expected 0', v_stock_adjustments;
  end if;

  select count(*) into v_shifts from public.shifts;
  if v_shifts > 1 then
    raise exception 'Guard: public.shifts has % rows, expected <= 1 (measured 2026-09-28: only the SHF-001 smoke test)', v_shifts;
  end if;

  select count(*) into v_data_recovery_changes from public.data_recovery_changes;
  if v_data_recovery_changes <> 0 then
    raise exception 'Guard: public.data_recovery_changes has % rows, expected 0', v_data_recovery_changes;
  end if;

  select count(*) into v_purchased_items_with_semi_product
  from public.purchased_items
  where semi_product_id is not null;
  if v_purchased_items_with_semi_product <> 0 then
    raise exception 'Guard: purchased_items.semi_product_id is set on % row(s), expected 0', v_purchased_items_with_semi_product;
  end if;
end $$;

-- purchased_items.semi_product_id is dead in application code (never in
-- types/db.ts, 0/151 rows non-null measured 2026-09-28) -- drop it before
-- semi_products, the table it references, can be dropped.
alter table public.purchased_items drop column if exists semi_product_id;

-- The four dead functions from the plan's "Hàm trong cơ sở dữ liệu còn
-- sống" table (the other two, submit/approve_stock_adjustment_atomic, were
-- already dropped above in section 2). No code anywhere (app/, lib/,
-- scripts/, supabase/functions/) calls any of these three. Argument lists
-- copied verbatim from each function's last create-or-replace.
drop function if exists public.apply_full_history_recovery(text, text, jsonb, boolean);
drop function if exists public.remove_audit_baseline_lock(text, text, text);
drop function if exists public.prune_data_recovery_changes();

-- Child-first order.
drop table if exists public.production_items;
drop table if exists public.production_orders;
drop table if exists public.shift_stock_checks;
drop table if exists public.shifts;
drop table if exists public.stock_adjustments;
drop table if exists public.recipes;
drop table if exists public.semi_products;
drop table if exists public.data_recovery_changes;
drop table if exists public.data_migration_runs;
drop table if exists public.sync_state;
