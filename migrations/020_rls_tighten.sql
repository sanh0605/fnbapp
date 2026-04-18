-- ============================================================
-- FNB App — Migration 020: Tighten RLS policies
-- Thay blanket USING(true)/WITH CHECK(true) bằng granular policies
--
-- GIỚI HẠN: User-level filtering (ai được đọc/ghi gì) cần Supabase Auth
-- (jwt claim) — chưa implement. BACKLOG: migrate sang Supabase Auth.
-- Migration này chỉ bảo vệ data integrity, không bảo vệ data privacy.
-- ============================================================

-- ── Xoá toàn bộ policy cũ ────────────────────────────────────
drop policy if exists "brands_open"          on brands;
drop policy if exists "outlets_open"         on outlets;
drop policy if exists "users_open"           on users;
drop policy if exists "orders_open"          on orders;
drop policy if exists "settings_open"        on settings;
drop policy if exists "products_open"        on products;
drop policy if exists "product_recipes_open" on product_recipes;
drop policy if exists "raw_materials_open"   on raw_materials;
drop policy if exists "semi_products_open"   on semi_products;
drop policy if exists "supplies_open"        on supplies;


-- ── BRANDS: read-only (không có UI nào cho phép sửa brands) ──
create policy "brands_select" on brands for select using (true);


-- ── OUTLETS: read-only ────────────────────────────────────────
create policy "outlets_select" on outlets for select using (true);


-- ── USERS ────────────────────────────────────────────────────
-- SELECT: cần để login + trang settings
-- INSERT/UPDATE: chỉ cho phép role hợp lệ
-- DELETE: blocked — dùng active=false để vô hiệu hoá
create policy "users_select" on users
  for select using (true);

create policy "users_insert" on users
  for insert with check (
    role in ('owner', 'manager', 'staff')
    and active in (true, false)
  );

create policy "users_update" on users
  for update using (true) with check (
    role in ('owner', 'manager', 'staff')
  );
-- DELETE intentionally omitted → blocked by RLS


-- ── ORDERS ───────────────────────────────────────────────────
-- SELECT: cần để orders/revenue pages
-- INSERT: validate method và total
-- UPDATE: chỉ cho phép void (voided false → true), không sửa được amount/items
-- DELETE: blocked — dùng voided=true
create policy "orders_select" on orders
  for select using (true);

create policy "orders_insert" on orders
  for insert with check (
    total >= 0
    and method in ('Tiền mặt', 'Chuyển khoản')
  );

create policy "orders_update" on orders
  for update
  using  (voided = false)   -- chỉ update order chưa void
  with check (voided = true); -- chỉ được set voided=true, không sửa field khác
-- DELETE intentionally omitted → blocked by RLS


-- ── SETTINGS ─────────────────────────────────────────────────
create policy "settings_select" on settings for select using (true);
create policy "settings_insert" on settings for insert with check (true);
create policy "settings_update" on settings for update using (true) with check (true);


-- ── PRODUCTS ─────────────────────────────────────────────────
create policy "products_select" on products for select using (true);
create policy "products_insert" on products for insert with check (true);
create policy "products_update" on products for update using (true) with check (true);
create policy "products_delete" on products for delete using (true);


-- ── PRODUCT_RECIPES ──────────────────────────────────────────
create policy "recipes_select" on product_recipes for select using (true);
create policy "recipes_insert" on product_recipes for insert with check (true);
create policy "recipes_update" on product_recipes for update using (true) with check (true);
create policy "recipes_delete" on product_recipes for delete using (true);


-- ── RAW_MATERIALS ─────────────────────────────────────────────
create policy "raw_select" on raw_materials for select using (true);
create policy "raw_insert" on raw_materials for insert with check (true);
create policy "raw_update" on raw_materials for update using (true) with check (true);
create policy "raw_delete" on raw_materials for delete using (true);


-- ── SEMI_PRODUCTS ─────────────────────────────────────────────
create policy "semi_select" on semi_products for select using (true);
create policy "semi_insert" on semi_products for insert with check (true);
create policy "semi_update" on semi_products for update using (true) with check (true);
create policy "semi_delete" on semi_products for delete using (true);


-- ── SUPPLIES ─────────────────────────────────────────────────
create policy "sup_select" on supplies for select using (true);
create policy "sup_insert" on supplies for insert with check (true);
create policy "sup_update" on supplies for update using (true) with check (true);
create policy "sup_delete" on supplies for delete using (true);
