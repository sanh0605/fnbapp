-- ĐÃ CHẠY TRÊN SUPABASE - KHÔNG CHẠY LẠI
-- Migration 004 — Purchase Management System (10/04/2026)

-- ============================================================
-- SUPPLIERS — nhà cung cấp
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  phone         text,
  email         text,
  address       text,
  platform      text,        -- lazada / shopee / tiki / trực_tiếp / khác
  platform_url  text,
  active        boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

ALTER TABLE suppliers enable row level security;
CREATE POLICY "allow_all_suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SKU_ITEMS — sản phẩm nhập kho theo thương hiệu
-- ============================================================
CREATE TABLE IF NOT EXISTS sku_items (
  id            uuid primary key default gen_random_uuid(),
  sku_code      text unique not null,   -- NVL-SUA-MLK / VTU-LY-001 / CCU-XXX
  name          text not null,
  map_type      text not null default 'raw' check (map_type in ('raw','supply')),
  map_to        text not null,          -- id trong raw_materials hoặc supplies
  supplier_id   uuid references suppliers(id),
  active        boolean default true,
  created_at    timestamptz default now()
);

ALTER TABLE sku_items enable row level security;
CREATE POLICY "allow_all_sku_items" ON sku_items FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SKU_UNITS — đơn vị tính của từng SKU
-- ============================================================
CREATE TABLE IF NOT EXISTS sku_units (
  id            uuid primary key default gen_random_uuid(),
  sku_id        uuid not null references sku_items(id) on delete cascade,
  unit_name     text not null,
  to_base_rate  numeric not null default 1,   -- 1 unit_name = N đơn vị cơ bản
  created_at    timestamptz default now(),
  unique(sku_id, unit_name)
);

ALTER TABLE sku_units enable row level security;
CREATE POLICY "allow_all_sku_units" ON sku_units FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PO_ADJUSTMENTS — điều chỉnh tài chính trên đơn nhập
-- ============================================================
CREATE TABLE IF NOT EXISTS po_adjustments (
  id            uuid primary key default gen_random_uuid(),
  po_id         uuid not null references purchase_orders(id) on delete cascade,
  type          text not null default 'fee' check (type in ('discount','fee','other')),
  label         text not null,
  amount        integer not null default 0,
  created_at    timestamptz default now()
);

ALTER TABLE po_adjustments enable row level security;
CREATE POLICY "allow_all_po_adjustments" ON po_adjustments FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PO_PAYMENTS — ghi nhận thanh toán nhiều lần
-- ============================================================
CREATE TABLE IF NOT EXISTS po_payments (
  id            uuid primary key default gen_random_uuid(),
  po_id         uuid not null references purchase_orders(id) on delete cascade,
  method        text not null default 'cash' check (method in ('cash','transfer','cod','other')),
  amount        integer not null default 0,
  note          text,
  paid_at       timestamptz default now(),
  created_at    timestamptz default now()
);

ALTER TABLE po_payments enable row level security;
CREATE POLICY "allow_all_po_payments" ON po_payments FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- ALTER purchase_orders — thêm cột mới
-- ============================================================
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_id       uuid references suppliers(id),
  ADD COLUMN IF NOT EXISTS status            text not null default 'pending'
                                             check (status in ('pending','received','completed')),
  ADD COLUMN IF NOT EXISTS platform          text,
  ADD COLUMN IF NOT EXISTS platform_order_id text,
  ADD COLUMN IF NOT EXISTS debt_due_date     date,
  ADD COLUMN IF NOT EXISTS shipping_fee      integer default 0,
  ADD COLUMN IF NOT EXISTS received_at       timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz default now();

-- ============================================================
-- ALTER purchase_order_items — thêm cột mới
-- ============================================================
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS sku_id                uuid references sku_items(id),
  ADD COLUMN IF NOT EXISTS sku_unit              text,
  ADD COLUMN IF NOT EXISTS to_base_rate          numeric default 1,
  ADD COLUMN IF NOT EXISTS amount_before_discount integer default 0,
  ADD COLUMN IF NOT EXISTS discount_amount        integer default 0,
  ADD COLUMN IF NOT EXISTS amount_after_discount  integer default 0;

-- ============================================================
-- SEED MẪU
-- ============================================================
INSERT INTO suppliers (code, name) VALUES
  ('NCC-001', 'Nhà cung cấp chung')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sku_items (sku_code, name, map_type, map_to)
SELECT 'NVL-SUA-MLK', 'Sữa tươi Mlekovita', 'raw', 'sua_tuoi'
WHERE NOT EXISTS (SELECT 1 FROM sku_items WHERE sku_code='NVL-SUA-MLK');

INSERT INTO sku_units (sku_id, unit_name, to_base_rate)
SELECT s.id, u.unit_name, u.to_base_rate
FROM sku_items s
CROSS JOIN (VALUES ('ml',1),('hộp',1000),('thùng',12000)) AS u(unit_name,to_base_rate)
WHERE s.sku_code='NVL-SUA-MLK'
ON CONFLICT (sku_id, unit_name) DO NOTHING;
