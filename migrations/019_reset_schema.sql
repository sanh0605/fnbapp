-- ============================================================
-- FNB App — Migration 019: Reset toàn bộ schema
-- Chạy file này trong Supabase SQL Editor
-- ⚠️  DROP các bảng cũ — orders sẽ được backup & restore tự động
-- ============================================================


-- ── 0A. BACKUP dữ liệu orders trước khi drop ─────────────────
-- Tạo bảng tạm chứa toàn bộ orders hiện có (kể cả cột thừa)
drop table if exists _orders_backup;
create table _orders_backup as
  select * from orders
  where exists (select 1 from information_schema.tables
                where table_name = 'orders' and table_schema = 'public');


-- ── 0B. DROP TẤT CẢ BẢNG CŨ (cascade để tránh lỗi FK) ───────
drop table if exists po_payments          cascade;
drop table if exists po_adjustments       cascade;
drop table if exists purchase_order_items cascade;
drop table if exists purchase_orders      cascade;
drop table if exists sku_units            cascade;
drop table if exists sku_items            cascade;
drop table if exists suppliers            cascade;
drop table if exists assets               cascade;
drop table if exists schedule_logs        cascade;
drop table if exists expenses             cascade;
drop table if exists unit_conversions     cascade;
drop table if exists raw_stock            cascade;
drop table if exists semi_stock           cascade;
drop table if exists stock_receipts       cascade;
drop table if exists semi_recipes         cascade;
drop table if exists product_recipes      cascade;
drop table if exists products             cascade;
drop table if exists supplies             cascade;
drop table if exists semi_products        cascade;
drop table if exists raw_materials        cascade;
drop table if exists settings             cascade;
drop table if exists orders               cascade;
drop table if exists users                cascade;
drop table if exists outlets              cascade;
drop table if exists brands               cascade;


-- ══════════════════════════════════════════════════════════════
-- 1. BRANDS
-- ══════════════════════════════════════════════════════════════
create table brands (
  id   text primary key,
  name text not null
);

alter table brands enable row level security;
create policy "brands_open" on brands using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- 2. OUTLETS
-- ══════════════════════════════════════════════════════════════
create table outlets (
  id       text primary key,
  name     text not null,
  brand_id text not null references brands(id)
);

alter table outlets enable row level security;
create policy "outlets_open" on outlets using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- 3. USERS
-- ══════════════════════════════════════════════════════════════
create table users (
  id            uuid        primary key default gen_random_uuid(),
  username      text        not null unique,
  name          text        not null,
  password_hash text        not null,
  role          text        not null check (role in ('owner', 'manager', 'staff')),
  active        boolean     not null default true,
  outlet_id     text        references outlets(id),  -- null cho manager/owner
  created_at    timestamptz not null default now()
);

alter table users enable row level security;
create policy "users_open" on users using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- 4. ORDERS
-- ══════════════════════════════════════════════════════════════
-- Lưu ý: cột là `method` (không phải `pay_method`)
--   Giá trị: 'Tiền mặt' | 'Chuyển khoản'
create table orders (
  id              uuid        primary key default gen_random_uuid(),
  client_id       uuid,                         -- UUID client-side cho offline idempotency
  order_num       text,                         -- '#001', '#002', ...
  created_at      timestamptz not null default now(),
  total           numeric(12,0) not null default 0,
  subtotal        numeric(12,0),
  discount_amount numeric(12,0),
  actual_received numeric(12,0),
  method          text,                         -- 'Tiền mặt' | 'Chuyển khoản'
  items           jsonb,                        -- [{id, name, qty, price}]
  staff_name      text,
  outlet_id       text references outlets(id),  -- null nếu admin/owner bán trực tiếp
  brand_id        text references brands(id),
  voided          boolean not null default false
);

-- Partial unique index: client_id phải unique khi không null (idempotent sync)
create unique index orders_client_id_key
  on orders(client_id)
  where client_id is not null;

