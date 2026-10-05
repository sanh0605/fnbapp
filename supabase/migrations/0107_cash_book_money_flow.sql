-- supabase/migrations/0107_cash_book_money_flow.sql
-- Cash book money flow: drawer <-> bank transfers, how a purchase order was
-- paid, and a read-only per-day view of sales and purchase money.
-- Spec: docs/superpowers/specs/2026-10-04-so-thu-chi-dong-tien-design.md
-- Plan: docs/superpowers/plans/2026-10-04-so-thu-chi-dong-tien.md (Task 1).
--
-- Triggers on purchase_orders (read from migration text, not queried live):
-- only trg_purchase_orders_touch (0001, BEFORE UPDATE, row level, runs
-- touch_updated_at()). ALTER TABLE ... ADD COLUMN with a default does not fire
-- row triggers, so updated_at does not move on the backfilled rows. No other
-- trigger is created or dropped on purchase_orders anywhere in migrations.
--
-- Deploy order: the code that sends payment_method / bank_account_id goes
-- first, this migration right after (each with its own owner approval). The
-- old save_purchase_order_atomic ignores the new fields, so saves keep working
-- in between; /admin/finance errors until this file is applied.

-- 1. Transfers between the cash drawer and a bank account.
create table public.cash_transfers (
  id text primary key,
  transfer_date date not null,
  amount bigint not null check (amount > 0),
  -- null = the cash drawer
  from_account_id text references public.bank_accounts(id) on delete restrict,
  to_account_id text references public.bank_accounts(id) on delete restrict,
  note text not null default '',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CANCELLED')),
  created_at timestamptz not null default now(),
  created_by_id text,
  created_by_name text,
  updated_at timestamptz not null default now(),
  updated_by_id text,
  updated_by_name text,
  constraint cash_transfers_two_ends check (from_account_id is distinct from to_account_id)
);

create index idx_cash_transfers_transfer_date on public.cash_transfers(transfer_date desc);

create trigger trg_cash_transfers_touch before update on public.cash_transfers
  for each row execute function public.touch_updated_at();

alter table public.cash_transfers enable row level security;
revoke all on table public.cash_transfers from public, anon, authenticated;
grant select, insert, update, delete on table public.cash_transfers to service_role;

-- 2. How a purchase order was paid.
alter table public.purchase_orders
  add column payment_method text default 'CASH',
  add column bank_account_id text references public.bank_accounts(id) on delete restrict;
-- The default only fills the rows that exist today (198 completed, measured
-- 2026-10-04; BR-CASH-001 answer 3a). New orders must choose (answer 1a).
alter table public.purchase_orders alter column payment_method drop default;
alter table public.purchase_orders
  add constraint purchase_orders_payment_method_valid
    check (payment_method is null or payment_method in ('CASH', 'BANK_TRANSFER')),
  add constraint purchase_orders_completed_has_payment
    check (status <> 'COMPLETED' or payment_method is not null),
  add constraint purchase_orders_account_matches_method
    check ((payment_method is not distinct from 'BANK_TRANSFER') = (bank_account_id is not null));

-- 3. Sales and purchase money per Saigon day and method (read only).
-- A split order counts once in each method's row (count distinct); an order
-- with no payment rows counts its net_total under orders_v2.payment_method,
-- and a missing method reads as cash, as the order list does.
create view public.cash_book_daily with (security_invoker = true) as
with sale_money as (
  select o.id,
         (o.created_at at time zone 'Asia/Saigon')::date as day,
         coalesce(p.method, o.payment_method, 'CASH') as method,
         coalesce(p.amount, o.net_total) as amount
  from public.orders_v2 o
  left join public.order_payments p on p.order_id = o.id
  where o.status = 'COMPLETED'
)
select 'SALE'::text as source, day, method, null::text as bank_account_id,
       count(distinct id)::int as doc_count, sum(amount)::bigint as amount
from sale_money group by day, method
union all
select 'PURCHASE'::text,
       (coalesce(transaction_date, created_at) at time zone 'Asia/Saigon')::date,
       payment_method, bank_account_id, count(*)::int, sum(total_amount)::bigint
from public.purchase_orders where status = 'COMPLETED'
group by 2, 3, 4;

revoke all on public.cash_book_daily from public, anon, authenticated;
grant select on public.cash_book_daily to service_role;

