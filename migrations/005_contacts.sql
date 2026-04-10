-- ĐÃ CHẠY TRÊN SUPABASE - KHÔNG CHẠY LẠI
-- Migration 005 — Contacts: thêm contact_type vào bảng suppliers

-- Bảng suppliers dùng chung cho tất cả loại liên lạc:
--   nha_cung_cap — nhà cung cấp (NCC-XXX), dùng trong Purchasing
--   khach_hang   — khách hàng   (KH-XXX),  dùng cho tích điểm
--   nhuong_quyen — đối tác nhượng quyền (NQ-XXX)
--   khac         — khác (KC-XXX)

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS contact_type text NOT NULL DEFAULT 'nha_cung_cap';

-- Đảm bảo các bản ghi cũ (seed từ migration 004) có đúng contact_type
UPDATE suppliers SET contact_type = 'nha_cung_cap'
WHERE contact_type IS NULL OR contact_type = '';
