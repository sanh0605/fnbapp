-- supabase/migrations/0125_drop_deleted_status.sql
-- Plan 2026-10-15-bo-deleted: a master row is ACTIVE or INACTIVE; a row never used is erased,
-- not hidden. NOT YET RUN on the server; the owner approves running it separately, and only
-- AFTER (1) scripts/retire-deleted-leftovers.ts --apply and (2) the code push. Run before the
-- push, "Xoá" on an option and on a dish group would still write DELETED and be refused.
--
-- Measured on the server 2026-10-15 just before writing (rows / DELETED / other value):
--   brands 2/0/0, item_categories 3/0/0, modifiers 10/1/0 (MOD-007, retired by the script),
--   product_categories 6/0/0, products 45/0/0, promotions 2/0/0, purchase_sources 3/0/0,
--   purchased_items 151/0/0, suppliers 48/0/0, units 24/0/0, uom_conversions 180/0/0, users 2/0/0.
-- The live definition of all 13 *_status_check constraints was read from pg_constraint: every one
-- is exactly status in ('ACTIVE','INACTIVE','DELETED'); users has no extra value.
--
-- NOT touched: product_variants_status_check. The live save_product_atomic (0119, the last
-- create or replace) still runs `set status = 'DELETED'` on a size removed from a dish, and
-- set_product_status_atomic (0114) relies on a DELETED size never coming back. Dropping DELETED
-- there would make removing a size fail. It needs its own decision (erase unsold sizes, or stop
-- them as INACTIVE) and a new save_product_atomic first.
--
-- Other functions that mention DELETED, read from the server 2026-10-15: erase_never_sold_product_atomic
-- and cancel_stocktake_session_atomic. Neither writes a DELETED status to these tables (the second
-- only returns the word in its result JSON), so both stay as they are.
--
-- Writer inventory (skill fnbapp-bulk-data-change, section 6): the code writers of 'DELETED' were
-- deleteModifierAction and softDeleteEntity (deleteCategory); both now erase for good. No script writes it.
--
-- Triggers: adding a CHECK updates no row and fires no row trigger. The tables carry only
-- BEFORE UPDATE touch_updated_at triggers (queried on modifiers and units 2026-10-15; the other ten
-- are inferred from the migration text, not queried).

alter table public.brands drop constraint brands_status_check,
  add constraint brands_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.item_categories drop constraint item_categories_status_check,
  add constraint item_categories_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.modifiers drop constraint modifiers_status_check,
  add constraint modifiers_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.product_categories drop constraint product_categories_status_check,
  add constraint product_categories_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.products drop constraint products_status_check,
  add constraint products_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.promotions drop constraint promotions_status_check,
  add constraint promotions_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.purchase_sources drop constraint purchase_sources_status_check,
  add constraint purchase_sources_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.purchased_items drop constraint purchased_items_status_check,
  add constraint purchased_items_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.suppliers drop constraint suppliers_status_check,
  add constraint suppliers_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.units drop constraint units_status_check,
  add constraint units_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.uom_conversions drop constraint uom_conversions_status_check,
  add constraint uom_conversions_status_check check (status in ('ACTIVE', 'INACTIVE'));
alter table public.users drop constraint users_status_check,
  add constraint users_status_check check (status in ('ACTIVE', 'INACTIVE'));
