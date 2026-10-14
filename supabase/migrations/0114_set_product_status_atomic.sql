-- 2026-10-14 audit, wave 1, item F7. pauseProduct / resumeProduct
-- (app/admin/products/actions.ts) wrote products and then product_variants in
-- separate calls, so a failure half way left a "Ngừng bán" dish whose sizes
-- were still sellable (or the reverse). This function does both writes in
-- one transaction; the rules are copied unchanged from the TypeScript:
--
--   pause  (p_status = 'INACTIVE'): the dish becomes INACTIVE and only its
--          ACTIVE sizes become INACTIVE. A DELETED size is never touched
--          (it must not be resurrected by a pause).
--   resume (p_status = 'ACTIVE'): the dish becomes ACTIVE. If at least one
--          size is already ACTIVE, only INACTIVE sizes come back (a DELETED
--          size stays DELETED). If no size is ACTIVE, every non-ACTIVE size
--          comes back, else the dish would be "Đang bán" with nothing
--          sellable (PROD-048 "Test1", 2026-08-29).
--
-- Triggers on the touched tables (derived from migration text, not read from
-- the live catalog -- supabase/CLAUDE.md: no session can query pg_catalog;
-- method and date as in 0100: grepped every `create trigger` / `drop trigger`
-- in supabase/migrations, 2026-10-14): 0001_init_schema.sql creates exactly
-- one trigger on each of products and product_variants, trg_<table>_touch,
-- BEFORE UPDATE FOR EACH ROW, public.touch_updated_at() (sets updated_at =
-- now()). The old code fired the same triggers through plain updates, so
-- nothing changes. No queue, audit or cascade.
--
-- This changes no return type of an existing function (new name), so it may
-- run before or after the code that calls it; the code needs it to exist.

create or replace function public.set_product_status_atomic(
  p_product_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_active boolean;
  v_changed integer := 0;
begin
  if p_product_id is null or btrim(p_product_id) = '' then
    raise exception 'p_product_id is required';
  end if;
  if p_status is null or p_status not in ('ACTIVE', 'INACTIVE') then
    raise exception 'p_status must be ACTIVE or INACTIVE';
  end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Không tìm thấy món';
  end if;

  update public.products set status = p_status where id = p_product_id;

  if p_status = 'INACTIVE' then
    update public.product_variants
    set status = 'INACTIVE'
    where product_id = p_product_id and status = 'ACTIVE';
    get diagnostics v_changed = row_count;
  else
    select exists (
      select 1 from public.product_variants
      where product_id = p_product_id and status = 'ACTIVE'
    ) into v_has_active;

    if v_has_active then
      update public.product_variants
      set status = 'ACTIVE'
      where product_id = p_product_id and status = 'INACTIVE';
    else
      update public.product_variants
      set status = 'ACTIVE'
      where product_id = p_product_id and status <> 'ACTIVE';
    end if;
    get diagnostics v_changed = row_count;
  end if;

  return jsonb_build_object('product_id', p_product_id, 'variants_changed', v_changed);
end;
$$;

revoke all on function public.set_product_status_atomic(text, text) from public, anon, authenticated;
grant execute on function public.set_product_status_atomic(text, text) to service_role;
