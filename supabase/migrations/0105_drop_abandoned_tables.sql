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
