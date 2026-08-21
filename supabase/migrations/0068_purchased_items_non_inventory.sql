-- 2026-08-21: is_non_inventory already exists on base_ingredients
-- (BR-COGS-007), but a CONSUMABLE purchased item has no base_ingredient_id,
-- so there is nowhere to put the flag for one. Same name and meaning as
-- base_ingredients.is_non_inventory -- one concept, one name.
-- docs/superpowers/plans/2026-08-21-non-inventory-purchased-items.md.
--
-- Only trigger on this table (checked before writing this migration):
-- trg_purchased_items_touch, BEFORE UPDATE, calls touch_updated_at(). An
-- ADD COLUMN ... DEFAULT is a metadata-only change in Postgres (11+) -- it
-- does not perform a per-row UPDATE and does not fire this trigger, so no
-- existing row's updated_at moves. Verified directly inside a rolled-back
-- transaction before this migration was written.
alter table public.purchased_items
  add column if not exists is_non_inventory boolean not null default false;
