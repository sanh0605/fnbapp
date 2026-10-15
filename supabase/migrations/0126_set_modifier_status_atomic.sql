-- 2026-10-15 owner decision "Ngừng cả hai" (BR-CATALOG-005): stopping a topping option also stops
-- the dish it is sold as on its own. The option row and the dish plus its sizes change in one
-- transaction. "Dùng lại" (ACTIVE) restarts the option only; the dish comes back through
-- "Bán độc lập" (set_product_status_atomic).
--
-- New function name, so it may run before or after the code that calls it; the code needs it to
-- exist. NOT YET RUN on the server; the owner approves running it separately.
-- Triggers: modifiers carries one BEFORE UPDATE touch_updated_at trigger (0001); the old code
-- fired the same trigger through a plain update.

create or replace function public.set_modifier_status_atomic(
  p_modifier_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id text;
  v_product_stopped boolean := false;
  v_other_name text;
  v_other_active boolean;
begin
  if p_status is null or p_status not in ('ACTIVE', 'INACTIVE') then
    raise exception 'Trạng thái không hợp lệ';
  end if;

  select product_id into v_product_id from public.modifiers where id = p_modifier_id;
  if not found then
    raise exception 'Không tìm thấy tuỳ chọn';
  end if;

  -- Lock this option and every option linked to the same dish (id order, so two callers cannot
  -- deadlock); a null product_id matches nothing, leaving only this row locked.
  perform 1 from public.modifiers where id = p_modifier_id or product_id = v_product_id order by id for update;

  select name into v_other_name from public.modifiers
    where product_id = v_product_id and id <> p_modifier_id and status = 'ACTIVE' limit 1;
  v_other_active := found;

  if p_status = 'ACTIVE' and v_other_active then
    raise exception 'Đã có tuỳ chọn "%" đang dùng cho món bán riêng này; ngừng tuỳ chọn đó trước.', v_other_name;
  end if;

  update public.modifiers set status = p_status where id = p_modifier_id;

  if p_status = 'INACTIVE' and v_product_id is not null and not v_other_active
     and exists (select 1 from public.products where id = v_product_id and status = 'ACTIVE') then
    perform public.set_product_status_atomic(v_product_id, 'INACTIVE');
    v_product_stopped := true;
  end if;

  return jsonb_build_object('modifier_id', p_modifier_id, 'product_stopped', v_product_stopped);
end;
$$;

revoke all on function public.set_modifier_status_atomic(text, text) from public, anon, authenticated;
grant execute on function public.set_modifier_status_atomic(text, text) to service_role;
