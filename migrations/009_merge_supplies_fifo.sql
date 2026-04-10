-- Migration 009: Hợp nhất vật tư trùng + tạo bảng supply_batches (FIFO)
-- Chạy sau Migration 008

-- ============================================================
-- BƯỚC 1: Hợp nhất số lượng vào vật tư gốc
-- ============================================================
UPDATE supplies s
SET quantity   = s.quantity + dup.quantity,
    updated_at = NOW()
FROM (VALUES
  ('ly',      'ly_pet98_16oz'),
  ('nap',     'nap_pet98'),
  ('ong_hut', 'ong_hut_den_zin'),
  ('muong',   'muong_den_15'),
  ('tui_don', 'tui_chu_t'),
  ('tui_doi', 'tui_doi_pe')
) AS m(canonical_id, dup_id)
JOIN supplies dup ON dup.id = m.dup_id
WHERE s.id = m.canonical_id;

-- ============================================================
-- BƯỚC 2: Cập nhật sku_items — trỏ về id gốc
-- ============================================================
UPDATE sku_items SET map_to    = 'ly'      WHERE map_to    = 'ly_pet98_16oz';
UPDATE sku_items SET map_to    = 'nap'     WHERE map_to    = 'nap_pet98';
UPDATE sku_items SET map_to    = 'ong_hut' WHERE map_to    = 'ong_hut_den_zin';
UPDATE sku_items SET map_to    = 'muong'   WHERE map_to    = 'muong_den_15';
UPDATE sku_items SET map_to    = 'tui_don' WHERE map_to    = 'tui_chu_t';
UPDATE sku_items SET map_to    = 'tui_doi' WHERE map_to    = 'tui_doi_pe';

-- Nếu dùng cột map_to_id (sau ALTER migration 007)
UPDATE sku_items SET map_to_id = 'ly'      WHERE map_to_id = 'ly_pet98_16oz';
UPDATE sku_items SET map_to_id = 'nap'     WHERE map_to_id = 'nap_pet98';
UPDATE sku_items SET map_to_id = 'ong_hut' WHERE map_to_id = 'ong_hut_den_zin';
UPDATE sku_items SET map_to_id = 'muong'   WHERE map_to_id = 'muong_den_15';
UPDATE sku_items SET map_to_id = 'tui_don' WHERE map_to_id = 'tui_chu_t';
UPDATE sku_items SET map_to_id = 'tui_doi' WHERE map_to_id = 'tui_doi_pe';

-- ============================================================
-- BƯỚC 3: Cập nhật purchase_order_items — trỏ về id gốc
-- ============================================================
UPDATE purchase_order_items SET item_id = 'ly'      WHERE item_id = 'ly_pet98_16oz';
UPDATE purchase_order_items SET item_id = 'nap'     WHERE item_id = 'nap_pet98';
UPDATE purchase_order_items SET item_id = 'ong_hut' WHERE item_id = 'ong_hut_den_zin';
UPDATE purchase_order_items SET item_id = 'muong'   WHERE item_id = 'muong_den_15';
UPDATE purchase_order_items SET item_id = 'tui_don' WHERE item_id = 'tui_chu_t';
UPDATE purchase_order_items SET item_id = 'tui_doi' WHERE item_id = 'tui_doi_pe';

-- ============================================================
-- BƯỚC 4: Xoá các vật tư trùng
-- ============================================================
DELETE FROM supplies WHERE id IN (
  'ly_pet98_16oz',
  'nap_pet98',
  'ong_hut_den_zin',
  'muong_den_15',
  'tui_chu_t',
  'tui_doi_pe'
);

-- ============================================================
-- BƯỚC 5: Tạo bảng supply_batches — theo dõi lô để FIFO
-- ============================================================
CREATE TABLE IF NOT EXISTS supply_batches (
  id            uuid primary key default gen_random_uuid(),
  supply_id     text not null references supplies(id),
  po_id         uuid references purchase_orders(id),
  initial_qty   numeric not null default 0,
  remaining_qty numeric not null default 0,  -- còn lại trong lô này
  purchase_date date,
  unit_cost     numeric default 0,           -- giá vốn đơn vị của lô
  created_at    timestamptz default now()
);

ALTER TABLE supply_batches enable row level security;
CREATE POLICY "allow_all_supply_batches" ON supply_batches FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- BƯỚC 6: Seed batches từ purchase_order_items đã nhập
-- (chạy BƯỚC 3 trước để item_id đã được đổi về id gốc)
-- ============================================================
INSERT INTO supply_batches (supply_id, po_id, initial_qty, remaining_qty, purchase_date, unit_cost)
SELECT
  poi.item_id,
  poi.po_id,
  poi.base_qty,
  poi.base_qty,
  po.created_at::date,
  CASE WHEN poi.base_qty > 0
       THEN poi.amount_after_discount::numeric / poi.base_qty
       ELSE 0
  END
FROM purchase_order_items poi
JOIN purchase_orders po ON po.id = poi.po_id
WHERE poi.item_type IN ('supply', 'equipment')
  AND poi.base_qty > 0;
