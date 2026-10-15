-- Dish-group icon becomes data the owner edits (spec R4), replacing the keyword table in lib/pos/pos-category-icons.ts.
-- Nullable: blank = no icon on the till card.
-- Backfill writes 3 rows so the till looks the same after the push: CAT-001 Cà phê, CAT-004 Trà, CAT-005 Yogurt.
-- The fallback cups on Giải trí, Thức ăn and Topping are not carried over. Never overwrites an icon already set.
-- Runs BEFORE the push (approved separately): the new dish-group form writes icon, so saving a group fails until the column exists.
alter table public.product_categories add column icon text;
update public.product_categories set icon = '☕' where id = 'CAT-001' and icon is null;
update public.product_categories set icon = '🍵' where id = 'CAT-004' and icon is null;
update public.product_categories set icon = '🥛' where id = 'CAT-005' and icon is null;