-- Index hỗ trợ query theo ngày + filter brand/outlet
create index orders_created_at_idx on orders(created_at desc);
create index orders_brand_idx      on orders(brand_id);
create index orders_outlet_idx     on orders(outlet_id);
create index orders_voided_idx     on orders(voided);

alter table orders enable row level security;
create policy "orders_open" on orders using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- 5. SETTINGS
-- ══════════════════════════════════════════════════════════════
create table settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

alter table settings enable row level security;
create policy "settings_open" on settings using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- 6. RAW_MATERIALS  (nguyên liệu thô — dùng trong menu/recipes)
-- ══════════════════════════════════════════════════════════════
create table raw_materials (
  id   text primary key,
  name text not null,
  unit text not null default 'g'
);

alter table raw_materials enable row level security;
create policy "raw_materials_open" on raw_materials using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- 7. SEMI_PRODUCTS  (bán thành phẩm — dùng trong menu/recipes)
-- ══════════════════════════════════════════════════════════════
create table semi_products (
  id     text    primary key,
  name   text    not null,
  unit   text    not null default 'ml',
  yields numeric               -- yield của 1 mẻ (informational)
);

alter table semi_products enable row level security;
create policy "semi_products_open" on semi_products using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- 8. SUPPLIES  (vật tư — ly, nắp, ống hút...)
-- ══════════════════════════════════════════════════════════════
create table supplies (
  id   text primary key,
  name text not null,
  unit text not null default 'cái'
);

alter table supplies enable row level security;
create policy "supplies_open" on supplies using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- 9. PRODUCTS  (menu sản phẩm bán hàng)
-- ══════════════════════════════════════════════════════════════
create table products (
  id         uuid    primary key default gen_random_uuid(),
  name       text    not null,
  category   text    not null,
  price      integer not null default 0,
  icon       text    default '☕',
  color      text    default '#FAEEDA',
  active     boolean not null default true,
  sort_order integer not null default 0
);

alter table products enable row level security;
create policy "products_open" on products using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- 10. PRODUCT_RECIPES  (công thức cho từng sản phẩm)
-- ══════════════════════════════════════════════════════════════
create table product_recipes (
  id              uuid    primary key default gen_random_uuid(),
  product_id      uuid    not null references products(id) on delete cascade,
  ingredient_id   text    not null,   -- id trong raw_materials / semi_products
  ingredient_type text    not null check (ingredient_type in ('semi', 'raw', 'supply')),
  amount          numeric not null,
  unit            text
);

alter table product_recipes enable row level security;
create policy "product_recipes_open" on product_recipes using (true) with check (true);


-- ══════════════════════════════════════════════════════════════
-- SEED DATA
-- ══════════════════════════════════════════════════════════════

-- ── Brands ──
insert into brands (id, name) values
  ('CF_SANG', 'Cà Phê Sáng'),
  ('TRA_TOI', 'Trà Tối');


-- ── Outlets ──
insert into outlets (id, name, brand_id) values
  ('CF_O1',  'CF Sáng — Cơ sở 1',  'CF_SANG'),
  ('CF_O2',  'CF Sáng — Cơ sở 2',  'CF_SANG'),
  ('CF_O3',  'CF Sáng — Cơ sở 3',  'CF_SANG'),
  ('CF_O4',  'CF Sáng — Cơ sở 4',  'CF_SANG'),
  ('CF_O5',  'CF Sáng — Cơ sở 5',  'CF_SANG'),
  ('TRA_O1', 'Trà Tối — Cơ sở 1',  'TRA_TOI'),
  ('TRA_O2', 'Trà Tối — Cơ sở 2',  'TRA_TOI');


