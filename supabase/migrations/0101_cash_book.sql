-- supabase/migrations/0101_cash_book.sql
-- Cash book: the money in and out that the app does not already record.
-- Sales, purchases, COGS and depreciation stay where they are -- see
-- docs/superpowers/specs/2026-09-08-so-thu-chi-design.md.

create table if not exists public.cash_categories (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  -- The side of the ledger lives here and nowhere else, so an entry can
  -- never disagree with its own category.
  kind text not null check (kind in ('EXPENSE','INCOME')),
  -- Capital contributions are money in that the shop did not earn.
  affects_pnl boolean not null default true,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  created_by_id text,
  created_by_name text,
  updated_at timestamptz not null default now(),
  updated_by_id text,
  updated_by_name text
);

-- Two live categories may not share a name; retired ones keep theirs.
create unique index if not exists idx_cash_categories_active_name
  on public.cash_categories (lower(trim(name))) where status = 'ACTIVE';

create table if not exists public.bank_accounts (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  bank_name text,
  account_number text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  created_by_id text,
  created_by_name text,
  updated_at timestamptz not null default now(),
  updated_by_id text,
  updated_by_name text
);

create unique index if not exists idx_bank_accounts_active_name
  on public.bank_accounts (lower(trim(name))) where status = 'ACTIVE';

create table if not exists public.cash_entries (
  id text primary key,
  entry_date date not null,
  category_id text not null references public.cash_categories(id) on delete restrict,
  amount bigint not null check (amount > 0),
  payment_method text not null default 'CASH'
    check (payment_method in ('CASH','BANK_TRANSFER')),
  bank_account_id text references public.bank_accounts(id) on delete restrict,
  -- Reserved: the owner asked to keep the column and leave it empty for now.
  payer text,
  note text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED')),
  created_at timestamptz not null default now(),
  created_by_id text,
  created_by_name text,
  updated_at timestamptz not null default now(),
  updated_by_id text,
  updated_by_name text,
  constraint cash_entries_bank_account_check check (
    (payment_method = 'BANK_TRANSFER' and bank_account_id is not null)
    or (payment_method = 'CASH' and bank_account_id is null)
  )
);

create index if not exists idx_cash_entries_entry_date on public.cash_entries(entry_date desc);
create index if not exists idx_cash_entries_category on public.cash_entries(category_id);

drop trigger if exists trg_cash_categories_touch on public.cash_categories;
create trigger trg_cash_categories_touch before update on public.cash_categories
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_bank_accounts_touch on public.bank_accounts;
create trigger trg_bank_accounts_touch before update on public.bank_accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_cash_entries_touch on public.cash_entries;
create trigger trg_cash_entries_touch before update on public.cash_entries
  for each row execute function public.touch_updated_at();

alter table public.cash_categories enable row level security;
revoke all on table public.cash_categories from public, anon, authenticated;
grant select, insert, update, delete on table public.cash_categories to service_role;

alter table public.bank_accounts enable row level security;
revoke all on table public.bank_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.bank_accounts to service_role;

alter table public.cash_entries enable row level security;
revoke all on table public.cash_entries from public, anon, authenticated;
grant select, insert, update, delete on table public.cash_entries to service_role;

-- The five categories the owner named on 2026-09-08. created_by is the
-- system, not a person -- nobody typed these.
insert into public.cash_categories
  (id, name, kind, affects_pnl, created_by_id, created_by_name, updated_by_id, updated_by_name)
values
  ('CFC-001', 'Vận hành',        'EXPENSE', true,  'system', 'Hệ thống', 'system', 'Hệ thống'),
  ('CFC-002', 'Điện, nước, gas', 'EXPENSE', true,  'system', 'Hệ thống', 'system', 'Hệ thống'),
  ('CFC-003', 'Marketing',       'EXPENSE', true,  'system', 'Hệ thống', 'system', 'Hệ thống'),
  ('CFC-004', 'Thu khác',        'INCOME',  true,  'system', 'Hệ thống', 'system', 'Hệ thống'),
  ('CFC-005', 'Vốn góp',         'INCOME',  false, 'system', 'Hệ thống', 'system', 'Hệ thống')
on conflict (id) do nothing;
