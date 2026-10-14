-- supabase/migrations/0109_dashboard_settings.sql
-- New Tổng quan: product types, monthly expense items, dashboard settings.
-- Spec: docs/superpowers/specs/2026-10-14-tong-quan-moi-design.md
-- Plan: docs/superpowers/plans/2026-10-14-tong-quan-moi.md (Task 1).
--
-- Additive only: new tables and new columns, no function changed, nothing
-- dropped. The code that reads the new tables lands after this file runs.
--
-- Triggers (read from migration text, not queried live; found by grepping every create trigger):
-- product_categories: no trigger exists. 0001 attaches touch_updated_at to a fixed
--   list of tables that does not include it, and no later migration adds one.
--   The backfill below therefore fires nothing.
-- cash_entries: only trg_cash_entries_touch (0101, BEFORE UPDATE, row level, runs
--   touch_updated_at()). ADD COLUMN of a nullable column fires no row trigger,
--   so updated_at does not move on existing ledger rows.
--
-- product_categories.type_id keeps default 'PT-001' on purpose: the existing
-- "create category" server action does not send type_id until plan Task 5
-- lands, and NOT NULL without a default would make every insert fail. Task 5
-- makes the field required in code and a later migration drops the default.

-- 1. Product types (Thức uống / Thức ăn / Topping). Hard delete is enough: the
-- RESTRICT foreign key below refuses to delete a type that still has categories.
create table if not exists public.product_types (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  is_drink boolean not null default false,
  created_at timestamptz not null default now()
);

-- Same normalising expression as idx_cash_categories_active_name (0101).
create unique index if not exists idx_product_types_name
  on public.product_types (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  );

insert into public.product_types (id, name, is_drink) values
  ('PT-001', 'Thức uống', true),
  ('PT-002', 'Thức ăn',   false),
  ('PT-003', 'Topping',   false)
on conflict (id) do nothing;

-- 2. Every product category gets a type.
alter table public.product_categories
  add column if not exists type_id text default 'PT-001'
  references public.product_types(id) on delete restrict;

-- CAT-003 is a DELETED category but its old order lines still count as drinks.
update public.product_categories set type_id = 'PT-001'
  where id in ('CAT-001', 'CAT-002', 'CAT-003', 'CAT-004', 'CAT-005');
update public.product_categories set type_id = 'PT-002' where id = 'CAT-006';
update public.product_categories set type_id = 'PT-003' where id = 'CAT-007';

do $$
begin
  if exists (select 1 from public.product_categories where type_id is null) then
    raise exception 'product_categories rows without type_id after backfill: %',
      (select string_agg(id, ', ') from public.product_categories where type_id is null);
  end if;
end $$;

alter table public.product_categories alter column type_id set not null;

-- 3. Monthly expense items (Tiền điện, Tiền nhà...).
create table if not exists public.monthly_expense_items (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  cash_category_id text not null references public.cash_categories(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  created_by_id text,
  created_by_name text,
  updated_at timestamptz not null default now(),
  updated_by_id text,
  updated_by_name text
);

-- Two live items may not share a name; retired ones keep theirs.
create unique index if not exists idx_monthly_expense_items_active_name
  on public.monthly_expense_items (
    lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
  )
  where status = 'ACTIVE';

-- 4. A ledger row can say which monthly item it settles.
alter table public.cash_entries
  add column if not exists monthly_item_id text
  references public.monthly_expense_items(id) on delete restrict;

create index if not exists idx_cash_entries_monthly_item on public.cash_entries(monthly_item_id);

-- 5. Dashboard settings: exactly one row, id = 1.
create table if not exists public.dashboard_settings (
  id int primary key check (id = 1),
  stale_stocktake_days int not null default 30 check (stale_stocktake_days between 1 and 365),
  open_stocktake_days int not null default 2 check (open_stocktake_days between 1 and 365),
  reminder_start_day int not null default 25 check (reminder_start_day between 1 and 28),
  food_product_ids text[] not null default '{PROD-028,PROD-027}',
  topping_type_id text default 'PT-003' references public.product_types(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by_id text,
  updated_by_name text
);

insert into public.dashboard_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists trg_monthly_expense_items_touch on public.monthly_expense_items;
create trigger trg_monthly_expense_items_touch before update on public.monthly_expense_items
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_dashboard_settings_touch on public.dashboard_settings;
create trigger trg_dashboard_settings_touch before update on public.dashboard_settings
  for each row execute function public.touch_updated_at();

alter table public.product_types enable row level security;
revoke all on table public.product_types from public, anon, authenticated;
grant select, insert, update, delete on table public.product_types to service_role;

alter table public.monthly_expense_items enable row level security;
revoke all on table public.monthly_expense_items from public, anon, authenticated;
grant select, insert, update, delete on table public.monthly_expense_items to service_role;

alter table public.dashboard_settings enable row level security;
revoke all on table public.dashboard_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.dashboard_settings to service_role;
