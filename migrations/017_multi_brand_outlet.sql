-- Migration 017: Multi-brand / Multi-outlet
-- Idempotent — safe to re-run

-- ============================================================
-- 1. Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outlets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   uuid REFERENCES brands(id),
  code       text UNIQUE NOT NULL,
  name       text NOT NULL,
  address    text,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. Add columns to existing tables (skip if already exists)
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS brand_id  uuid REFERENCES brands(id),
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES outlets(id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES outlets(id);

-- ============================================================
-- 3. Row Level Security
-- ============================================================

ALTER TABLE brands  ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'brands' AND policyname = 'allow_all_brands'
  ) THEN
    CREATE POLICY "allow_all_brands" ON brands FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'outlets' AND policyname = 'allow_all_outlets'
  ) THEN
    CREATE POLICY "allow_all_outlets" ON outlets FOR ALL USING (true);
  END IF;
END $$;

-- ============================================================
-- 4. Seed data (skip if already exists)
-- ============================================================

INSERT INTO brands (code, name) VALUES
  ('CF_SANG', 'Cà Phê Sáng'),
  ('TRA_TOI', 'Trà Tối')
ON CONFLICT (code) DO NOTHING;

INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O1', 'Cà Phê Sáng — Outlet 1' FROM brands WHERE code = 'CF_SANG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O2', 'Cà Phê Sáng — Outlet 2' FROM brands WHERE code = 'CF_SANG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O3', 'Cà Phê Sáng — Outlet 3' FROM brands WHERE code = 'CF_SANG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O4', 'Cà Phê Sáng — Outlet 4' FROM brands WHERE code = 'CF_SANG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O5', 'Cà Phê Sáng — Outlet 5' FROM brands WHERE code = 'CF_SANG'
ON CONFLICT (code) DO NOTHING;

INSERT INTO outlets (brand_id, code, name)
SELECT id, 'TRA_O1', 'Trà Tối — Outlet 1' FROM brands WHERE code = 'TRA_TOI'
ON CONFLICT (code) DO NOTHING;

INSERT INTO outlets (brand_id, code, name)
SELECT id, 'TRA_O2', 'Trà Tối — Outlet 2' FROM brands WHERE code = 'TRA_TOI'
ON CONFLICT (code) DO NOTHING;
