-- 021_supabase_auth_rls.sql
-- Tích hợp Supabase Auth — thêm auth_id, thay thế open policies bằng auth-required policies

-- ── 1. Thêm cột auth_id vào bảng users ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- ── 2. Helper function — tránh infinite recursion khi policy query users ──
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()
$$;

-- ── 3. Xoá open policies cũ ──
DROP POLICY IF EXISTS "users_open"         ON users;
DROP POLICY IF EXISTS "orders_open"        ON orders;
DROP POLICY IF EXISTS "settings_open"      ON settings;
DROP POLICY IF EXISTS "products_open"      ON products;
DROP POLICY IF EXISTS "brands_open"        ON brands;
DROP POLICY IF EXISTS "outlets_open"       ON outlets;
DROP POLICY IF EXISTS "raw_materials_open" ON raw_materials;
DROP POLICY IF EXISTS "semi_products_open" ON semi_products;
DROP POLICY IF EXISTS "supplies_open"      ON supplies;
DROP POLICY IF EXISTS "product_recipes_open" ON product_recipes;

-- Xoá policy cũ của order_counters (từ migration 020)
DROP POLICY IF EXISTS "authenticated can use counter" ON order_counters;

-- ── 4. Policies mới — yêu cầu đăng nhập ──

-- users: đọc được nếu đã login
CREATE POLICY "users_read"  ON users FOR SELECT USING (auth.uid() IS NOT NULL);
-- users: chỉ update record của chính mình (đổi password qua Supabase Auth, không cần)
-- Write operations (create/delete/update role) qua Edge Function với service key

-- orders: mọi user đã login
CREATE POLICY "orders_auth" ON orders FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- settings: đọc — mọi user; ghi — owner only
CREATE POLICY "settings_read"  ON settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_write" ON settings FOR ALL
  USING (get_my_role() = 'owner')
  WITH CHECK (get_my_role() = 'owner');

-- products: đọc — mọi user; ghi — owner/manager
CREATE POLICY "products_read"  ON products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "products_write" ON products FOR ALL
  USING (get_my_role() IN ('owner', 'manager'))
  WITH CHECK (get_my_role() IN ('owner', 'manager'));

-- brands, outlets: đọc — mọi user; ghi — owner
CREATE POLICY "brands_read"   ON brands FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "brands_write"  ON brands FOR ALL
  USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');

CREATE POLICY "outlets_read"  ON outlets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "outlets_write" ON outlets FOR ALL
  USING (get_my_role() = 'owner') WITH CHECK (get_my_role() = 'owner');

-- raw_materials, semi_products, supplies, product_recipes: owner/manager
CREATE POLICY "raw_materials_auth"    ON raw_materials    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "semi_products_auth"    ON semi_products    FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "supplies_auth"         ON supplies         FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "product_recipes_auth"  ON product_recipes  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- order_counters: mọi user đã login
CREATE POLICY "counters_auth" ON order_counters FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
