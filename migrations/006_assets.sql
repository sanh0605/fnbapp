-- Migration 006 — Bảng tài sản (10/04/2026)
CREATE TABLE assets (
  id                   uuid primary key default gen_random_uuid(),
  asset_code           text unique not null,
  name                 text not null,
  asset_type           text not null,
  description          text,
  status               text not null default 'active'
                       check (status in ('active','maintenance','broken','disposed')),
  location             text,
  assigned_to          uuid references users(id),
  purchase_date        date,
  purchase_price       integer default 0,
  supplier_id          uuid references suppliers(id),
  useful_life_months   integer default 0,
  salvage_value        integer default 0,
  note                 text,
  active               boolean default true,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

ALTER TABLE assets enable row level security;
CREATE POLICY "allow_all_assets" ON assets FOR ALL USING (true) WITH CHECK (true);
