-- supabase/migrations/0120_modifier_group_required.sql
-- Nhóm tuỳ chọn, migration B. Spec: docs/superpowers/specs/2026-10-14-nhom-tuy-chon-design.md
-- ("Rollout" step 3), plan: docs/superpowers/plans/2026-10-15-migration-b-nhom-tuy-chon.md.
-- The Supabase CLI runs this file as one transaction (like every migration here), so
-- the refusal below leaves everything unchanged.
--
-- No function's return type changes, and the till never calls the two functions below,
-- so this may run before or after the code that stops sending group_name.
--
-- Triggers. Source: migration text (0001_init_schema.sql:417-435), not queried live.
--   modifiers: trg_modifiers_touch only, BEFORE UPDATE -> touch_updated_at(). The backfill
--   fires it on any row it changes (updated_at moves, nothing else). Setting not null and
--   dropping the column fire no trigger.

update public.modifiers m
set group_id = g.id
from public.modifier_groups g
where m.group_id is null and g.name = m.group_name;

do $$
declare
  v_ids text;
begin
  select string_agg(id, ', ' order by id) into v_ids
  from public.modifiers where group_id is null;
  if v_ids is not null then
    raise exception 'Options without a group_id, fix them first: %', v_ids;
  end if;
end $$;

alter table public.modifiers alter column group_id set not null;

-- Body copied from 0098; only the group argument, its check and its assignment go.
drop function public.sync_topping_price_atomic(text, bigint, text, text);

create function public.sync_topping_price_atomic(
  p_modifier_id text,
  p_price bigint,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id text;
  v_active_modifier_count integer;
  v_variant_id text;
  v_active_variant_count integer;
  v_old_variant_price bigint;
  v_next_history integer;
  v_pph_id text;
  v_history_rows jsonb := '[]'::jsonb;
begin
  if p_modifier_id is null or btrim(p_modifier_id) = '' then
    raise exception 'p_modifier_id is required';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'p_price must be non-negative';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'p_name is required';
  end if;

  select product_id into v_product_id
  from public.modifiers
  where id = p_modifier_id
  for update;
  if not found then
    raise exception 'Modifier % not found', p_modifier_id;
  end if;

  if v_product_id is not null then
    select count(*) into v_active_modifier_count
    from public.modifiers
    where product_id = v_product_id and status = 'ACTIVE';
    if v_active_modifier_count > 1 then
      raise exception
        'Product % has % ACTIVE modifiers -- price sync needs exactly one writer',
        v_product_id, v_active_modifier_count;
    end if;

    select count(*) into v_active_variant_count
    from public.product_variants
    where product_id = v_product_id and status = 'ACTIVE';
    if v_active_variant_count <> 1 then
      raise exception
        'Product % has % ACTIVE variants -- "the standalone price" is not a single number',
        v_product_id, v_active_variant_count;
    end if;
  end if;

  update public.modifiers
  set price = p_price, name = p_name
  where id = p_modifier_id;

  if v_product_id is null then
    -- No linked product, nothing else to sync. Not an error.
    return jsonb_build_object(
      'modifier_id', p_modifier_id,
      'variant_id', null,
      'price_history', '[]'::jsonb
    );
  end if;

  select id, price into v_variant_id, v_old_variant_price
  from public.product_variants
  where product_id = v_product_id and status = 'ACTIVE'
  for update;

  update public.product_variants
  set price = p_price
  where id = v_variant_id;

  if v_old_variant_price is null or v_old_variant_price <> p_price then
    perform pg_advisory_xact_lock(hashtext('product_price_history:id'));
    select coalesce(max(substring(id from '^PPH-([0-9]+)$')::integer), 0) + 1
    into v_next_history
    from public.product_price_history
    where id ~ '^PPH-[0-9]+$';
    v_pph_id := 'PPH-' || lpad(v_next_history::text, 3, '0');

    insert into public.product_price_history (
      id, variant_id, old_price, new_price, effective_at, created_at
    ) values (
      v_pph_id, v_variant_id, v_old_variant_price, p_price, now(), now()
    );
    v_history_rows := jsonb_build_array(jsonb_build_object(
      'id', v_pph_id, 'variant_id', v_variant_id,
      'old_price', v_old_variant_price, 'new_price', p_price
    ));
  end if;

  return jsonb_build_object(
    'modifier_id', p_modifier_id,
    'variant_id', v_variant_id,
    'price_history', v_history_rows
  );
end;
$$;

revoke all on function public.sync_topping_price_atomic(text, bigint, text) from public, anon, authenticated;
grant execute on function public.sync_topping_price_atomic(text, bigint, text) to service_role;

-- Body copied from 0119; only v_group_name, the group_name insert column and the sync argument go.
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

  select selection_mode into v_mode
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
      v_id, (p_modifier->>'price')::bigint, p_modifier->>'name'
    );
  end if;

  insert into public.modifiers (id, name, price, status, group_id, is_default, max_qty)
  values (
    v_id,
    p_modifier->>'name',
    (p_modifier->>'price')::bigint,
    'ACTIVE',
    v_group_id,
    v_default,
    v_max_qty
  );
  return jsonb_build_object('modifier_id', v_id, 'variant_id', null, 'price_history', '[]'::jsonb);
end;
$$;

revoke all on function public.save_modifier_atomic(boolean, jsonb) from public, anon, authenticated;
grant execute on function public.save_modifier_atomic(boolean, jsonb) to service_role;

alter table public.modifiers drop column group_name;
