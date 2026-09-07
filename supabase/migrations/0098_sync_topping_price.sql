-- docs/superpowers/plans/2026-09-07-one-price-per-topping.md, extending
-- BR-CATALOG-003 (docs/02-rules/business-rules/catalog.md). Owner decision
-- 2026-09-07: "Luôn cùng giá, sửa một chỗ." -- a topping's price gets one
-- edit point (the Topping screen); the standalone product price follows in
-- the same transaction.
--
-- Trigger check first, per fnbapp-bulk-data-change, re-verified live against
-- production immediately before writing this migration:
--   select tgname, pg_get_triggerdef(oid) from pg_trigger
--    where tgrelid = 'public.<table>'::regclass and not tgisinternal;
-- modifiers: trg_modifiers_touch, BEFORE UPDATE, touch_updated_at() only.
-- product_variants: trg_product_variants_touch, BEFORE UPDATE, same function,
-- same effect. product_price_history: no triggers at all (insert-only).
-- No queue, no other automation on any of the three. This migration has no
-- backfill -- all 8 linked toppings already agree (measured in the plan and
-- re-measured in Task 0) -- so the skill's per-row neutrality proof does not
-- apply; noting that explicitly rather than skipping the step.
--
-- Two traps this function refuses rather than guesses at (both plan Task 0):
-- more than one ACTIVE modifier pointing at the same product (two writers
-- for one price -- MOD-007/MOD-008 both point at PROD-035, but only
-- MOD-008 is ACTIVE, so this has never actually happened), and a product
-- with other than exactly one ACTIVE variant (the only reason "the
-- standalone price" is a single number today).
--
-- Reuses 0044_save_product_atomic_start_date.sql's PPH- id derivation and
-- its pg_advisory_xact_lock(hashtext('product_price_history:id')) rather
-- than inventing a second id scheme for the same table.
--
-- p_name/p_group_name ride along on the same call rather than forcing
-- saveModifierAction into two writes for one edit (plan Task 1 Step 3).
-- They touch modifiers only -- no product-side mirroring, no sync logic:
-- renaming a modifier does not rename its linked product, and nobody has
-- asked for that (plan Cross-impact).

create or replace function public.sync_topping_price_atomic(
  p_modifier_id text,
  p_price bigint,
  p_name text,
  p_group_name text
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
  if nullif(btrim(p_name), '') is null or nullif(btrim(p_group_name), '') is null then
    raise exception 'p_name and p_group_name are required';
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
  set price = p_price, name = p_name, group_name = p_group_name
  where id = p_modifier_id;

  if v_product_id is null then
    -- MOD-009's shape: no linked product, nothing else to sync. Not an
    -- error -- this is the normal path for a topping with no standalone
    -- counterpart.
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

revoke all on function public.sync_topping_price_atomic(text, bigint, text, text) from public;
revoke all on function public.sync_topping_price_atomic(text, bigint, text, text) from anon;
revoke all on function public.sync_topping_price_atomic(text, bigint, text, text) from authenticated;
grant execute on function public.sync_topping_price_atomic(text, bigint, text, text) to service_role;
