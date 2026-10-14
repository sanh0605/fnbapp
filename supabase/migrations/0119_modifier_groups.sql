-- supabase/migrations/0119_modifier_groups.sql
-- Nhóm tuỳ chọn, migration A. Spec: docs/superpowers/specs/2026-10-14-nhom-tuy-chon-design.md,
-- plan: docs/superpowers/plans/2026-10-14-nhom-tuy-chon.md (Task 1).
--
-- Additive only, so it can run BEFORE the deploy: the live code keeps reading and
-- writing modifiers.group_name and calls the same functions with the same arguments.
-- No function's return changes. group_id stays nullable until migration B.
--
-- Triggers. Source: trigger NAMES queried live 2026-10-14 (pg_trigger joined to
-- pg_class, not tgisinternal); what each one does is from migration text
-- (0001_init_schema.sql:417-435, a do-loop creating trg_<t>_touch BEFORE UPDATE
-- FOR EACH ROW -> touch_updated_at(); a trigger body was not queried).
--   modifiers:        trg_modifiers_touch only.
--   products:         trg_products_touch only.
--   product_variants: trg_product_variants_touch only.
--   product_categories, product_types: none.
-- The group_id backfill below fires the modifiers touch trigger (updated_at moves on
-- the 9 rows, nothing else). modifier_groups gets its own touch trigger;
-- modifier_group_products has no updated_at and no trigger.
--
-- Foreign keys: modifiers.group_id is RESTRICT (an option never loses its group).
-- Both link-table keys CASCADE on purpose: the links are settings with no history
-- ("unticking deletes the row"), erase_never_sold_product_atomic (0075) must still be
-- able to erase a ticked, never-sold dish, and an empty group must be erasable
-- without first unticking its dishes.
--
-- The link table has its own id (group_id:product_id): lib/db/tables.ts findAll, the
-- nightly backup and the restore drill all order and page by "id". It is a plain column,
-- not a generated one, because the restore drill inserts every column it dumped.

create table if not exists public.modifier_groups (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  selection_mode text not null check (selection_mode in ('ONE', 'MANY')),
  max_total integer check (max_total between 1 and 20),
  allow_standalone boolean not null default false,
  sort_order integer not null check (sort_order between 1 and 99),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (selection_mode = 'MANY' or (allow_standalone = false and max_total is null))
);

-- Same normalising expression as idx_product_types_name (0109).
create unique index if not exists idx_modifier_groups_name
  on public.modifier_groups (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  );

