-- ============================================================================
-- fnbapp Supabase schema (Phase A)
-- Claude code — Supabase migration
--
-- Replaces Google Sheets structure with Postgres. Design goals:
--   - Money: BIGINT (integer đồng VND). No floats.
--   - IDs: TEXT (compatible with existing UUIDs and prefixed legacy IDs).
--   - Snapshots: JSONB.
--   - Status fields: CHECK constraints per domain-dictionary enums.
--   - Soft delete: catalog tables use status ACTIVE/INACTIVE/DELETED.
--   - Composite unique (brand_id, order_no) on Orders_V2 to fix race.
-- ============================================================================

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ============================================================================
-- Reference data (small, low churn)
-- ============================================================================

create table if not exists public.brands (
  id text primary key,
  name text not null,
  code text,
  start_date date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id text primary key,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now()
);

create table if not exists public.item_categories (
  id text primary key,
  name text not null,
  system_type text check (system_type in ('RAW','CONSUMABLE','EQUIPMENT')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now()
);

create table if not exists public.units (
  id text primary key,
  name text not null,
  abbreviation text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  tax_id text,
  address text,
  links text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_sources (
  id text primary key,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Catalog
-- ============================================================================

create table if not exists public.products (
  id text primary key,
  name text not null,
  category_id text references public.product_categories(id) on delete restrict,
  brand_id text references public.brands(id) on delete restrict,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  image_url text,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_brand_id on public.products(brand_id);
create index if not exists idx_products_status on public.products(status);

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete restrict,
  size_name text not null,
  price bigint not null default 0,
  sort_order integer default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_product_variants_product_id on public.product_variants(product_id);

create table if not exists public.modifiers (
  id text primary key,
  name text not null,
  group_name text,
  price bigint not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id text primary key,
  target_type text not null check (target_type in ('PRODUCT_VARIANT','SEMI_PRODUCT','MODIFIER')),
  target_id text not null,
  ingredients_json jsonb not null default '[]'::jsonb,
  start_date timestamptz,
  end_date timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_recipes_target on public.recipes(target_type, target_id);
create index if not exists idx_recipes_status on public.recipes(status);

create table if not exists public.promotions (
  id text primary key,
  name text not null,
  brand_id text references public.brands(id) on delete restrict,
  code text,
  type text not null check (type in ('ORDER_DISCOUNT','PRODUCT_DISCOUNT')),
  discount_type text not null check (discount_type in ('PERCENT','FLAT_PRICE','FLAT_VND')),
  discount_value bigint not null default 0,
  applicable_products_json jsonb not null default '[]'::jsonb,
  start_date timestamptz,
  end_date timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_promotions_brand on public.promotions(brand_id);
create index if not exists idx_promotions_status_dates on public.promotions(status, start_date, end_date);

create table if not exists public.base_ingredients (
  id text primary key,
  name text not null,
  base_unit text references public.units(id) on delete restrict,
  is_non_inventory boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.semi_products (
  id text primary key,
  name text not null,
  base_unit text references public.units(id) on delete restrict,
  batch_yield numeric(12,3) not null default 1,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchased_items (
  id text primary key,
  name text not null,
  item_category_id text references public.item_categories(id) on delete restrict,
  base_ingredient_id text references public.base_ingredients(id) on delete restrict,
  semi_product_id text references public.semi_products(id) on delete restrict,
  default_unit_id text references public.units(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_purchased_items_category on public.purchased_items(item_category_id);

create table if not exists public.uom_conversions (
  id text primary key,
  purchased_item_id text not null references public.purchased_items(id) on delete restrict,
  base_unit text not null references public.units(id) on delete restrict,
  purchased_unit text not null references public.units(id) on delete restrict,
  conversion_rate numeric(18,6) not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_uom_conversions_item on public.uom_conversions(purchased_item_id);
create index if not exists idx_uom_conversions_status on public.uom_conversions(status);

create table if not exists public.product_price_history (
  id text primary key,
  variant_id text not null references public.product_variants(id) on delete restrict,
  old_price bigint,
  new_price bigint not null,
  reason text,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_product_price_history_variant on public.product_price_history(variant_id);

-- ============================================================================
-- Transactions
-- ============================================================================

create table if not exists public.orders_v2 (
  id text primary key,
  order_no text not null,
  brand_id text not null references public.brands(id) on delete restrict,
  status text not null check (status in ('DRAFT','COMPLETED','SUPERSEDED','VOIDED')),
  version integer not null default 1,
  parent_order_id text default '',
  superseded_by text default '',
  created_at timestamptz not null,
  created_by_id text,
  created_by_name text,
  completed_at timestamptz,
  voided_at timestamptz,
  voided_by_id text default '',
  void_reason text default '',
  currency text not null default 'VND',
  gross_total bigint not null default 0,
  promo_discount_total bigint not null default 0,
  manual_item_discount_total bigint not null default 0,
  manual_order_discount bigint not null default 0,
  net_total bigint not null default 0,
  applied_promotion_id text default '',
  applied_promotion_snapshot_json jsonb not null default '{}'::jsonb,
  pos_snapshot_json jsonb not null default '{}'::jsonb,
  payment_method text check (payment_method in ('CASH','BANK_TRANSFER') or payment_method is null),
  payment_ref text default '',
  migration_notes text default '',
  updated_at timestamptz not null default now(),
  -- Composite unique fixes CODE-11 order_no race.
  unique (brand_id, order_no)
);
create index if not exists idx_orders_v2_status on public.orders_v2(status, superseded_by);
create index if not exists idx_orders_v2_brand_created on public.orders_v2(brand_id, created_at desc);
create index if not exists idx_orders_v2_created_at on public.orders_v2(created_at desc);
create index if not exists idx_orders_v2_parent on public.orders_v2(parent_order_id);

create table if not exists public.order_lines_v2 (
  id text primary key,
  order_id text not null references public.orders_v2(id) on delete cascade,
  line_no integer not null,
  product_id text not null references public.products(id) on delete restrict,
  product_snapshot_json jsonb not null default '{}'::jsonb,
  variant_id text not null references public.product_variants(id) on delete restrict,
  variant_snapshot_json jsonb not null default '{}'::jsonb,
  qty integer not null check (qty > 0),
  unit_price bigint not null default 0,
  modifiers_snapshot_json jsonb not null default '[]'::jsonb,
  gross_line_total bigint not null default 0,
  promo_discount bigint not null default 0,
  manual_item_discount bigint not null default 0,
  order_discount_allocation bigint not null default 0,
  net_line_total bigint not null default 0,
  cost_at_sale bigint not null default 0,
  recipe_snapshot_json jsonb not null default '{}'::jsonb,
  promo_discount_reason text default '',
  manual_discount_reason text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_order_lines_v2_order on public.order_lines_v2(order_id);
create index if not exists idx_order_lines_v2_product on public.order_lines_v2(product_id);
create index if not exists idx_order_lines_v2_variant on public.order_lines_v2(variant_id);

create table if not exists public.order_events (
  id text primary key,
  order_id text not null references public.orders_v2(id) on delete cascade,
  event_type text not null check (event_type in ('CREATED','EDITED','VOIDED','REOPENED','MIGRATED')),
  event_at timestamptz not null default now(),
  actor_id text,
  actor_name text,
  from_version integer,
  to_version integer not null,
  previous_order_id text default '',
  delta_json jsonb not null default '{}'::jsonb,
  reason text not null default ''
);
create index if not exists idx_order_events_order on public.order_events(order_id);
create index if not exists idx_order_events_type_at on public.order_events(event_type, event_at);

create table if not exists public.stock_ledger (
  id text primary key,
  item_reference text not null,
  transaction_type text not null check (transaction_type in (
    'SALES_CONSUME','EDIT_REVERSAL','EDIT_CONSUME','PO_RECEIPT',
    'PRODUCTION_CONSUME','PRODUCTION_YIELD','STOCK_ADJUST',
    'ADJUSTMENT_IN','ADJUSTMENT_OUT'
  )),
  quantity_change numeric(18,6) not null,
  unit_cost numeric(18,6) not null default 0,
  reference_id text default '',
  source text default '',
  notes text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_ledger_item_created on public.stock_ledger(item_reference, created_at);
create index if not exists idx_stock_ledger_reference on public.stock_ledger(reference_id);
create index if not exists idx_stock_ledger_type on public.stock_ledger(transaction_type);
create index if not exists idx_stock_ledger_created_at on public.stock_ledger(created_at);

create table if not exists public.purchase_orders (
  id text primary key,
  supplier_id text references public.suppliers(id) on delete restrict,
  source_id text references public.purchase_sources(id) on delete restrict,
  transaction_date timestamptz,
  supplier_invoice_code text,
  notes text,
  subtotal_amount bigint not null default 0,
  shipping_fee bigint not null default 0,
  tax_amount bigint not null default 0,
  voucher_amount bigint not null default 0,
  discount_amount bigint not null default 0,
  total_amount bigint not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED','CANCELLED')),
  created_by_id text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_purchase_orders_supplier on public.purchase_orders(supplier_id);
create index if not exists idx_purchase_orders_status on public.purchase_orders(status);
create index if not exists idx_purchase_orders_txn_date on public.purchase_orders(transaction_date desc);

create table if not exists public.purchase_order_lines (
  id text primary key,
  purchase_order_id text not null references public.purchase_orders(id) on delete cascade,
  purchased_item_id text references public.purchased_items(id) on delete restrict,
  unit text,
  quantity numeric(18,6) not null default 0,
  unit_price bigint not null default 0,
  subtotal bigint not null default 0,
  conversion_id text references public.uom_conversions(id) on delete restrict,
  base_unit text references public.units(id) on delete restrict,
  base_quantity numeric(18,6) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_po_lines_po on public.purchase_order_lines(purchase_order_id);
create index if not exists idx_po_lines_item on public.purchase_order_lines(purchased_item_id);

create table if not exists public.stock_adjustments (
  id text primary key,
  reason text not null,
  created_by_id text,
  created_by_name text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  notes text
);

create table if not exists public.production_orders (
  id text primary key,
  semi_product_id text not null references public.semi_products(id) on delete restrict,
  batch_yield numeric(18,6) not null default 1,
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','CANCELLED')),
  notes text,
  created_by_id text,
  created_by_name text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.production_items (
  id text primary key,
  production_order_id text not null references public.production_orders(id) on delete cascade,
  ingredient_id text not null,
  ingredient_type text not null check (ingredient_type in ('BASE_INGREDIENT','SEMI_PRODUCT')),
  quantity numeric(18,6) not null,
  unit_id text references public.units(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists idx_production_items_order on public.production_items(production_order_id);

create table if not exists public.pos_drafts (
  id text primary key,
  cart_json jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN' check (status in ('OPEN','SUBMITTED','ABANDONED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Auth
-- ============================================================================

create table if not exists public.users (
  id text primary key,
  username text not null unique,
  password_hash text not null,
  name text,
  role text not null check (role in ('STAFF','MANAGER','ADMIN','SYSTEM')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_users_username on public.users(username);

-- ============================================================================
-- updated_at triggers (auto-maintain)
-- ============================================================================

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to tables with updated_at columns.
do $$
declare
  t text;
  tables text[] := array[
    'brands','products','product_variants','modifiers','recipes',
    'promotions','base_ingredients','semi_products','purchased_items',
    'uom_conversions','orders_v2','purchase_orders','users','pos_drafts'
  ];
begin
  foreach t in array tables loop
    execute format(
      'drop trigger if exists trg_%s_touch on public.%s;
       create trigger trg_%s_touch before update on public.%s
       for each row execute function public.touch_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

-- Enable RLS on all tables. Default deny. Service role bypasses (server actions).
-- Browser clients must use ANON key with explicit policies (Phase F later).
do $$
declare
  t text;
  tables text[] := array[
    'brands','product_categories','item_categories','units','suppliers','purchase_sources',
    'products','product_variants','modifiers','recipes','promotions',
    'base_ingredients','semi_products','purchased_items','uom_conversions','product_price_history',
    'orders_v2','order_lines_v2','order_events','stock_ledger',
    'purchase_orders','purchase_order_lines','stock_adjustments',
    'production_orders','production_items','pos_drafts','users'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%s enable row level security;', t);
  end loop;
end $$;
