-- Migration 018: Offline idempotency
-- Thêm client_id vào orders để tránh insert trùng khi sync offline
-- Ghi chú: password đã lưu dạng SHA-256 hash trong cột password_hash từ migration 001

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS client_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS orders_client_id_unique
  ON orders (client_id)
  WHERE client_id IS NOT NULL;
