-- supabase/migrations/0124_save_purchased_item_atomic.sql
-- Kho dot 2, S2: saving an item (Hang hoa) becomes all-or-nothing. Until now
-- addPurchasedItem wrote purchased_items and then each uom_conversions row one
-- by one, and updatePurchasedItem wrote the item, the assets it retires and the
-- conversions (edit, add, remove) one by one, so a failure part way left a
-- half-saved item.
--
-- Example: editing Bot ca phe (SPM-001) with one conversion renamed, one new
-- and one removed either saves all three plus the item row, or none of them.
--
-- Every refusal that needs the whole picture (duplicate name, unit lock, past
-- Gia von lock, asset removal, conversion used on a purchase line) stays in the
-- action and runs before this call; this function only writes. Ids are minted
-- here the way generateNewId does: highest numeric suffix + 1, 3 digits. An
-- advisory lock stops two saves minting the same id.
--
-- Conversion removal: a conversion some purchase_order_lines.conversion_id
-- points to is set INACTIVE; any other removed one is deleted (owner rule:
-- history is never deleted, unused rows may be).
--
-- NOT YET RUN on the server; the owner approves running it separately. The
-- action code that calls this function must ship only after it has run: pushed
-- first, every item save would fail with "function does not exist".
--
-- Triggers (queried live 2026-10-15 from information_schema.triggers): on
-- purchased_items, uom_conversions and assets each has one,
-- trg_*_touch = touch_updated_at() on UPDATE, which only sets updated_at. No
-- other trigger exists on these three tables.
create or replace function public.save_purchased_item_atomic(
  p_item_id text,              -- null creates a new item, a value edits that item
  p_name text,
  p_category_id text,
  p_is_non_inventory boolean,
  p_warning_confirmed boolean, -- the owner confirmed a diacritic-only name match
  p_confirmed_by text,
  p_base_unit text,
  p_conversions jsonb,         -- null leaves conversions alone; else [{id?, name, conversion_rate}]
  p_retire_asset_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id text := nullif(btrim(coalesce(p_item_id, '')), '');
  v_conv jsonb;
  v_conv_id text;
  v_next integer;
  v_kept text[] := '{}';
  v_old record;
begin
  perform pg_advisory_xact_lock(hashtext('save_purchased_item_atomic'));

  begin
    if v_id is null then
      select coalesce(max(substring(id from '^SPM-([0-9]+)$')::integer), 0) + 1
        into v_next from public.purchased_items where id ~ '^SPM-[0-9]+$';
      v_id := 'SPM-' || lpad(v_next::text, 3, '0');
      insert into public.purchased_items (
        id, name, item_category_id, is_non_inventory,
        duplicate_warning_confirmed, duplicate_warning_confirmed_by, duplicate_warning_confirmed_at
      ) values (
        v_id, p_name, nullif(p_category_id, ''), coalesce(p_is_non_inventory, false),
        coalesce(p_warning_confirmed, false),
        case when p_warning_confirmed then p_confirmed_by end,
        case when p_warning_confirmed then now() end
      );
    else
      -- base_ingredient_id and status are deliberately left alone, as before.
      update public.purchased_items set
        name = p_name,
        item_category_id = nullif(p_category_id, ''),
        is_non_inventory = coalesce(p_is_non_inventory, false),
        duplicate_warning_confirmed = duplicate_warning_confirmed or coalesce(p_warning_confirmed, false),
        duplicate_warning_confirmed_by = case when p_warning_confirmed then p_confirmed_by else duplicate_warning_confirmed_by end,
        duplicate_warning_confirmed_at = case when p_warning_confirmed then now() else duplicate_warning_confirmed_at end
      where id = v_id;
      if not found then
        raise exception 'Không tìm thấy hàng hoá.';
      end if;
    end if;
  exception
    when unique_violation then
      raise exception 'Đã có hàng hoá đang dùng tên "%". Hãy chọn tên khác.', p_name;
  end;

  update public.assets set status = 'INACTIVE'
  where id = any(coalesce(p_retire_asset_ids, '{}'));

  if p_conversions is not null then
    for v_conv in select * from jsonb_array_elements(p_conversions) loop
      v_conv_id := nullif(v_conv->>'id', '');
      if v_conv_id is not null then
        -- Only this item's own row: a foreign id sent by the form changes nothing.
        update public.uom_conversions set
          purchased_unit = v_conv->>'name',
          base_unit = p_base_unit,
          conversion_rate = (v_conv->>'conversion_rate')::numeric
        where id = v_conv_id and purchased_item_id = v_id;
      else
        select coalesce(max(substring(id from '^QD-([0-9]+)$')::integer), 0) + 1
          into v_next from public.uom_conversions where id ~ '^QD-[0-9]+$';
        v_conv_id := 'QD-' || lpad(v_next::text, 3, '0');
        insert into public.uom_conversions (id, purchased_item_id, purchased_unit, base_unit, conversion_rate)
        values (v_conv_id, v_id, v_conv->>'name', p_base_unit, (v_conv->>'conversion_rate')::numeric);
      end if;
      v_kept := v_kept || v_conv_id;
    end loop;

    -- Rows the form no longer lists. A brand-new item has none.
    for v_old in
      select c.id, exists (select 1 from public.purchase_order_lines l where l.conversion_id = c.id) as used
      from public.uom_conversions c
      where c.purchased_item_id = v_id and c.id <> all(v_kept)
    loop
      if v_old.used then
        update public.uom_conversions set status = 'INACTIVE' where id = v_old.id;
      else
        delete from public.uom_conversions where id = v_old.id;
      end if;
    end loop;
  end if;

  return jsonb_build_object('item_id', v_id);
end;
$$;

revoke all on function public.save_purchased_item_atomic(text, text, text, boolean, boolean, text, text, jsonb, text[]) from public;
revoke all on function public.save_purchased_item_atomic(text, text, text, boolean, boolean, text, text, jsonb, text[]) from anon;
revoke all on function public.save_purchased_item_atomic(text, text, text, boolean, boolean, text, text, jsonb, text[]) from authenticated;
grant execute on function public.save_purchased_item_atomic(text, text, text, boolean, boolean, text, text, jsonb, text[]) to service_role;
