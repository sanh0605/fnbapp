-- Migration 013: Bổ sung cột còn thiếu trong bảng orders
-- (các cột này POS đã dùng nhưng chưa có trong schema gốc)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_num        text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS method           text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_name       text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal         integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount  integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_received  integer;
