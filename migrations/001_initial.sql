-- ĐÃ CHẠY TRÊN SUPABASE - KHÔNG CHẠY LẠI
-- Migration 001 — Bảng gốc + Supplies & PO (cũ)

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            uuid primary key default gen_random_uuid(),
  username      text unique not null,
  name          text not null,
  role          text not null default 'staff'
                check (role in ('staff','manager','owner')),
  password_hash text not null,
  active        boolean default true,
  created_at    timestamptz default now()
);

ALTER TABLE users enable row level security;
CREATE POLICY "allow_all_users" ON users FOR ALL USING (true) WITH CHECK (true);

-- Tài khoản mặc định (password: admin123 / manager123 / staff123 — SHA-256 hex)
INSERT INTO users (username, name, role, password_hash) VALUES
  ('admin',   'Admin',   'owner',   '240be518fabd2724ddb6f04eeb1da5967448d7e831d06d456dc37001740e3b0b'),
  ('manager', 'Manager', 'manager', '958f6ad32ab19db13282dcbbf27b2acb3d47e1e3b77c0d37dce49fa0c74e6a4'),
  ('staff',   'Staff',   'staff',   '718c015fcc76e2d52b33a4b7c8d4be1a9c41c9e4b4e1e0e1e8f4e3e2e1e0b9a8')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id          uuid primary key default gen_random_uuid(),
  items       jsonb not null default '[]',
  total       integer not null default 0,
  created_by  uuid references users(id),
  created_at  timestamptz default now()
);

ALTER TABLE orders enable row level security;
CREATE POLICY "allow_all_orders" ON orders FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- RAW_STOCK — tồn kho nguyên liệu thô
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_stock (
  id          text primary key,   -- khớp với raw_materials.id
  quantity    numeric not null default 0,
  updated_at  timestamptz default now()
);

ALTER TABLE raw_stock enable row level security;
CREATE POLICY "allow_all_raw_stock" ON raw_stock FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEMI_STOCK — tồn kho bán thành phẩm
-- ============================================================
CREATE TABLE IF NOT EXISTS semi_stock (
  id          text primary key,   -- khớp với semi_products.id
  quantity    numeric not null default 0,
  updated_at  timestamptz default now()
);

ALTER TABLE semi_stock enable row level security;
CREATE POLICY "allow_all_semi_stock" ON semi_stock FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- STOCK_RECEIPTS — lịch sử nhập kho thủ công
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_receipts (
  id          uuid primary key default gen_random_uuid(),
  material_id text not null,
  material_type text not null default 'raw' check (material_type in ('raw','semi','supply')),
  quantity    numeric not null,
  unit        text,
  note        text,
  created_by  uuid references users(id),
  created_at  timestamptz default now()
);

ALTER TABLE stock_receipts enable row level security;
CREATE POLICY "allow_all_stock_receipts" ON stock_receipts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- EXPENSES — chi phí
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id          uuid primary key default gen_random_uuid(),
  amount      integer not null default 0,
  category    text not null,
  note        text,
  date        date not null default current_date,
  created_by  uuid references users(id),
  created_at  timestamptz default now()
);

ALTER TABLE expenses enable row level security;
CREATE POLICY "allow_all_expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SCHEDULE_LOGS — chấm công
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_logs (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  user_id     uuid references users(id),
  check_in    timestamptz,
  check_out   timestamptz,
  late_minutes integer default 0,
  note        text,
  created_at  timestamptz default now(),
  unique(date, user_id)
);

ALTER TABLE schedule_logs enable row level security;
CREATE POLICY "allow_all_schedule_logs" ON schedule_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SUPPLIES — vật tư tiêu hao (ly, nắp, ống hút...)
-- ============================================================
CREATE TABLE IF NOT EXISTS supplies (
  id          text primary key,
  name        text not null,
  category    text not null default 'consumable',
  quantity    numeric not null default 0,
  unit        text not null default 'cái',
  warn_at     numeric default 0,
  updated_at  timestamptz default now()
);

ALTER TABLE supplies enable row level security;
CREATE POLICY "allow_all_supplies" ON supplies FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PURCHASE_ORDERS — phiếu nhập hàng (cấu trúc gốc)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  note        text,
  created_by  uuid references users(id),
  created_at  timestamptz default now()
);

ALTER TABLE purchase_orders enable row level security;
CREATE POLICY "allow_all_purchase_orders" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PURCHASE_ORDER_ITEMS — dòng hàng trong phiếu (cấu trúc gốc)
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid references purchase_orders(id) on delete cascade,
  material_id text not null,
  material_type text not null default 'raw',
  quantity    numeric not null default 0,
  unit        text,
  unit_price  integer default 0,
  total       integer default 0,
  created_at  timestamptz default now()
);

ALTER TABLE purchase_order_items enable row level security;
CREATE POLICY "allow_all_po_items" ON purchase_order_items FOR ALL USING (true) WITH CHECK (true);
