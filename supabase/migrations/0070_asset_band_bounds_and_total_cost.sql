-- 2026-08-23: half-open band bounds, and an exact cost basis for the asset
-- register. docs/superpowers/plans/2026-08-23-band-bounds-and-crud.md.

-- Section 1: min_unit_price stays inclusive; max_unit_price becomes
-- EXCLUSIVE (null still means unbounded). Owner's form, adopted exactly:
-- x < 200.000 -> 12mo, 200.000 <= x < 500.000 -> 24mo, 500.000 <= x -> 36mo.
-- Only KH-001 and KH-003 actually change value -- KH-002's stored numbers
-- (200000, 500000) are already correct under the new interpretation,
-- updated anyway for symmetry and to make the migration robust to a
-- production value that might not match what this comment assumes.
-- Verified 2026-08-23, immediately before writing this migration: assets
-- and asset_disposals are both empty (0 rows each), so this moves no
-- asset's already-computed, already-frozen term.
update public.asset_depreciation_bands set max_unit_price = 200000 where id = 'KH-001';
update public.asset_depreciation_bands set min_unit_price = 200000, max_unit_price = 500000 where id = 'KH-002';
update public.asset_depreciation_bands set min_unit_price = 500000, max_unit_price = null where id = 'KH-003';

-- Section 3: the allocated line total, unrounded by division -- the
-- depreciation schedule's real basis, not quantity * unit_cost (multiplying
-- a rounded per-unit price back up does not reproduce what was paid;
-- measured 11 of the owner's 72 real equipment items drift, up to +48d on
-- one line). No default: the table is empty (verified above, and its one
-- trigger, trg_assets_touch, is BEFORE UPDATE and does not fire on this
-- ADD COLUMN), and the only write path
-- (app/admin/inventory/purchase-orders/actions.ts) is updated in this same
-- commit to always supply it.
alter table public.assets add column if not exists total_cost bigint not null;
