-- Batch 1 follow-up, 2026-08-20. Extends level 2 (0066's warning-not-refuse
-- rule for a diacritic-stripped-only name match, section A3b) to the four
-- catalogue tables where a near-duplicate causes real harm -- a silently
-- split stock/purchase history, the "next Sua yen mach" problem this whole
-- effort exists to prevent: purchased_items, semi_products, products,
-- suppliers.
--
-- units and item_categories deliberately excluded. Neither accumulates its
-- own stock or purchase history -- they are labels referenced by other
-- rows, not things bought, counted, or sold, so a near-duplicate there is
-- cosmetic confusion in a dropdown, not a split ledger. Both populations
-- are also small and do not grow under shelf-pressure (item_categories has
-- held exactly 3 rows since 2026-06-28; a new unit is a rare, deliberate,
-- admin-time event, not something typed quickly while unpacking a
-- delivery). Level 1 (exact-match refusal, migration 0065) already covers
-- both tables and is unaffected by this migration.

alter table public.purchased_items
  add column if not exists duplicate_warning_confirmed boolean not null default false,
  add column if not exists duplicate_warning_confirmed_by text,
  add column if not exists duplicate_warning_confirmed_at timestamptz;

alter table public.semi_products
  add column if not exists duplicate_warning_confirmed boolean not null default false,
  add column if not exists duplicate_warning_confirmed_by text,
  add column if not exists duplicate_warning_confirmed_at timestamptz;

alter table public.products
  add column if not exists duplicate_warning_confirmed boolean not null default false,
  add column if not exists duplicate_warning_confirmed_by text,
  add column if not exists duplicate_warning_confirmed_at timestamptz;

alter table public.suppliers
  add column if not exists duplicate_warning_confirmed boolean not null default false,
  add column if not exists duplicate_warning_confirmed_by text,
  add column if not exists duplicate_warning_confirmed_at timestamptz;
