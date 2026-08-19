-- Batch 1, item A (docs/superpowers/plans/2026-08-19-batch-1-foundations.md
-- section A). One partial unique expression index per catalogue table,
-- scoped to status = 'ACTIVE' -- a retired row's name becomes reusable
-- (CLAUDE.md section 2: mark-inactive, never delete).
--
-- Scoped PER TABLE, never across tables (section A1). Pooling all 226 names
-- across the seven tables finds 16 collisions; within a single table, 3.
-- The other 13 are legitimate -- a purchased item and the ingredient it
-- becomes share a name on purpose (e.g. SPM-005 / ING-001, both "Da vien").
-- One index per table keeps the uniqueness domain correctly separate.
--
-- Every function in the expression below (normalize, replace, chr, btrim,
-- regexp_replace, lower) was confirmed IMMUTABLE in this database
-- (PostgreSQL 17.6, pg_proc.provolatile = 'i' for all six) before writing
-- this file, and the expression itself was proven to build as an index
-- against real purchased_items data in a rolled-back transaction. Do not
-- drop a step to work around a build failure -- if any function is not
-- IMMUTABLE, CREATE INDEX fails loudly and that failure must be reported,
-- not silently worked around.
--
-- Diacritics are deliberately NOT stripped (section 9.2): "ca" and "ca"
-- with a grave accent are both real, different words.

create unique index if not exists ux_purchased_items_active_name
  on public.purchased_items (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  )
  where status = 'ACTIVE';

create unique index if not exists ux_base_ingredients_active_name
  on public.base_ingredients (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  )
  where status = 'ACTIVE';

create unique index if not exists ux_semi_products_active_name
  on public.semi_products (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  )
  where status = 'ACTIVE';

create unique index if not exists ux_products_active_name
  on public.products (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  )
  where status = 'ACTIVE';

create unique index if not exists ux_item_categories_active_name
  on public.item_categories (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  )
  where status = 'ACTIVE';

create unique index if not exists ux_units_active_name
  on public.units (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  )
  where status = 'ACTIVE';

create unique index if not exists ux_suppliers_active_name
  on public.suppliers (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  )
  where status = 'ACTIVE';