-- 4. save_purchase_order_atomic writes the two new fields. Body copied from
-- the live definition (0078; no later migration redefines it -- 0085 only
-- mentions it in a comment) with payment_method and bank_account_id added to
-- both the replace branch and the insert branch. Same signature, so
-- create or replace leaves no overload behind.
CREATE OR REPLACE FUNCTION public.save_purchase_order_atomic(p_order jsonb, p_lines jsonb DEFAULT '[]'::jsonb, p_replace_existing boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_po_id text;
  v_next_number integer;
  v_existing_id text;
  v_line_count integer;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'p_order must be a JSON object';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array';
  end if;

  v_po_id := nullif(btrim(p_order->>'id'), '');

  if v_po_id is null then
    perform pg_advisory_xact_lock(hashtext('purchase_orders:id'));
    select coalesce(
      max((substring(id from '^PO-([0-9]+)$'))::integer),
      0
    ) + 1
    into v_next_number
    from public.purchase_orders;
    v_po_id := 'PO-' || lpad(v_next_number::text, 3, '0');
  elsif not p_replace_existing and exists (
    select 1 from public.purchase_orders where id = v_po_id
  ) then
    raise exception 'Purchase order % already exists', v_po_id;
  end if;

  if p_replace_existing then
    select id
    into v_existing_id
    from public.purchase_orders
    where id = v_po_id
    for update;

    if v_existing_id is null then
      raise exception 'Purchase order % does not exist', v_po_id;
    end if;

    update public.purchase_orders
    set
      supplier_id = nullif(p_order->>'supplier_id', ''),
      source_id = nullif(p_order->>'source_id', ''),
      transaction_date = nullif(p_order->>'transaction_date', '')::timestamptz,
      supplier_invoice_code = nullif(p_order->>'supplier_invoice_code', ''),
      notes = nullif(p_order->>'notes', ''),
      subtotal_amount = coalesce(nullif(p_order->>'subtotal_amount', ''), '0')::bigint,
      shipping_fee = coalesce(nullif(p_order->>'shipping_fee', ''), '0')::bigint,
      tax_amount = coalesce(nullif(p_order->>'tax_amount', ''), '0')::bigint,
      voucher_amount = coalesce(nullif(p_order->>'voucher_amount', ''), '0')::bigint,
      discount_amount = coalesce(nullif(p_order->>'discount_amount', ''), '0')::bigint,
      total_amount = coalesce(nullif(p_order->>'total_amount', ''), '0')::bigint,
      status = coalesce(nullif(p_order->>'status', ''), 'DRAFT'),
      payment_method = nullif(p_order->>'payment_method', ''),
      bank_account_id = nullif(p_order->>'bank_account_id', ''),
      updated_at = now()
    where id = v_po_id;

    delete from public.purchase_order_lines
    where purchase_order_id = v_po_id;
  else
    insert into public.purchase_orders (
      id,
      supplier_id,
      source_id,
      transaction_date,
      supplier_invoice_code,
      notes,
      subtotal_amount,
      shipping_fee,
      tax_amount,
      voucher_amount,
      discount_amount,
      total_amount,
      status,
      payment_method,
      bank_account_id,
      created_by_id,
      created_by_name,
      created_at
    )
    values (
      v_po_id,
      nullif(p_order->>'supplier_id', ''),
      nullif(p_order->>'source_id', ''),
      nullif(p_order->>'transaction_date', '')::timestamptz,
      nullif(p_order->>'supplier_invoice_code', ''),
      nullif(p_order->>'notes', ''),
      coalesce(nullif(p_order->>'subtotal_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'shipping_fee', ''), '0')::bigint,
      coalesce(nullif(p_order->>'tax_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'voucher_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'discount_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'total_amount', ''), '0')::bigint,
      coalesce(nullif(p_order->>'status', ''), 'DRAFT'),
      nullif(p_order->>'payment_method', ''),
      nullif(p_order->>'bank_account_id', ''),
      nullif(p_order->>'created_by_id', ''),
      nullif(p_order->>'created_by_name', ''),
      coalesce(
        nullif(p_order->>'created_at', '')::timestamptz,
        now()
      )
    );
  end if;

  insert into public.purchase_order_lines (
    id,
    purchase_order_id,
    purchased_item_id,
    unit,
    quantity,
    unit_price,
    subtotal,
    conversion_id,
    base_unit,
    base_quantity,
    created_at
  )
  select
    row.id,
    v_po_id,
    nullif(row.purchased_item_id, ''),
    nullif(row.unit, ''),
    coalesce(row.quantity, 0),
    coalesce(row.unit_price, 0),
    coalesce(row.subtotal, 0),
    nullif(row.conversion_id, ''),
    nullif(row.base_unit, ''),
    coalesce(row.base_quantity, 0),
    coalesce(row.created_at, now())
  from jsonb_to_recordset(p_lines) as row(
    id text,
    purchased_item_id text,
    unit text,
    quantity numeric,
    unit_price bigint,
    subtotal bigint,
    conversion_id text,
    base_unit text,
    base_quantity numeric,
    created_at timestamptz
  );
  get diagnostics v_line_count = row_count;

  return jsonb_build_object(
    'purchase_order_id', v_po_id,
    'line_count', v_line_count
  );
end;
$function$;

revoke all on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) from public;
revoke all on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) from anon;
revoke all on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) from authenticated;
grant execute on function public.save_purchase_order_atomic(jsonb, jsonb, boolean) to service_role;
