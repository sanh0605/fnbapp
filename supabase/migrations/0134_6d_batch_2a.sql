-- supabase/migrations/0134_6d_batch_2a.sql
-- 6d database audit, batch 2a (plan docs/superpowers/plans/2026-10-16-6d-csdl.md, section
-- "Đợt 2, sửa sau khi đo lại"). NOT YET RUN on the server; the owner approves running it
-- separately from the push, outside selling hours (a UNIQUE builds an index and briefly blocks
-- writes to order_lines_v2).
--
-- Order: migration-first is safe. No function changes, so code that does not know this file keeps
-- working. The restore code in lib/db/backup-restore.ts must ship in the same push: it inserts a
-- SUPERSEDED order as COMPLETED and flips it afterwards, which the status rule below requires.
--
-- What it does: only adds validated constraints, no function redefined, no table, column or
-- function dropped.
--   orders_v2:      the 5 money columns >= 0; net_total = gross - promo - manual item - manual order
--                   discount (exact); status/link rule (COMPLETED has no superseded_by and no
--                   voided_at; SUPERSEDED has superseded_by and no voided_at; VOIDED has voided_at
--                   and no superseded_by).
--   order_lines_v2: the 6 money columns >= 0; net_line_total = gross - promo - manual item - order
--                   discount allocation (exact); UNIQUE (order_id, line_no).
--   qty > 0 already exists (order_lines_v2_qty_check) and is not added again.
--
-- Violations measured on the server 2026-10-17: 0 of 3,535 orders and 0 of 4,914 order lines for
-- every constraint (status: COMPLETED 3,473, SUPERSEDED 24, VOIDED 38, none breaking the rule).
-- All 11 money columns are bigint not null.
--
-- Writer inventory (skill fnbapp-bulk-data-change, section 6):
--   create_pos_order_atomic_unvalidated_0025 (0127:67): inserts orders and lines with totals the
--     server recomputes from the cart; status COMPLETED, no links; the till's assertOrderInvariants
--     already refuses negative money and net mismatches before the call.
--   supersede_order_v2_atomic (0127:354): inserts the new COMPLETED version, then one UPDATE sets the
--     old order to SUPERSEDED with superseded_by in the same statement (0127:441); it requires the
--     old order to be COMPLETED, so voided_at is null.
--   void_order_atomic (0121:545): one UPDATE sets VOIDED with voided_at (0121:638); it requires the
--     order to be COMPLETED, so superseded_by is null.
--   lib/db/backup-restore.ts: inserted SUPERSEDED orders as COMPLETED with superseded_by null and
--     set status and superseded_by together in one UPDATE (changed in the same commit).
--   Every other writer found by grep over supabase/migrations (0008-0011, 0015, 0026, 0029-0031, 0034,
--     0042, 0046 and others) sits in a function dropped in 0054, 0077 or 0105 (checked in those files),
--     or is a one-off statement that already ran (the empty-text-to-null update at 0121:658).
--     scripts/restore-order-seller-promo.ts updates only the seller and promotion columns.
--
-- Triggers on the touched tables (queried from the server 2026-10-17, pg_trigger): exactly one,
-- trg_orders_v2_touch BEFORE UPDATE ON orders_v2 (touch_updated_at(), sets updated_at); order_lines_v2
-- has none. This file updates no row, and a CHECK or UNIQUE never
-- fires a trigger, so none is affected.

set lock_timeout = '3s';

alter table public.orders_v2 drop constraint if exists orders_v2_money_not_negative;
alter table public.orders_v2 add constraint orders_v2_money_not_negative
  check (gross_total >= 0 and promo_discount_total >= 0 and manual_item_discount_total >= 0
    and manual_order_discount >= 0 and net_total >= 0);

alter table public.orders_v2 drop constraint if exists orders_v2_net_total_formula;
alter table public.orders_v2 add constraint orders_v2_net_total_formula
  check (net_total = gross_total - promo_discount_total - manual_item_discount_total - manual_order_discount);

alter table public.orders_v2 drop constraint if exists orders_v2_status_links;
alter table public.orders_v2 add constraint orders_v2_status_links
  check ((status = 'COMPLETED' and superseded_by is null and voided_at is null)
    or (status = 'SUPERSEDED' and superseded_by is not null and voided_at is null)
    or (status = 'VOIDED' and voided_at is not null and superseded_by is null));

alter table public.order_lines_v2 drop constraint if exists order_lines_v2_money_not_negative;
alter table public.order_lines_v2 add constraint order_lines_v2_money_not_negative
  check (unit_price >= 0 and gross_line_total >= 0 and promo_discount >= 0 and manual_item_discount >= 0
    and order_discount_allocation >= 0 and net_line_total >= 0);

alter table public.order_lines_v2 drop constraint if exists order_lines_v2_net_line_total_formula;
alter table public.order_lines_v2 add constraint order_lines_v2_net_line_total_formula
  check (net_line_total = gross_line_total - promo_discount - manual_item_discount - order_discount_allocation);

alter table public.order_lines_v2 drop constraint if exists order_lines_v2_order_id_line_no_key;
alter table public.order_lines_v2 add constraint order_lines_v2_order_id_line_no_key unique (order_id, line_no);

reset lock_timeout;
