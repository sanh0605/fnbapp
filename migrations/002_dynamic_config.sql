-- ĐÃ CHẠY TRÊN SUPABASE - KHÔNG CHẠY LẠI
-- Migration 002 — Bảng cấu hình động

-- ============================================================
-- SETTINGS — cấu hình hệ thống (key-value)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz default now()
);

ALTER TABLE settings enable row level security;
CREATE POLICY "allow_all_settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- RAW_MATERIALS — danh mục nguyên liệu thô
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_materials (
  id          text primary key,
  name        text not null,
  unit        text not null default 'g',
  created_at  timestamptz default now()
);

ALTER TABLE raw_materials enable row level security;
CREATE POLICY "allow_all_raw_materials" ON raw_materials FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEMI_PRODUCTS — danh mục bán thành phẩm
-- ============================================================
CREATE TABLE IF NOT EXISTS semi_products (
  id          text primary key,
  name        text not null,
  unit        text not null default 'ml',
  yield_qty   numeric not null default 1000,
  created_at  timestamptz default now()
);

ALTER TABLE semi_products enable row level security;
CREATE POLICY "allow_all_semi_products" ON semi_products FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEMI_RECIPES — công thức pha bán thành phẩm
-- ============================================================
CREATE TABLE IF NOT EXISTS semi_recipes (
  id              uuid primary key default gen_random_uuid(),
  semi_id         text not null references semi_products(id) on delete cascade,
  ingredient_id   text not null,
  ingredient_type text not null default 'raw' check (ingredient_type in ('raw','supply')),
  amount          numeric not null default 0,
  unit            text,
  created_at      timestamptz default now()
);

ALTER TABLE semi_recipes enable row level security;
CREATE POLICY "allow_all_semi_recipes" ON semi_recipes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PRODUCTS — menu sản phẩm bán ra
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'Cà phê',
  price       integer not null default 0,
  icon        text default '☕',
  color       text default '#FAEEDA',
  active      boolean default true,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

ALTER TABLE products enable row level security;
CREATE POLICY "allow_all_products" ON products FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PRODUCT_RECIPES — công thức sản phẩm
-- ============================================================
CREATE TABLE IF NOT EXISTS product_recipes (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  ingredient_id   text not null,
  ingredient_type text not null default 'semi' check (ingredient_type in ('raw','semi','supply')),
  amount          numeric not null default 0,
  unit            text,
  created_at      timestamptz default now()
);

ALTER TABLE product_recipes enable row level security;
CREATE POLICY "allow_all_product_recipes" ON product_recipes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- UNIT_CONVERSIONS — bảng quy đổi đơn vị
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_conversions (
  id            uuid primary key default gen_random_uuid(),
  item_id       text not null,
  item_type     text not null default 'raw' check (item_type in ('raw','supply')),
  unit_name     text not null,
  to_base_rate  numeric not null default 1,  -- 1 unit_name = to_base_rate đơn vị cơ bản
  created_at    timestamptz default now(),
  unique(item_id, unit_name)
);

ALTER TABLE unit_conversions enable row level security;
CREATE POLICY "allow_all_unit_conversions" ON unit_conversions FOR ALL USING (true) WITH CHECK (true);
