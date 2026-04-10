-- ĐÃ CHẠY TRÊN SUPABASE - KHÔNG CHẠY LẠI
-- Migration 003 — Seed dữ liệu mặc định

-- ============================================================
-- SETTINGS
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('bank_id',            'ACB'),
  ('account_no',         'XXXXXXXXXX'),
  ('open_hour',          '6'),
  ('close_hour',         '22'),
  ('late_grace_minutes', '15')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RAW_MATERIALS
-- ============================================================
INSERT INTO raw_materials (id, name, unit) VALUES
  ('ca_phe_bot',  'Cà phê bột',      'g'),
  ('cacao_bot',   'Cacao bột',        'g'),
  ('matcha_bot',  'Matcha bột',       'g'),
  ('bot_kem_muoi','Bột kem muối',     'g'),
  ('sua_dac',     'Sữa đặc',          'g'),
  ('sua_tuoi',    'Sữa tươi',         'ml'),
  ('duong',       'Đường',            'g'),
  ('nuoc',        'Nước',             'ml')
ON CONFLICT (id) DO NOTHING;

-- Khởi tạo tồn kho nguyên liệu thô = 0
INSERT INTO raw_stock (id, quantity) VALUES
  ('ca_phe_bot',  0),
  ('cacao_bot',   0),
  ('matcha_bot',  0),
  ('bot_kem_muoi',0),
  ('sua_dac',     0),
  ('sua_tuoi',    0),
  ('duong',       0),
  ('nuoc',        0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEMI_PRODUCTS
-- ============================================================
INSERT INTO semi_products (id, name, unit, yield_qty) VALUES
  ('cot_ca_phe', 'Cốt cà phê',  'ml', 500),
  ('cot_cacao',  'Cốt cacao',   'ml', 1000),
  ('cot_matcha', 'Cốt matcha',  'ml', 1000),
  ('kem_muoi',   'Kem muối',    'g',  300),
  ('nuoc_duong', 'Nước đường',  'ml', 1000)
ON CONFLICT (id) DO NOTHING;

-- Công thức BTP
-- Cốt cà phê: 200g cà phê bột + 650ml nước → 500ml
INSERT INTO semi_recipes (semi_id, ingredient_id, ingredient_type, amount, unit) VALUES
  ('cot_ca_phe', 'ca_phe_bot', 'raw', 200,  'g'),
  ('cot_ca_phe', 'nuoc',       'raw', 650,  'ml'),
  ('cot_cacao',  'cacao_bot',  'raw', 200,  'g'),
  ('cot_cacao',  'nuoc',       'raw', 1000, 'ml'),
  ('cot_matcha', 'matcha_bot', 'raw', 100,  'g'),
  ('cot_matcha', 'nuoc',       'raw', 1000, 'ml'),
  ('kem_muoi',   'bot_kem_muoi','raw',100,  'g'),
  ('kem_muoi',   'sua_tuoi',   'raw', 200,  'ml'),
  ('nuoc_duong', 'duong',      'raw', 600,  'g'),
  ('nuoc_duong', 'nuoc',       'raw', 1000, 'ml');

-- Khởi tạo tồn kho BTP = 0
INSERT INTO semi_stock (id, quantity) VALUES
  ('cot_ca_phe', 0),
  ('cot_cacao',  0),
  ('cot_matcha', 0),
  ('kem_muoi',   0),
  ('nuoc_duong', 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SUPPLIES — vật tư tiêu hao
-- ============================================================
INSERT INTO supplies (id, name, category, quantity, unit, warn_at) VALUES
  ('ly',      'Ly',       'consumable', 0, 'cái', 50),
  ('nap',     'Nắp',      'consumable', 0, 'cái', 50),
  ('ong_hut', 'Ống hút',  'consumable', 0, 'cái', 50),
  ('muong',   'Muỗng',    'consumable', 0, 'cái', 30),
  ('tui_don', 'Túi đơn',  'consumable', 0, 'cái', 20),
  ('tui_doi', 'Túi đôi',  'consumable', 0, 'cái', 20)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PRODUCTS — 6 sản phẩm menu
-- ============================================================
WITH inserted AS (
  INSERT INTO products (name, category, price, icon, color, active, sort_order) VALUES
    ('Cà phê đen',       'Cà phê', 18000, '☕', '#FAEEDA', true, 1),
    ('Cà phê sữa',       'Cà phê', 20000, '☕', '#FAEEDA', true, 2),
    ('Cà phê sữa tươi',  'Cà phê', 22000, '☕', '#FAEEDA', true, 3),
    ('Cà phê kem muối',  'Cà phê', 24000, '☕', '#FAEEDA', true, 4),
    ('Matcha latte',     'Matcha', 23000, '🍵', '#E1F5EE', true, 5),
    ('Cacao latte',      'Cacao',  23000, '🍫', '#F5EAE0', true, 6)
  RETURNING id, name
)
-- Công thức sản phẩm
INSERT INTO product_recipes (product_id, ingredient_id, ingredient_type, amount, unit)
SELECT p.id, r.ingredient_id, r.ingredient_type, r.amount, r.unit
FROM inserted p
JOIN (VALUES
  -- Cà phê đen: 60ml cốt CF + 20ml nước đường
  ('Cà phê đen',       'cot_ca_phe', 'semi', 60,  'ml'),
  ('Cà phê đen',       'nuoc_duong', 'semi', 20,  'ml'),
  -- Cà phê sữa: 50ml cốt CF + 20g sữa đặc
  ('Cà phê sữa',       'cot_ca_phe', 'semi', 50,  'ml'),
  ('Cà phê sữa',       'sua_dac',    'raw',  20,  'g'),
  -- Cà phê sữa tươi: 30ml cốt CF + 30g sữa đặc + 70ml sữa tươi
  ('Cà phê sữa tươi',  'cot_ca_phe', 'semi', 30,  'ml'),
  ('Cà phê sữa tươi',  'sua_dac',    'raw',  30,  'g'),
  ('Cà phê sữa tươi',  'sua_tuoi',   'raw',  70,  'ml'),
  -- Cà phê kem muối: 50ml cốt CF + 20g sữa đặc + 30g kem muối
  ('Cà phê kem muối',  'cot_ca_phe', 'semi', 50,  'ml'),
  ('Cà phê kem muối',  'sua_dac',    'raw',  20,  'g'),
  ('Cà phê kem muối',  'kem_muoi',   'semi', 30,  'g'),
  -- Matcha latte: 40ml cốt matcha + 30g sữa đặc + 70ml sữa tươi
  ('Matcha latte',     'cot_matcha', 'semi', 40,  'ml'),
  ('Matcha latte',     'sua_dac',    'raw',  30,  'g'),
  ('Matcha latte',     'sua_tuoi',   'raw',  70,  'ml'),
  -- Cacao latte: 40ml cốt cacao + 30g sữa đặc + 70ml sữa tươi
  ('Cacao latte',      'cot_cacao',  'semi', 40,  'ml'),
  ('Cacao latte',      'sua_dac',    'raw',  30,  'g'),
  ('Cacao latte',      'sua_tuoi',   'raw',  70,  'ml')
) AS r(product_name, ingredient_id, ingredient_type, amount, unit)
ON p.name = r.product_name;

-- ============================================================
-- UNIT_CONVERSIONS — quy đổi đơn vị nhập kho
-- ============================================================
INSERT INTO unit_conversions (item_id, item_type, unit_name, to_base_rate) VALUES
  -- Sữa tươi (base: ml)
  ('sua_tuoi', 'raw', 'ml',     1),
  ('sua_tuoi', 'raw', 'hộp',    1000),
  ('sua_tuoi', 'raw', 'thùng',  12000),
  -- Sữa đặc (base: g)
  ('sua_dac',  'raw', 'g',      1),
  ('sua_dac',  'raw', 'hộp',    380),
  ('sua_dac',  'raw', 'thùng',  4560),
  -- Cà phê bột (base: g)
  ('ca_phe_bot','raw','g',      1),
  ('ca_phe_bot','raw','kg',     1000),
  -- Cacao bột (base: g)
  ('cacao_bot','raw', 'g',      1),
  ('cacao_bot','raw', 'kg',     1000),
  -- Matcha bột (base: g)
  ('matcha_bot','raw','g',      1),
  ('matcha_bot','raw','kg',     1000),
  -- Đường (base: g)
  ('duong',    'raw', 'g',      1),
  ('duong',    'raw', 'kg',     1000),
  -- Nước (base: ml)
  ('nuoc',     'raw', 'ml',     1),
  ('nuoc',     'raw', 'lít',    1000),
  -- Ly (base: cái)
  ('ly',       'supply', 'cái', 1),
  ('ly',       'supply', 'lốc', 50),
  ('ly',       'supply', 'thùng',1000),
  -- Nắp (base: cái)
  ('nap',      'supply', 'cái', 1),
  ('nap',      'supply', 'hộp', 50),
  -- Ống hút (base: cái)
  ('ong_hut',  'supply', 'cái', 1),
  ('ong_hut',  'supply', 'hộp', 100)
ON CONFLICT (item_id, unit_name) DO NOTHING;
