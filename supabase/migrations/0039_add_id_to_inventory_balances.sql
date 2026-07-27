-- Hotfix for migration 0038: every table in this schema is read through
-- lib/sheets_db.ts's findAllNoCache/findAllWhere, which unconditionally
-- paginate with `.order("id").gt("id", lastId)`. inventory_balances was
-- created with item_reference as its primary key and no id column at all,
-- so every read of it (getRealtimeStock, getPOSStockStatus) fails with
-- "column inventory_balances.id does not exist" -- confirmed live in
-- production immediately after 0038 was applied. item_reference is already
-- unique and stays the natural key the trigger upserts on; id is added
-- alongside it (same value) purely to satisfy the shared pagination
-- contract, matching every other table's id-primary-key convention.

alter table public.inventory_balances add column if not exists id text;
update public.inventory_balances set id = item_reference where id is null;
alter table public.inventory_balances alter column id set not null;

alter table public.inventory_balances drop constraint if exists inventory_balances_pkey;
alter table public.inventory_balances add constraint inventory_balances_pkey primary key (id);
alter table public.inventory_balances add constraint inventory_balances_item_reference_key unique (item_reference);

create or replace function public.stock_ledger_apply_inventory_balance_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if nullif(btrim(coalesce(new.item_reference, '')), '') is not null then
      insert into public.inventory_balances (id, item_reference, quantity, updated_at)
      values (new.item_reference, new.item_reference, new.quantity_change, now())
      on conflict (item_reference) do update
      set quantity = public.inventory_balances.quantity + excluded.quantity,
          updated_at = now();
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if nullif(btrim(coalesce(old.item_reference, '')), '') is not null then
      insert into public.inventory_balances (id, item_reference, quantity, updated_at)
      values (old.item_reference, old.item_reference, -old.quantity_change, now())
      on conflict (item_reference) do update
      set quantity = public.inventory_balances.quantity + excluded.quantity,
          updated_at = now();
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if nullif(btrim(coalesce(old.item_reference, '')), '') is not null then
      insert into public.inventory_balances (id, item_reference, quantity, updated_at)
      values (old.item_reference, old.item_reference, -old.quantity_change, now())
      on conflict (item_reference) do update
      set quantity = public.inventory_balances.quantity + excluded.quantity,
          updated_at = now();
    end if;
    if nullif(btrim(coalesce(new.item_reference, '')), '') is not null then
      insert into public.inventory_balances (id, item_reference, quantity, updated_at)
      values (new.item_reference, new.item_reference, new.quantity_change, now())
      on conflict (item_reference) do update
      set quantity = public.inventory_balances.quantity + excluded.quantity,
          updated_at = now();
    end if;
    return new;
  end if;
  return null;
end;
$$;

create or replace function public.rebuild_inventory_balances()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('inventory_balances:rebuild'));
  truncate table public.inventory_balances;
  insert into public.inventory_balances (id, item_reference, quantity, updated_at)
  select item_reference, item_reference, sum(quantity_change), now()
  from public.stock_ledger
  where nullif(btrim(item_reference), '') is not null
  group by item_reference;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