-- ── Users ──
-- Mật khẩu mặc định: admin123
-- SHA-256('admin123') = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
-- Đổi mật khẩu ngay sau khi đăng nhập lần đầu qua trang Cài đặt
insert into users (username, name, password_hash, role, active, outlet_id) values
  ('admin', 'Admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'owner', true, null);


-- ── Settings ──
insert into settings (key, value) values
  ('bank_id',            'ACB'),
  ('account_no',         ''),
  ('account_name',       ''),
  ('transfer_content',   'Thanh toan don hang'),
  ('open_hour',          '6'),
  ('close_hour',         '10'),
  ('late_grace_minutes', '15');


-- ── Raw materials ──
insert into raw_materials (id, name, unit) values
  ('ca_phe_bot',   'Cà phê bột',   'g'),
  ('cacao_bot',    'Cacao bột',    'g'),
  ('matcha_bot',   'Matcha bột',   'g'),
  ('bot_kem_muoi', 'Bột kem muối', 'g'),
  ('sua_dac',      'Sữa đặc',      'g'),
  ('sua_tuoi',     'Sữa tươi',     'ml'),
  ('duong',        'Đường',        'g'),
  ('nuoc',         'Nước',         'ml');


-- ── Semi products (BTP) ──
insert into semi_products (id, name, unit, yields) values
  ('cot_ca_phe', 'Cốt cà phê', 'ml', 500),
  ('cot_cacao',  'Cốt cacao',  'ml', 1000),
  ('cot_matcha', 'Cốt matcha', 'ml', 1000),
  ('kem_muoi',   'Kem muối',   'g',  300),
  ('nuoc_duong', 'Nước đường', 'ml', 1000);


-- ── Supplies (vật tư) ──
insert into supplies (id, name, unit) values
  ('ly',      'Ly',      'cái'),
  ('nap',     'Nắp',     'cái'),
  ('ong_hut', 'Ống hút', 'cái'),
  ('muong',   'Muỗng',   'cái'),
  ('tui_don', 'Túi đơn', 'cái'),
  ('tui_doi', 'Túi đôi', 'cái');


-- ── Products ──
insert into products (id, name, category, price, icon, color, active, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'Cà phê đen',      'Cà phê', 18000, '☕', '#FAEEDA', true, 1),
  ('00000000-0000-0000-0000-000000000002', 'Cà phê sữa',      'Cà phê', 20000, '☕', '#FAEEDA', true, 2),
  ('00000000-0000-0000-0000-000000000003', 'Cà phê sữa tươi', 'Cà phê', 22000, '☕', '#FAEEDA', true, 3),
  ('00000000-0000-0000-0000-000000000004', 'Cà phê kem muối', 'Cà phê', 24000, '☕', '#FAEEDA', true, 4),
  ('00000000-0000-0000-0000-000000000005', 'Matcha latte',    'Matcha', 23000, '🍵', '#E8F5E4', true, 5),
  ('00000000-0000-0000-0000-000000000006', 'Cacao latte',     'Cacao',  23000, '🍫', '#F5EDE8', true, 6);


-- ── Product recipes ──
insert into product_recipes (product_id, ingredient_id, ingredient_type, amount, unit) values
  -- Cà phê đen: 60ml cốt CF
  ('00000000-0000-0000-0000-000000000001', 'cot_ca_phe', 'semi', 60,  'ml'),

  -- Cà phê sữa: 50ml cốt CF + 20g sữa đặc
  ('00000000-0000-0000-0000-000000000002', 'cot_ca_phe', 'semi', 50,  'ml'),
  ('00000000-0000-0000-0000-000000000002', 'sua_dac',    'raw',  20,  'g'),

  -- Cà phê sữa tươi: 30ml cốt CF + 30g sữa đặc + 70ml sữa tươi
  ('00000000-0000-0000-0000-000000000003', 'cot_ca_phe', 'semi', 30,  'ml'),
  ('00000000-0000-0000-0000-000000000003', 'sua_dac',    'raw',  30,  'g'),
  ('00000000-0000-0000-0000-000000000003', 'sua_tuoi',   'raw',  70,  'ml'),

  -- Cà phê kem muối: 50ml cốt CF + 20g sữa đặc + 30g kem muối
  ('00000000-0000-0000-0000-000000000004', 'cot_ca_phe', 'semi', 50,  'ml'),
  ('00000000-0000-0000-0000-000000000004', 'sua_dac',    'raw',  20,  'g'),
  ('00000000-0000-0000-0000-000000000004', 'kem_muoi',   'semi', 30,  'g'),

  -- Matcha latte: 40ml cốt matcha + 30g sữa đặc + 70ml sữa tươi
  ('00000000-0000-0000-0000-000000000005', 'cot_matcha', 'semi', 40,  'ml'),
  ('00000000-0000-0000-0000-000000000005', 'sua_dac',    'raw',  30,  'g'),
  ('00000000-0000-0000-0000-000000000005', 'sua_tuoi',   'raw',  70,  'ml'),

  -- Cacao latte: 40ml cốt cacao + 30g sữa đặc + 70ml sữa tươi
  ('00000000-0000-0000-0000-000000000006', 'cot_cacao',  'semi', 40,  'ml'),
  ('00000000-0000-0000-0000-000000000006', 'sua_dac',    'raw',  30,  'g'),
  ('00000000-0000-0000-0000-000000000006', 'sua_tuoi',   'raw',  70,  'ml');


-- ══════════════════════════════════════════════════════════════
-- RESTORE ORDERS từ backup
-- Dùng dynamic SQL để xử lý cột backup có thể khác schema mới
-- ══════════════════════════════════════════════════════════════
do $$
declare
  has_client_id  boolean;
  has_outlet_id  boolean;
  has_brand_id   boolean;
  has_subtotal   boolean;
  has_discount   boolean;
  has_actual     boolean;
  sql_insert     text;
begin
  -- Kiểm tra cột nào tồn tại trong bảng backup
  select count(*) > 0 into has_client_id  from information_schema.columns where table_schema='public' and table_name='_orders_backup' and column_name='client_id';
  select count(*) > 0 into has_outlet_id  from information_schema.columns where table_schema='public' and table_name='_orders_backup' and column_name='outlet_id';
  select count(*) > 0 into has_brand_id   from information_schema.columns where table_schema='public' and table_name='_orders_backup' and column_name='brand_id';
  select count(*) > 0 into has_subtotal   from information_schema.columns where table_schema='public' and table_name='_orders_backup' and column_name='subtotal';
  select count(*) > 0 into has_discount   from information_schema.columns where table_schema='public' and table_name='_orders_backup' and column_name='discount_amount';
  select count(*) > 0 into has_actual     from information_schema.columns where table_schema='public' and table_name='_orders_backup' and column_name='actual_received';

  sql_insert := '
    insert into orders (id, client_id, order_num, created_at, total,
                        subtotal, discount_amount, actual_received,
                        method, items, staff_name, outlet_id, brand_id, voided)
    select
      id,
      ' || case when has_client_id  then 'client_id'       else 'null::uuid'    end || ',
      order_num,
      created_at,
      coalesce(total, 0),
      ' || case when has_subtotal   then 'subtotal'         else 'null::numeric' end || ',
      ' || case when has_discount   then 'discount_amount'  else 'null::numeric' end || ',
      ' || case when has_actual     then 'actual_received'  else 'null::numeric' end || ',
      method,
      items,
      staff_name,
      ' || case when has_outlet_id  then 'outlet_id'        else 'null::text'   end || ',
      ' || case when has_brand_id   then 'brand_id'         else 'null::text'   end || ',
      coalesce(voided, false)
    from _orders_backup
    on conflict (id) do nothing
  ';

  execute sql_insert;

  raise notice 'Restore hoàn tất: % đơn hàng đã được phục hồi.',
    (select count(*) from _orders_backup);
end;
$$;


-- ── Kiểm tra kết quả restore ─────────────────────────────────
select
  (select count(*) from _orders_backup) as backup_count,
  (select count(*) from orders)         as restored_count;

-- ── Xoá bảng backup sau khi đã xác nhận restore thành công ──
-- Uncomment dòng dưới để dọn:
-- drop table if exists _orders_backup;