create table if not exists public.modifier_group_products (
  id text primary key,
  group_id text not null references public.modifier_groups(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  unique (group_id, product_id)
);

alter table public.modifiers
  add column if not exists group_id text references public.modifier_groups(id) on delete restrict,
  add column if not exists is_default boolean not null default false,
  add column if not exists max_qty integer check (max_qty between 1 and 20);

create unique index if not exists idx_modifiers_one_default
  on public.modifiers (group_id) where is_default;

drop trigger if exists trg_modifier_groups_touch on public.modifier_groups;
create trigger trg_modifier_groups_touch before update on public.modifier_groups
  for each row execute function public.touch_updated_at();

alter table public.modifier_groups enable row level security;
revoke all on table public.modifier_groups from public, anon, authenticated;
grant select, insert, update, delete on table public.modifier_groups to service_role;

alter table public.modifier_group_products enable row level security;
revoke all on table public.modifier_group_products from public, anon, authenticated;
grant select, insert, update, delete on table public.modifier_group_products to service_role;

-- Seed. Every option's group name becomes a group; today that is only Thêm Topping.
insert into public.modifier_groups (id, name, selection_mode, max_total, allow_standalone, sort_order)
values ('MG-001', 'Thêm Topping', 'MANY', null, true, 50)
on conflict (id) do nothing;

-- Any other name (none on 2026-10-14) gets its own Chọn nhiều group, so the migration
-- stays correct if one appears before it runs.
do $$
declare
  r record;
  v_next integer := 2;
begin
  for r in
    select distinct group_name from public.modifiers
    where nullif(btrim(group_name), '') is not null and group_name <> 'Thêm Topping'
    order by group_name
  loop
    insert into public.modifier_groups (id, name, selection_mode, max_total, allow_standalone, sort_order)
    values ('MG-' || lpad(v_next::text, 3, '0'), r.group_name, 'MANY', null, false, 50);
    v_next := v_next + 1;
  end loop;
end $$;

update public.modifiers m
set group_id = g.id
from public.modifier_groups g
where g.name = m.group_name and m.group_id is null;

-- Day one: only drinks (product_types.is_drink) get Thêm Topping.
insert into public.modifier_group_products (id, group_id, product_id)
select 'MG-001:' || p.id, 'MG-001', p.id
from public.products p
join public.product_categories c on c.id = p.category_id
join public.product_types t on t.id = c.type_id
where t.is_drink and p.status <> 'DELETED'
on conflict do nothing;

-- The standalone-topping check reads the group's flag, not a group name.
-- Body copied from 0100; only the select and the group check change.
create or replace function public.create_standalone_topping_product_atomic(
  p_modifier_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allow_standalone boolean;
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

  select m.name, m.price, m.status, m.product_id, coalesce(g.allow_standalone, false)
  into v_name, v_price, v_status, v_existing_product_id, v_allow_standalone
  from public.modifiers m
  left join public.modifier_groups g on g.id = m.group_id
  where m.id = p_modifier_id
  for update of m;
  if not found then
    raise exception 'Modifier % not found', p_modifier_id;
  end if;

  if v_status <> 'ACTIVE' then
    raise exception 'Modifier % is not ACTIVE -- cannot be sold standalone', p_modifier_id;
  end if;

  if v_existing_product_id is not null then
    raise exception 'Modifier % already has a linked product -- refusing to create a second one', p_modifier_id;
  end if;

  if not v_allow_standalone then
    raise exception 'Modifier % is in a group that does not sell options on their own', p_modifier_id;
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


-- One write for a group and its dish ticks. Switching to Chọn nhiều drops any
-- default option, so no hidden default lingers.
create or replace function public.save_modifier_group_atomic(
  p_is_edit boolean,
  p_group jsonb,
  p_product_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_mode text;
  v_count integer;
begin
  if p_is_edit is null then
    raise exception 'p_is_edit is required';
  end if;
  if p_group is null or jsonb_typeof(p_group) <> 'object' then
    raise exception 'p_group must be a JSON object';
  end if;
  if p_product_ids is null then
    raise exception 'p_product_ids is required (pass an empty array to untick every dish)';
  end if;
  v_id := nullif(btrim(p_group->>'id'), '');
  if v_id is null then
    raise exception 'p_group.id is required';
  end if;
  v_mode := p_group->>'selection_mode';

  if p_is_edit then
    update public.modifier_groups
    set
      name = p_group->>'name',
      selection_mode = v_mode,
      max_total = nullif(p_group->>'max_total', '')::integer,
      allow_standalone = coalesce((p_group->>'allow_standalone')::boolean, false),
      sort_order = (p_group->>'sort_order')::integer
    where id = v_id;
    if not found then
      raise exception 'Modifier group % not found', v_id;
    end if;
  else
    insert into public.modifier_groups (id, name, selection_mode, max_total, allow_standalone, sort_order)
    values (
      v_id,
      p_group->>'name',
      v_mode,
      nullif(p_group->>'max_total', '')::integer,
      coalesce((p_group->>'allow_standalone')::boolean, false),
      (p_group->>'sort_order')::integer
    );
  end if;

  if v_mode = 'MANY' then
    update public.modifiers
    set is_default = false
    where group_id = v_id and is_default;
  end if;

  delete from public.modifier_group_products
  where group_id = v_id and product_id <> all (p_product_ids);
  insert into public.modifier_group_products (id, group_id, product_id)
  select v_id || ':' || p, v_id, p from unnest(p_product_ids) as p
  on conflict do nothing;

  select count(*) into v_count from public.modifier_group_products where group_id = v_id;
  return jsonb_build_object('group_id', v_id, 'product_count', v_count);
end;
$$;

revoke all on function public.save_modifier_group_atomic(boolean, jsonb, text[]) from public;
revoke all on function public.save_modifier_group_atomic(boolean, jsonb, text[]) from anon;
revoke all on function public.save_modifier_group_atomic(boolean, jsonb, text[]) from authenticated;
grant execute on function public.save_modifier_group_atomic(boolean, jsonb, text[]) to service_role;


-- One write for an option: ticking "Có sẵn" clears it on the group's other options
-- first (the partial unique index would otherwise throw). An edit then goes through
-- 0098's sync_topping_price_atomic unchanged, which keeps the linked dish's price in step.
create or replace function public.save_modifier_atomic(
  p_is_edit boolean,
  p_modifier jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_group_id text;
  v_group_name text;
  v_mode text;
  v_default boolean;
  v_max_qty integer;
begin
  if p_is_edit is null then
    raise exception 'p_is_edit is required';
  end if;
  if p_modifier is null or jsonb_typeof(p_modifier) <> 'object' then
    raise exception 'p_modifier must be a JSON object';
  end if;
  v_id := nullif(btrim(p_modifier->>'id'), '');
  v_group_id := nullif(btrim(p_modifier->>'group_id'), '');
  if v_id is null or v_group_id is null then
    raise exception 'p_modifier.id and p_modifier.group_id are required';
  end if;

  select name, selection_mode into v_group_name, v_mode
  from public.modifier_groups
  where id = v_group_id
  for share;
  if not found then
    raise exception 'Modifier group % not found', v_group_id;
  end if;

  v_default := coalesce((p_modifier->>'is_default')::boolean, false);
  if v_default and v_mode <> 'ONE' then
    raise exception 'Only a Chọn một group can have a default option';
  end if;
  v_max_qty := nullif(p_modifier->>'max_qty', '')::integer;

  if v_default then
    update public.modifiers
    set is_default = false
    where group_id = v_group_id and id <> v_id and is_default;
  end if;

  if p_is_edit then
    perform 1 from public.modifiers where id = v_id for update;
    if not found then
      raise exception 'Modifier % not found', v_id;
    end if;
    update public.modifiers
    set group_id = v_group_id, is_default = v_default, max_qty = v_max_qty
    where id = v_id;
    return public.sync_topping_price_atomic(
      v_id, (p_modifier->>'price')::bigint, p_modifier->>'name', v_group_name
    );
  end if;

  insert into public.modifiers (id, name, group_name, price, status, group_id, is_default, max_qty)
  values (
    v_id,
    p_modifier->>'name',
    v_group_name,
    (p_modifier->>'price')::bigint,
    'ACTIVE',
    v_group_id,
    v_default,
    v_max_qty
  );
  return jsonb_build_object('modifier_id', v_id, 'variant_id', null, 'price_history', '[]'::jsonb);
end;
$$;

revoke all on function public.save_modifier_atomic(boolean, jsonb) from public;
revoke all on function public.save_modifier_atomic(boolean, jsonb) from anon;
revoke all on function public.save_modifier_atomic(boolean, jsonb) from authenticated;
grant execute on function public.save_modifier_atomic(boolean, jsonb) to service_role;


-- save_product_atomic: dropped and recreated so no second version exists to confuse a
-- call. Body copied from 0105 (md5 of prosrc identical to the live function, checked
-- 2026-10-14); the only change is the group ticks before the return. A call without the
-- last argument (p_option_group_ids null) leaves the ticks alone.
drop function if exists public.save_product_atomic(
  boolean, jsonb, jsonb, jsonb, timestamptz
);

create or replace function public.save_product_atomic(
  p_is_edit boolean,
  p_product jsonb,
  p_variants jsonb default '[]'::jsonb,
  p_removed_variant_ids jsonb default '[]'::jsonb,
  p_effective_at timestamptz default now(),
  p_option_group_ids text[] default null
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

  if p_option_group_ids is not null then
    delete from public.modifier_group_products
    where product_id = v_product_id and group_id <> all (p_option_group_ids);
    insert into public.modifier_group_products (id, group_id, product_id)
    select g || ':' || v_product_id, g, v_product_id from unnest(p_option_group_ids) as g
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'product_id', v_product_id,
    'variant_count', v_variant_count,
    'price_history_count', v_price_history_count,
    'removed_variant_count', v_removed_variant_count
  );
end;
$$;

revoke all on function public.save_product_atomic(boolean, jsonb, jsonb, jsonb, timestamptz, text[]) from public;
revoke all on function public.save_product_atomic(boolean, jsonb, jsonb, jsonb, timestamptz, text[]) from anon;
revoke all on function public.save_product_atomic(boolean, jsonb, jsonb, jsonb, timestamptz, text[]) from authenticated;
grant execute on function public.save_product_atomic(boolean, jsonb, jsonb, jsonb, timestamptz, text[]) to service_role;

