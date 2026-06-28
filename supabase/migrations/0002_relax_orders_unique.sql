-- Claude code — Supabase migration Phase C fix.
--
-- 0001 schema added UNIQUE (brand_id, order_no) to orders_v2 to fix
-- CODE-11 race condition. But superseded orders share the same order_no
-- across version chain (parent_order_id → superseded_by), so the unique
-- constraint blocks migration of historical superseded rows.
--
-- Fix: drop the full unique, replace with partial unique that only applies
-- to active orders (status = COMPLETED and not superseded). This still
-- prevents duplicate active orders while allowing version chain.

alter table public.orders_v2
  drop constraint if exists orders_v2_brand_id_order_no_key;

-- Partial unique: only enforce for active orders.
create unique index if not exists orders_v2_brand_order_no_active
  on public.orders_v2 (brand_id, order_no)
  where status = 'COMPLETED' and (superseded_by is null or superseded_by = '');
