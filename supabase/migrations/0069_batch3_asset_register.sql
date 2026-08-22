-- Batch 3, 2026-08-22: asset register and depreciation.
-- docs/superpowers/plans/2026-08-22-batch-3-asset-register.md.
--
-- Three new tables, nothing existing changes shape. CREATE TABLE writes no
-- existing row of any table, so the "prove no row rewritten" check from
-- fnbapp-bulk-data-change does not apply here the way it does to an
-- ALTER TABLE -- there is nothing to rewrite. Verified separately (dry run,
-- rolled back) that the migration applies cleanly and the three seed rows
-- land as expected.

-- 3.1: the editable band table. Seeded with the three bands the owner
-- decided 2026-08-19/22 -- under 200k -> 12 months, 200k-500k -> 24,
-- above 500k -> 36, chosen by UNIT price (owner 2026-08-22), not line
-- total. Bounds are inclusive on both ends except the open-ended last band;
-- lib/asset-depreciation.ts's validateBands enforces no gap, no overlap.
create table if not exists public.asset_depreciation_bands (
  id text primary key,
  min_unit_price bigint not null,
  max_unit_price bigint,
  term_months int not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_asset_depreciation_bands_touch
  before update on public.asset_depreciation_bands
  for each row execute function touch_updated_at();

insert into public.asset_depreciation_bands (id, min_unit_price, max_unit_price, term_months) values
  ('KH-001', 0, 199999, 12),
  ('KH-002', 200000, 500000, 24),
  ('KH-003', 500001, null, 36)
on conflict (id) do nothing;

-- 3.2: one row per purchase line, not per physical unit (see the plan's own
-- reasoning -- eight identical pumps bought on one line would be eight rows
-- differing only in an id; partial disposal is handled by quantity plus
-- asset_disposals below). term_months is stored, not derived -- section
-- 9.1's freeze: editing a band must never change an already-created asset's
-- term. unit_cost is the allocated cost per unit (BR-COGS-006), computed by
-- lib/asset-purchase-allocation.ts at creation time from the same
-- allocatePurchaseOrderCost the COGS report uses -- never recomputed here.
create table if not exists public.assets (
  id text primary key,
  purchased_item_id text not null references public.purchased_items(id),
  purchase_order_line_id text,
  name_snapshot text not null,
  acquired_date date not null,
  unit_cost bigint not null,
  quantity int not null,
  term_months int not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_assets_touch
  before update on public.assets
  for each row execute function touch_updated_at();

-- 3.3: history, never a delete or a downward mutation of assets.quantity.
-- Remaining quantity is assets.quantity minus the sum of disposals for that
-- asset -- derived, so a mistaken disposal is reversed by a compensating
-- row, not by editing the past (CLAUDE.md section 2's rule one level down).
create table if not exists public.asset_disposals (
  id text primary key,
  asset_id text not null references public.assets(id),
  quantity int not null,
  disposed_date date not null,
  reason text,
  created_by_id text,
  created_by_name text,
  created_at timestamptz not null default now()
);
