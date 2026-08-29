-- docs/superpowers/plans/2026-08-29-product-stop-selling-and-real-delete.md.
-- Owner decision 2026-08-29: a product that has never been sold is erased
-- for real; a product that has been sold is only ever hidden (`INACTIVE`).
-- This overrides CLAUDE.md section 2's never-delete rule for `products`,
-- scoped exactly to products with zero order_lines_v2 rows -- do not widen it.
--
-- The rule is not implemented in application code. Every foreign key into
-- products and product_variants is `on delete restrict`
-- (0001_init_schema.sql lines 96, 197, 250, 252) -- product_variants.product_id,
-- product_price_history.variant_id, and order_lines_v2's own product_id and
-- variant_id. Postgres already refuses to erase a product that has been
-- sold; this function attempts the delete and lets that refusal happen,
-- translating it into a Vietnamese sentence naming the product, rather than
-- re-deriving the "never sold" check in TypeScript where it could drift
-- from what the database actually enforces.
--
-- product_price_history restricts too, and unlike order_lines_v2 it must
-- cascade -- a price history for a drink never sold records nothing worth
-- protecting. So the erase order is price history, then variants, then the
-- product itself, all three inside one exception-catching block: any
-- foreign_key_violation (order_lines_v2 refusing the variant or product
-- delete) rolls back all three together. A partial erase would leave
-- exactly the dangling-reference shape TS-009/TS-010 (OPEN-ITEMS 65) show a
-- month later -- a row pointing at something that no longer exists.

create or replace function public.erase_never_sold_product_atomic(
  p_product_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_name text;
  v_price_history_count integer := 0;
  v_variant_count integer := 0;
begin
  if p_product_id is null or btrim(p_product_id) = '' then
    raise exception 'p_product_id is required';
  end if;

  select name into v_product_name
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Không tìm thấy món để xoá';
  end if;

  begin
    delete from public.product_price_history
    where variant_id in (
      select id from public.product_variants where product_id = p_product_id
    );
    get diagnostics v_price_history_count = row_count;

    delete from public.product_variants
    where product_id = p_product_id;
    get diagnostics v_variant_count = row_count;

    delete from public.products
    where id = p_product_id;
  exception
    when foreign_key_violation then
      raise exception
        'Món "%" đã có đơn hàng nên không thể xoá vĩnh viễn. Dùng "Ngừng bán" để ẩn khỏi POS thay vì xoá.',
        v_product_name;
  end;

  return jsonb_build_object(
    'product_id', p_product_id,
    'product_name', v_product_name,
    'price_history_deleted', v_price_history_count,
    'variants_deleted', v_variant_count
  );
end;
$$;

revoke all on function public.erase_never_sold_product_atomic(text) from public;
revoke all on function public.erase_never_sold_product_atomic(text) from anon;
revoke all on function public.erase_never_sold_product_atomic(text) from authenticated;
grant execute on function public.erase_never_sold_product_atomic(text) to service_role;
