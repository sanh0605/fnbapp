-- 2026-08-25: outlets, the thin slice of ARCH-1
-- (docs/superpowers/specs/2026-07-28-multi-outlet-design.md), scoped per
-- docs/superpowers/plans/2026-08-24-outlets-and-order-code.md section 3.
--
-- Schema only. Backfilling orders_v2.outlet_id and renaming order_no are
-- real-data writes on 2.355 existing rows -- per CLAUDE.md section 2 and
-- the fnbapp-bulk-data-change skill, those go through a dry-run-by-default
-- script (scripts/backfill-outlet-and-rename-orders.ts), never a bare
-- migration UPDATE. This migration is safe to apply at any time on its
-- own: it creates one new table and two NULLABLE columns, changing no
-- existing order's order_no and no minting behaviour.
--
-- Sequencing, load-bearing, do not apply out of order:
--   1. THIS migration (0071).
--   2. scripts/backfill-outlet-and-rename-orders.ts --apply (owner approval,
--      separate from this migration's own approval).
--   3. Migration 0072 -- tightens outlet_id to NOT NULL, swaps the unique
--      index to (order_no) alone, and replaces order-number minting with
--      the outlet+date-keyed scheme. Applying 0072 before step 2 has run
--      breaks minting immediately (new codes would collide with old-format
--      codes still sitting in the column) and the NOT NULL would refuse
--      2.355 rows with no value yet.

-- 3.1: one row per physical location. code is the plan's own instruction,
-- verbatim: "Điểm bán 4: 004 (không thay thế vào lại điểm bán đã ngừng
-- hoạt động)" -- assigned from max(code) + 1, never a freed gap. Retiring
-- an outlet sets status/end_date; it never deletes and never releases the
-- number (CLAUDE.md section 2's rule one level down, same reasoning as
-- Batch 3's asset_depreciation_bands: nothing depends on a retired
-- outlet's row continuing to exist for any FK, but the CODE itself must
-- never be reused, unlike the row).
create table if not exists public.outlets (
  id text primary key,
  code text not null unique,
  name text not null unique,
  brand_id text not null references public.brands(id),
  address text not null default '',
  status text not null default 'ACTIVE',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_outlets_touch
  before update on public.outlets
  for each row execute function touch_updated_at();

-- Seed 001/002, linked to the two existing brands -- section 3.1's
-- instruction. Placeholder names ("Điểm bán 1"/"Điểm bán 2"); name is
-- editable, only code is frozen, so a placeholder costs nothing.
insert into public.outlets (id, code, name, brand_id, status) values
  ('OUT-001', '001', 'Điểm bán 1', 'BR-001', 'ACTIVE'),
  ('OUT-002', '002', 'Điểm bán 2', 'BR-002', 'ACTIVE')
on conflict (id) do nothing;

-- 3.2: orders_v2 gains two columns. Both nullable here -- see the
-- sequencing note above for why NOT NULL waits for migration 0072.
alter table public.orders_v2
  add column if not exists outlet_id text references public.outlets(id),
  add column if not exists legacy_order_no text;
