-- Track backdated inventory-increasing stock ledger entries for admin review.
-- Backdated means the effective ledger timestamp is more than five minutes
-- before the real insert time observed by the database trigger.

create table if not exists public.backdated_ledger_events (
  id uuid primary key default gen_random_uuid(),
  stock_ledger_id text not null,
  detected_at timestamptz not null default now(),
  effective_timestamp timestamptz not null,
  visibility_timestamp timestamptz not null default now(),
  source_table text not null,
  source_id text,
  item_reference text not null,
  quantity_change numeric(18,6),
  unit_cost bigint,
  status text not null default 'PENDING',
  reviewed_by text,
  reviewed_at timestamptz,
  recompute_run_id text,
  notes text,
  constraint backdated_ledger_events_status_chk check (
    status in ('PENDING', 'APPROVED', 'RECOMPUTED', 'REJECTED')
  )
);

create index if not exists backdated_ledger_events_status_detected_at_idx
  on public.backdated_ledger_events (status, detected_at desc);
create index if not exists backdated_ledger_events_item_reference_idx
  on public.backdated_ledger_events (item_reference);
create unique index if not exists backdated_ledger_events_stock_ledger_id_idx
  on public.backdated_ledger_events (stock_ledger_id);

alter table public.backdated_ledger_events enable row level security;
revoke all on table public.backdated_ledger_events from public;
revoke all on table public.backdated_ledger_events from anon;
revoke all on table public.backdated_ledger_events from authenticated;
grant select, insert, update on table public.backdated_ledger_events to service_role;

create or replace function public.flag_backdated_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip during recovery because replay writes old timestamps intentionally.
  if current_setting('app.mac_drift_recovery', true) = 'on' then
    return new;
  end if;

  -- Sales consume rows are never intentional receipt backdates from the app.
  if new.transaction_type not in ('PO_RECEIPT', 'STOCK_ADJUST', 'PRODUCTION_YIELD', 'INITIAL_BALANCE') then
    return new;
  end if;

  -- Five minutes allows normal transaction latency without suppressing
  -- intentional operator backdating.
  if new.created_at < now() - interval '5 minutes' then
    insert into public.backdated_ledger_events (
      stock_ledger_id,
      effective_timestamp,
      visibility_timestamp,
      source_table,
      source_id,
      item_reference,
      quantity_change,
      unit_cost
    ) values (
      new.id,
      new.created_at,
      now(),
      coalesce(nullif(new.source, ''), 'stock_ledger'),
      new.reference_id,
      new.item_reference,
      new.quantity_change,
      new.unit_cost::bigint
    )
    on conflict (stock_ledger_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.flag_backdated_ledger_entry() from public;
revoke all on function public.flag_backdated_ledger_entry() from anon;
revoke all on function public.flag_backdated_ledger_entry() from authenticated;

drop trigger if exists detect_backdated_ledger_entry
  on public.stock_ledger;

create trigger detect_backdated_ledger_entry
after insert on public.stock_ledger
for each row
execute function public.flag_backdated_ledger_entry();
