-- Preserve payment detail when an order edit creates a replacement version.
-- The seven-argument overload delegates the existing six-argument atomic edit
-- and inserts the replacement payment rows in the same PostgreSQL transaction.

-- Migration 0024 checked the numeric sum before bigint storage, so a direct
-- RPC caller could submit fractional VND amounts that were rounded on insert.
-- Keep its proven transaction body intact behind a validation wrapper.
alter function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
) rename to create_pos_order_atomic_unvalidated_0024;

revoke all on function public.create_pos_order_atomic_unvalidated_0024(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
) from public, anon, authenticated, service_role;

create function public.create_pos_order_atomic(
  p_brand_code text,
  p_order jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb,
  p_ledger jsonb default '[]'::jsonb,
  p_client_request_id text default null,
  p_payments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'p_payments must be a JSON array';
  end if;

  if jsonb_array_length(p_payments) > 0 and exists (
    select 1
    from jsonb_array_elements(p_payments) as payment
    where nullif(btrim(payment->>'id'), '') is null
       or coalesce(payment->>'method', '') not in ('CASH', 'BANK_TRANSFER')
       or coalesce(payment->>'amount', '') !~ '^[0-9]+$'
  ) then
    raise exception 'Payment amount must be non-negative integer VND and payment fields must be valid';
  end if;

  select public.create_pos_order_atomic_unvalidated_0024(
    p_brand_code,
    p_order,
    p_lines,
    p_event,
    p_ledger,
    p_client_request_id,
    p_payments
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
) to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_payments_id_nonempty'
      and conrelid = 'public.order_payments'::regclass
  ) then
    alter table public.order_payments
      add constraint order_payments_id_nonempty check (btrim(id) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_payments_method_valid'
      and conrelid = 'public.order_payments'::regclass
  ) then
    alter table public.order_payments
      add constraint order_payments_method_valid
      check (method in ('CASH', 'BANK_TRANSFER'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_payments_amount_nonnegative'
      and conrelid = 'public.order_payments'::regclass
  ) then
    alter table public.order_payments
      add constraint order_payments_amount_nonnegative check (amount >= 0);
  end if;
end;
$$;

create or replace function public.supersede_order_v2_atomic(
  p_old_order_id text,
  p_expected_old_version integer,
  p_new_order jsonb,
  p_new_lines jsonb,
  p_event jsonb,
  p_ledger jsonb,
  p_payments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_new_order_id text;
  v_net_total bigint;
  v_payment_sum bigint;
  v_payment_count integer := 0;
begin
  if p_new_order is null or jsonb_typeof(p_new_order) <> 'object' then
    raise exception 'p_new_order must be a JSON object';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'p_payments must be a JSON array';
  end if;
  if jsonb_array_length(p_payments) = 0 then
    raise exception 'p_payments must contain at least one row';
  end if;

  v_new_order_id := nullif(btrim(p_new_order->>'id'), '');
  if v_new_order_id is null then
    raise exception 'p_new_order.id is required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payments) as payment
    where nullif(btrim(payment->>'id'), '') is null
       or payment->>'order_id' is distinct from v_new_order_id
  ) then
    raise exception 'Every payment must reference the new order';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payments) as payment
    where coalesce(payment->>'method', '') not in ('CASH', 'BANK_TRANSFER')
  ) then
    raise exception 'Payment method is invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payments) as payment
    where coalesce(payment->>'amount', '') !~ '^[0-9]+$'
  ) then
    raise exception 'Payment amount must be non-negative integer VND';
  end if;

  select coalesce(sum((payment->>'amount')::bigint), 0)
  into v_payment_sum
  from jsonb_array_elements(p_payments) as payment;

  v_net_total := coalesce(nullif(p_new_order->>'net_total', '')::bigint, 0);
  if v_payment_sum <> v_net_total then
    raise exception
      'Payment total % does not match order net_total %',
      v_payment_sum, v_net_total;
  end if;

  select public.supersede_order_v2_atomic(
    p_old_order_id,
    p_expected_old_version,
    p_new_order,
    p_new_lines,
    p_event,
    p_ledger
  )
  into v_result;

  insert into public.order_payments (
    id, order_id, method, amount, reference, created_at
  )
  select
    payment.id,
    v_new_order_id,
    payment.method,
    payment.amount,
    coalesce(payment.reference, ''),
    now()
  from jsonb_to_recordset(p_payments) as payment(
    id text,
    order_id text,
    method text,
    amount bigint,
    reference text
  );
  get diagnostics v_payment_count = row_count;

  if v_payment_count <> jsonb_array_length(p_payments) then
    raise exception 'Payment count mismatch';
  end if;

  return v_result || jsonb_build_object('payment_count', v_payment_count);
end;
$$;

revoke all on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb, jsonb, jsonb
) from public;
revoke all on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb, jsonb, jsonb
) from anon;
revoke all on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb, jsonb, jsonb
) from authenticated;
grant execute on function public.supersede_order_v2_atomic(
  text, integer, jsonb, jsonb, jsonb, jsonb, jsonb
) to service_role;
