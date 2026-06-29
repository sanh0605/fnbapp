-- Migration to add missing columns in multiple tables
--
-- Claude code — Supabase migration fix.
--
-- Bổ sung các cột bị thiếu trong các bảng: pos_drafts, units, suppliers, promotions
-- Các cột này tồn tại ở Google Sheets nhưng bị sót khi khởi tạo schema Supabase.

-- 1. Bảng pos_drafts
ALTER TABLE public.pos_drafts
  ADD COLUMN IF NOT EXISTS timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS brand_id text REFERENCES public.brands(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by_id text,
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- 2. Bảng units
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS description text;

-- 3. Bảng suppliers
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS parent_id text;

-- 4. Bảng promotions
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS min_order_value numeric(18,6) NOT NULL DEFAULT 0;
