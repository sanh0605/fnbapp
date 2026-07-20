-- Track backdated recipe version changes (semi-product recipe rows entered
-- with a start_date/created_at that claims to be earlier than when the row
-- was actually inserted). Mirrors 0014_backdated_ledger_detection.sql's
-- design for stock_ledger PO receipts, applied to the recipes table
-- instead: an admin editing a semi-product recipe can supply a past
-- "effective date" (app/admin/semi-products/actions.ts's
-- saveSemiProduct), which becomes the new Recipes row's created_at
-- directly -- the same backdating pattern, just on a different table.

create table if not exists public.backdated_recipe_events (
  id uuid primary key default gen_random_uuid(),
  recipe_id text not null,
  target_type text not null,
  target_id text not null,
  effective_timestamp timestamptz not null,
  visibility_timestamp timestamptz not null default now(),
  detected_at timestamptz not null default now(),
  status text not null default 'PENDING',
  is_anomalous boolean not null default false,
  anomaly_reason text,
  reviewed_by text,
  reviewed_at timestamptz,
  recompute_run_id text,
  notes text,
  constraint backdated_recipe_events_status_chk check (
    status in ('PENDING', 'RECOMPUTED', 'REJECTED')
  )
);

create index if not exists backdated_recipe_events_status_detected_at_idx
  on public.backdated_recipe_events (status, detected_at desc);
create index if not exists backdated_recipe_events_target_idx
  on public.backdated_recipe_events (target_type, target_id);
create unique index if not exists backdated_recipe_events_recipe_id_idx
  on public.backdated_recipe_events (recipe_id);

alter table public.backdated_recipe_events enable row level security;
revoke all on table public.backdated_recipe_events from public;
revoke all on table public.backdated_recipe_events from anon;
revoke all on table public.backdated_recipe_events from authenticated;
grant select, insert, update on table public.backdated_recipe_events to service_role;

create or replace function public.flag_backdated_recipe_entry()
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

  -- Five minutes allows normal transaction latency without suppressing
  -- intentional operator backdating (same threshold as
  -- flag_backdated_ledger_entry for stock_ledger).
  if new.created_at < now() - interval '5 minutes' then
    insert into public.backdated_recipe_events (
      recipe_id,
      target_type,
      target_id,
      effective_timestamp,
      visibility_timestamp
    ) values (
      new.id,
      new.target_type,
      new.target_id,
      new.created_at,
      now()
    )
    on conflict (recipe_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.flag_backdated_recipe_entry() from public;
revoke all on function public.flag_backdated_recipe_entry() from anon;
revoke all on function public.flag_backdated_recipe_entry() from authenticated;

drop trigger if exists detect_backdated_recipe_entry
  on public.recipes;

create trigger detect_backdated_recipe_entry
after insert on public.recipes
for each row
execute function public.flag_backdated_recipe_entry();
