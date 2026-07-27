-- PERF-2 Phase B: materialize current inventory balances so stock reads
-- stop replaying the full Stock_Ledger history on every request.
-- stock_ledger remains the sole quantity source of truth; this table is
-- derived state only, kept in sync in the same transaction as every ledger
-- write via a trigger (covers atomic RPCs, void/edit reversal, stocktake,
-- and full-history rebuild/recovery tooling alike).

create table if not exists public.inventory_balances (
  item_reference text primary key,
  quantity numeric(18,6) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.inventory_balances enable row level security;
revoke all on table public.inventory_balances from public, anon, authenticated;
grant select on table public.inventory_balances to service_role;

create or replace function public.stock_ledger_apply_inventory_balance_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if nullif(btrim(coalesce(new.item_reference, '')), '') is not null then
      insert into public.inventory_balances (item_reference, quantity, updated_at)
      values (new.item_reference, new.quantity_change, now())
      on conflict (item_reference) do update
      set quantity = public.inventory_balances.quantity + excluded.quantity,
          updated_at = now();
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if nullif(btrim(coalesce(old.item_reference, '')), '') is not null then
      insert into public.inventory_balances (item_reference, quantity, updated_at)
      values (old.item_reference, -old.quantity_change, now())
      on conflict (item_reference) do update
      set quantity = public.inventory_balances.quantity + excluded.quantity,
          updated_at = now();
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if nullif(btrim(coalesce(old.item_reference, '')), '') is not null then
      insert into public.inventory_balances (item_reference, quantity, updated_at)
      values (old.item_reference, -old.quantity_change, now())
      on conflict (item_reference) do update
      set quantity = public.inventory_balances.quantity + excluded.quantity,
          updated_at = now();
    end if;
    if nullif(btrim(coalesce(new.item_reference, '')), '') is not null then
      insert into public.inventory_balances (item_reference, quantity, updated_at)
      values (new.item_reference, new.quantity_change, now())
      on conflict (item_reference) do update
      set quantity = public.inventory_balances.quantity + excluded.quantity,
          updated_at = now();
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_stock_ledger_inventory_balances on public.stock_ledger;
create trigger trg_stock_ledger_inventory_balances
after insert or delete or update of item_reference, quantity_change
on public.stock_ledger
for each row execute function public.stock_ledger_apply_inventory_balance_delta();

-- Backfill from existing history so the table is correct the moment the
-- trigger goes live; every ledger row already committed is summed once here,
-- every row committed after this point is covered by the trigger above.
insert into public.inventory_balances (item_reference, quantity, updated_at)
select item_reference, sum(quantity_change), now()
from public.stock_ledger
where nullif(btrim(item_reference), '') is not null
group by item_reference
on conflict (item_reference) do update
set quantity = excluded.quantity, updated_at = excluded.updated_at;

-- Manual recovery only: no normal operation calls this. Full-history
-- rebuild/recovery scripts that delete and reinsert stock_ledger rows are
-- already kept correct by the trigger; this is a from-scratch reaggregation
-- for use only if the derived table is ever suspected to have drifted.
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
  insert into public.inventory_balances (item_reference, quantity, updated_at)
  select item_reference, sum(quantity_change), now()
  from public.stock_ledger
  where nullif(btrim(item_reference), '') is not null
  group by item_reference;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.rebuild_inventory_balances() from public, anon, authenticated;
grant execute on function public.rebuild_inventory_balances() to service_role;
