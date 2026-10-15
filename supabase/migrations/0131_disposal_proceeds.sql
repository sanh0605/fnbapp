-- supabase/migrations/0131_disposal_proceeds.sql
-- BR-COGS-008 (owner 2026-10-08): a disposal records the money it brought in, as one
-- income row in the cash book linked back to the disposal. Plan:
-- docs/superpowers/plans/2026-10-16-thanh-ly-thu-tien.md. NOT YET RUN on the server;
-- the owner approves running it separately, before the code that calls the function.
--
-- Additive only: two columns, three constraints, one index, one function, one category
-- row. No return type of an existing function changes; code without it keeps working.
--
-- Triggers on the touched tables (derived from migration text, not read from the live
-- catalog: grepped every `create trigger` / `drop trigger` in supabase/migrations,
-- 2026-10-16):
--   trg_cash_entries_touch    (0101) BEFORE UPDATE on cash_entries, sets updated_at only.
--   trg_cash_categories_touch (0101) BEFORE UPDATE on cash_categories, sets updated_at only.
--   asset_disposals_guard     (0123) BEFORE INSERT on asset_disposals: refuses an INACTIVE
--     asset or a quantity past what is left, with the asset row locked. dispose_asset_atomic
--     inserts into that table, so it fires inside the function and its message passes through.
-- This migration updates no row, so the two touch triggers never fire; the one insert
-- into cash_categories below is not an update.
--
-- Measured on the server 2026-10-16: cash_categories holds CFC-001..CFC-007, so the next
-- free id is CFC-008; no category is named "Thu thanh lý tài sản". The two old disposals
-- (02/07/2026) were 0d, so no proceeds row is created for them.

alter table public.cash_categories
  add column if not exists is_asset_disposal boolean not null default false;

alter table public.cash_categories
  drop constraint if exists cash_categories_asset_disposal_is_pnl_income;
alter table public.cash_categories
  add constraint cash_categories_asset_disposal_is_pnl_income
  check (not is_asset_disposal or (kind = 'INCOME' and affects_pnl));

alter table public.cash_categories
  drop constraint if exists cash_categories_asset_disposal_not_sales_revenue;
alter table public.cash_categories
  add constraint cash_categories_asset_disposal_not_sales_revenue
  check (not (is_sales_revenue and is_asset_disposal));

-- At most one flagged group: the code finds it by the flag, never by name or id.
create unique index if not exists idx_cash_categories_asset_disposal
  on public.cash_categories (is_asset_disposal)
  where is_asset_disposal;

-- unique: one disposal has at most one proceeds row; none means 0d.
alter table public.cash_entries
  add column if not exists asset_disposal_id text
  unique references public.asset_disposals(id) on delete restrict;

-- Skipped when an ACTIVE group already has this name (active names are unique, 0101);
-- then dispose_asset_atomic refuses a disposal with money until the owner flags a group.
insert into public.cash_categories
  (id, name, kind, affects_pnl, is_asset_disposal, created_by_id, created_by_name, updated_by_id, updated_by_name)
select 'CFC-008', 'Thu thanh lý tài sản', 'INCOME', true, true, 'system', 'Hệ thống', 'system', 'Hệ thống'
where not exists (
  select 1 from public.cash_categories
  where status = 'ACTIVE' and lower(btrim(name)) = lower('Thu thanh lý tài sản')
)
on conflict (id) do nothing;

-- Writes the disposal and, when p_amount > 0, its proceeds row in one transaction.
-- The ids are minted by the caller (generateNewId); the caller has already run
-- parseCashEntry on the proceeds row. The group and bank account are checked here too,
-- as in the cash-book actions.
create or replace function public.dispose_asset_atomic(
  p_disposal_id text,
  p_asset_id text,
  p_quantity integer,
  p_disposed_date date,
  p_reason text,
  p_actor_id text,
  p_actor_name text,
  p_amount bigint,
  p_entry_id text,
  p_payment_method text,
  p_bank_account_id text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_category_id text;
  v_category_status text;
  v_account_status text;
begin
  if p_amount > 0 then
    select id, status into v_category_id, v_category_status
    from public.cash_categories where is_asset_disposal;
    if v_category_id is null then
      raise exception 'Chưa có nhóm thu thanh lý tài sản';
    end if;
    if v_category_status <> 'ACTIVE' then
      raise exception 'Nhóm thu thanh lý tài sản đã ngừng dùng';
    end if;
    if p_bank_account_id is not null then
      select status into v_account_status from public.bank_accounts where id = p_bank_account_id;
      if v_account_status is distinct from 'ACTIVE' then
        raise exception 'Tài khoản không còn dùng';
      end if;
    end if;
  end if;

  insert into public.asset_disposals (id, asset_id, quantity, disposed_date, reason, created_by_id, created_by_name)
  values (p_disposal_id, p_asset_id, p_quantity, p_disposed_date, p_reason, p_actor_id, p_actor_name);

  if p_amount > 0 then
    insert into public.cash_entries
      (id, entry_date, category_id, amount, payment_method, bank_account_id, note, status,
       asset_disposal_id, created_by_id, created_by_name, updated_by_id, updated_by_name)
    values
      (p_entry_id, p_disposed_date, v_category_id, p_amount, p_payment_method, p_bank_account_id, p_note, 'ACTIVE',
       p_disposal_id, p_actor_id, p_actor_name, p_actor_id, p_actor_name);
  end if;
end;
$$;

revoke all on function public.dispose_asset_atomic(text, text, integer, date, text, text, text, bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.dispose_asset_atomic(text, text, integer, date, text, text, text, bigint, text, text, text, text) to service_role;

-- A skipped seed (name collision) must fail the migration, not leave disposals with money refused.
do $$
begin
  if not exists (select 1 from public.cash_categories where is_asset_disposal) then
    raise exception 'Không tạo được nhóm Thu thanh lý tài sản: đã có nhóm đang dùng trùng tên. Đổi tên nhóm đó rồi chạy lại.';
  end if;
end
$$;
