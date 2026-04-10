-- Migration 008: Seed đơn nhập hàng thực tế
-- ĐÃ KIỂM TRA: chạy sau Migration 007
-- Nguồn: Phin Đi - Coffee Takeaway

-- BƯỚC 1: Insert nhà cung cấp từ các đơn hàng
INSERT INTO suppliers (code, name, platform, platform_url, contact_type, active) VALUES
  ('NCC-PV',   'Phương Vy Official Store',                       'shopee', 'https://shopee.vn/phuongvy.coffee',        'nha_cung_cap', true),
  ('NCC-CC',   'c&ccoffee',                                      'shopee', 'https://shopee.vn/caphehatrangxay',         'nha_cung_cap', true),
  ('NCC-VH',   'Vinh Hùng Store HCM',                           'shopee', 'https://shopee.vn/vinhhungstore888',        'nha_cung_cap', true),
  ('NCC-DK',   'DK HARVEST OFFICIAL STORE',                     'shopee', 'https://shopee.vn/dk_harvest',             'nha_cung_cap', true),
  ('NCC-DP',   'DP FOOD',                                       'shopee', 'https://shopee.vn/dpfood.com.vn',           'nha_cung_cap', true),
  ('NCC-HT',   'Nguyên Liệu Pha Chế H.T',                      'shopee', 'https://shopee.vn/h.t_shop',               'nha_cung_cap', true),
  ('NCC-BB',   'BAO BÌ VUI',                                    'shopee', 'https://shopee.vn/baobivui',               'nha_cung_cap', true),
  ('NCC-SM',   'Sky Milk Store',                                 'shopee', 'https://shopee.vn/sky_milk_store',         'nha_cung_cap', true),
  ('NCC-DM',   'dienmaydaiphattai',                              'shopee', 'https://shopee.vn/dienmaydaiphattai',      'nha_cung_cap', true),
  ('NCC-TM',   'Tây Mộc Việt Nam',                              'shopee', 'https://shopee.vn/taymocvietnam',          'nha_cung_cap', true),
  ('NCC-CK',   'Ck Shop 611',                                   'shopee', 'https://shopee.vn/ckshop611',              'nha_cung_cap', true),
  ('NCC-PT',   'PTLUXURY',                                      'shopee', 'https://shopee.vn/ptluxury',               'nha_cung_cap', true),
  ('NCC-GK',   'Gia Dụng KiTa',                                 'shopee', 'https://shopee.vn/giadungkita',            'nha_cung_cap', true),
  ('NCC-NP',   'Nội Thất Pioneer',                              'shopee', 'https://shopee.vn/chinhanhpioneer',        'nha_cung_cap', true),
  ('NCC-HG',   'Hygi Store',                                    'shopee', 'https://shopee.vn/hygi_vn',                'nha_cung_cap', true),
  ('NCC-LO',   'Living Ovoje',                                  'shopee', 'https://shopee.vn/livingovojemall',        'nha_cung_cap', true),
  ('NCC-HN',   'Hàng Nhật Đồng Giá',                           'shopee', 'https://shopee.vn/shop_tuizipper',         'nha_cung_cap', true),
  ('NCC-GD',   'Cửa hàng Gia dụng Thỏ Trắng',                 'shopee', 'https://shopee.vn/thotrang.vn',            'nha_cung_cap', true),
  ('NCC-TRG',  'The Garden Tea & Coffee',                       'shopee', 'https://shopee.vn/trasua.thegarden',       'nha_cung_cap', true),
  ('NCC-TRY',  'Nguyên liệu pha chế Trà My',                   'direct', null,                                        'nha_cung_cap', true),
  ('NCC-TKX',  'CÔNG TY TNHH SX TM DV THẾ KỶ XANH',          'direct', null,                                        'nha_cung_cap', true),
  ('NCC-OMD',  'CÔNG TY TMĐT Ô MUA ĐI',                       'direct', null,                                        'nha_cung_cap', true),
  ('NCC-ABB',  'CÔNG TY CỔ PHẦN ABBY VIỆT NAM',               'direct', null,                                        'nha_cung_cap', true)
ON CONFLICT (code) DO NOTHING;

-- BƯỚC 2: Insert purchase_orders
INSERT INTO purchase_orders (
  po_num, status, platform, platform_order_id, supplier_id,
  shipping_fee, total_amount, staff_name,
  received_at, completed_at, created_at
)
SELECT
  po_num, status, platform, platform_order_id,
  (SELECT id FROM suppliers WHERE code = supplier_code LIMIT 1),
  shipping_fee, total_amount, 'admin',
  created_at, created_at, created_at
FROM (VALUES
  ('NH000001','completed','shopee','2603278FH1PQE0','NCC-PV',  0,      202960, '2026-03-27'),
  ('NH000002','completed','shopee','2603278FKB4M8X','NCC-CC',  0,      0,      '2026-03-27'),
  ('NH000003','completed','shopee','2603278FDH64QH','NCC-VH',  0,      257000, '2026-03-27'),
  ('NH000004','completed','shopee','2603278FM2XRCG','NCC-DK',  0,      251160, '2026-03-27'),
  ('NH000005','completed','shopee','2603278FJGE8UA','NCC-DP',  0,      91960,  '2026-03-27'),
  ('NH000006','completed','shopee','2603278FP2UQ2Q','NCC-HT',  0,      163400, '2026-03-27'),
  ('NH000007','completed','shopee','2603278FC1FH4Q','NCC-BB',  0,      46552,  '2026-03-27'),
  ('NH000008','completed','shopee','2603278FTD3S31','NCC-SM',  0,      58500,  '2026-03-27'),
  ('NH000009','completed','shopee','2604050HXYGGEP','NCC-DM',  19000,  291401, '2026-04-04'),
  ('NH000010','completed','shopee','2604050J53W306','NCC-TM',  0,      411840, '2026-04-04'),
  ('NH000011','completed','shopee','2604050J53W307','NCC-CK',  0,      116000, '2026-04-04'),
  ('NH000012','completed','shopee','2604050J53W305','NCC-PT',  0,      70200,  '2026-04-04'),
  ('NH000013','completed','shopee','2604050HTVT0BD','NCC-GK',  0,      105000, '2026-04-04'),
  ('NH000014','completed','shopee','2604050J53W302','NCC-NP',  0,      97500,  '2026-04-04'),
  ('NH000015','completed','shopee','2604050J53W303','NCC-HG',  16500,  100740, '2026-04-04'),
  ('NH000016','completed','shopee','2604050J53W304','NCC-LO',  0,      482820, '2026-04-04'),
  ('NH000017','completed','shopee','2604050HQE5Y35','NCC-HN',  0,      104000, '2026-04-04'),
  ('NH000018','completed','shopee','2604050J128V3J','NCC-PV',  0,      712200, '2026-04-04'),
  ('NH000019','completed','shopee','2604050HV8QA9R','NCC-GD',  4000,   770160, '2026-04-04'),
  ('NH000020','completed','direct',null,            null,      0,      453000, '2026-03-27'),
  ('NH000021','completed','direct',null,            null,      0,      85000,  '2026-03-27'),
  ('NH000022','completed','direct','HD004106',      'NCC-TRY', 0,      817000, '2026-04-06'),
  ('NH000023','completed','direct','BH02452',       'NCC-TKX', 30066,  1708000,'2026-04-07'),
  ('NH000024','completed','shopee','2604050HP82MJS','NCC-TRG', 13000,  603400, '2026-04-04'),
  ('NH000025','completed','direct',null,            null,      0,      2100000,'2026-04-04'),
  ('NH000026','completed','direct',null,            'NCC-OMD', 100000, 700000, '2026-04-08'),
  ('NH000027','completed','direct',null,            'NCC-ABB', 0,      52920,  '2026-04-08')
) AS t(po_num, status, platform, platform_order_id, supplier_code, shipping_fee, total_amount, created_at_str),
LATERAL (SELECT created_at_str::timestamptz AS created_at) d
ON CONFLICT (po_num) DO NOTHING;

-- BƯỚC 3: Insert po_adjustments (voucher/chiết khấu tổng đơn từ Shopee)
INSERT INTO po_adjustments (po_id, label, type, amount)
SELECT id, 'Voucher Shopee', 'discount', 33040  FROM purchase_orders WHERE po_num = 'NH000001' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 30000  FROM purchase_orders WHERE po_num = 'NH000002' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 50000  FROM purchase_orders WHERE po_num = 'NH000003' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 47840  FROM purchase_orders WHERE po_num = 'NH000004' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 12540  FROM purchase_orders WHERE po_num = 'NH000005' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 26600  FROM purchase_orders WHERE po_num = 'NH000006' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 6348   FROM purchase_orders WHERE po_num = 'NH000007' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 6500   FROM purchase_orders WHERE po_num = 'NH000008' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 51886  FROM purchase_orders WHERE po_num = 'NH000009' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 116160 FROM purchase_orders WHERE po_num = 'NH000010' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 19800  FROM purchase_orders WHERE po_num = 'NH000012' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 1500   FROM purchase_orders WHERE po_num = 'NH000013' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 27500  FROM purchase_orders WHERE po_num = 'NH000014' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 23760  FROM purchase_orders WHERE po_num = 'NH000015' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 136180 FROM purchase_orders WHERE po_num = 'NH000016' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 26000  FROM purchase_orders WHERE po_num = 'NH000017' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 178800 FROM purchase_orders WHERE po_num = 'NH000018' UNION ALL
SELECT id, 'Khuyến mãi tín dụng Shopee', 'discount', 3000 FROM purchase_orders WHERE po_num = 'NH000018' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 191540 FROM purchase_orders WHERE po_num = 'NH000019' UNION ALL
SELECT id, 'Chiết khấu', 'discount', 4        FROM purchase_orders WHERE po_num = 'NH000022' UNION ALL
SELECT id, 'Chiết khấu', 'discount', 1        FROM purchase_orders WHERE po_num = 'NH000023' UNION ALL
SELECT id, 'Thuế VAT', 'fee', 126519           FROM purchase_orders WHERE po_num = 'NH000023' UNION ALL
SELECT id, 'Voucher Shopee', 'discount', 147600 FROM purchase_orders WHERE po_num = 'NH000024' UNION ALL
SELECT id, 'Giảm giá', 'discount', 10000       FROM purchase_orders WHERE po_num = 'NH000024';

-- BƯỚC 4: Insert po_payments (tất cả đã thanh toán đủ)
INSERT INTO po_payments (po_id, amount, method, paid_at, note)
SELECT id, 202960,  'transfer', '2026-03-27'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000001' UNION ALL
SELECT id, 257000,  'transfer', '2026-03-27'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000003' UNION ALL
SELECT id, 251160,  'transfer', '2026-03-27'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000004' UNION ALL
SELECT id, 91960,   'transfer', '2026-03-27'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000005' UNION ALL
SELECT id, 163400,  'transfer', '2026-03-27'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000006' UNION ALL
SELECT id, 46552,   'transfer', '2026-03-27'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000007' UNION ALL
SELECT id, 58500,   'transfer', '2026-03-27'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000008' UNION ALL
SELECT id, 291401,  'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000009' UNION ALL
SELECT id, 411840,  'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000010' UNION ALL
SELECT id, 116000,  'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000011' UNION ALL
SELECT id, 70200,   'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000012' UNION ALL
SELECT id, 105000,  'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000013' UNION ALL
SELECT id, 97500,   'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000014' UNION ALL
SELECT id, 100740,  'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000015' UNION ALL
SELECT id, 482820,  'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000016' UNION ALL
SELECT id, 104000,  'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000017' UNION ALL
SELECT id, 712200,  'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000018' UNION ALL
SELECT id, 770160,  'transfer', '2026-04-04'::timestamptz, 'Shopee' FROM purchase_orders WHERE po_num = 'NH000019' UNION ALL
SELECT id, 453000,  'cash',     '2026-03-27'::timestamptz, 'Mua ngoài' FROM purchase_orders WHERE po_num = 'NH000020' UNION ALL
SELECT id, 85000,   'cash',     '2026-03-27'::timestamptz, 'Mua ngoài' FROM purchase_orders WHERE po_num = 'NH000021' UNION ALL
SELECT id, 817000,  'transfer', '2026-04-06'::timestamptz, 'HD004106' FROM purchase_orders WHERE po_num = 'NH000022' UNION ALL
SELECT id, 1708000, 'transfer', '2026-04-07'::timestamptz, 'BH02452'  FROM purchase_orders WHERE po_num = 'NH000023' UNION ALL
SELECT id, 603400,  'transfer', '2026-04-04'::timestamptz, 'Shopee'   FROM purchase_orders WHERE po_num = 'NH000024' UNION ALL
SELECT id, 2100000, 'cash',     '2026-04-04'::timestamptz, 'Mua ngoài' FROM purchase_orders WHERE po_num = 'NH000025' UNION ALL
SELECT id, 700000,  'transfer', '2026-04-08'::timestamptz, 'Mua ngoài' FROM purchase_orders WHERE po_num = 'NH000026' UNION ALL
SELECT id, 52920,   'transfer', '2026-04-08'::timestamptz, 'Mua ngoài' FROM purchase_orders WHERE po_num = 'NH000027';

-- BƯỚC 5: Insert purchase_order_items (chi tiết từng dòng hàng)
INSERT INTO purchase_order_items (
  po_id, item_type, item_id, item_name,
  input_qty, input_unit, sku_unit,
  conversion_rate, to_base_rate, base_qty, base_unit,
  unit_price, total_price,
  amount_before_discount, discount_amount, amount_after_discount
)
SELECT
  (SELECT id FROM purchase_orders WHERE po_num = po_num_ref),
  item_type, item_id, item_name,
  input_qty, input_unit, input_unit,
  to_base, to_base,
  input_qty * to_base, base_unit,
  unit_price, amt_after,
  amt_before, discount, amt_after
FROM (VALUES
  -- NH000001: Cà phê Robusta 1 túi=500g
  ('NH000001','raw','ca_phe_robusta','Túi cà phê Robusta xay vừa',         1,'Túi',  500,'g',  149000,149000,0,    149000),
  -- NH000001: Cà phê Phin Đậm 1 túi=500g
  ('NH000001','raw','ca_phe_phin_dam','Túi cà phê truyền thống Phin Đậm', 1,'Túi',  500,'g',  87000, 87000, 0,    87000),
  -- NH000002: Đường trắng 1 túi=1000g
  ('NH000002','raw','duong_trang',    'Đường trắng',                        1,'Túi', 1000,'g',  33000, 33000, 3000, 30000),
  -- NH000003: Muỗng định lượng 1 chiếc
  ('NH000003','supply','muong_dinh_luong','Muỗng nhựa định lượng 10g',     1,'Chiếc',1,'chiếc',22000, 22000, 0,    22000),
  -- NH000003: Máy đánh bọt 1 cái
  ('NH000003','supply','may_danh_bot','Máy đánh bọt cà phê, bọt sữa',     1,'Cái',  1,'cái',  350000,350000,65000,285000),
  -- NH000004: Bột cacao DK 1 túi=500g
  ('NH000004','raw','bot_cacao_dk',  'Túi bột cacao DK Harvest',            1,'Túi',  500,'g',  299000,299000,0,    299000),
  -- NH000005: Bột milk foam 1 túi=500g
  ('NH000005','raw','bot_milk_foam', 'Túi bột milk foam muối biển',         1,'Túi',  500,'g',  104500,104500,0,    104500),
  -- NH000006: Bột matcha cozy 1 túi=200g
  ('NH000006','raw','bot_matcha_cozy','Túi bột matcha trà xanh cozy',       1,'Túi',  200,'g',  190000,190000,0,    190000),
  -- NH000007: Combo ly+nắp 1 combo=50 cái ly + 50 cái nắp (insert 2 dòng riêng)
  ('NH000007','supply','ly',         'Combo ly + nắp nhựa PP - Ly',         50,'Cái', 1,'cái',  529,   26450, 0,    26450),
  ('NH000007','supply','nap',        'Combo ly + nắp nhựa PP - Nắp',        50,'Cái', 1,'cái',  529,   26450, 0,    26450),
  -- NH000008: Sữa đặc Vinamilk 1 hộp=1284g
  ('NH000008','raw','sua_dac_vinamilk','Sữa đặc Vinamilk',                  1,'Hộp', 1284,'g',  65000, 65000, 0,    65000),
  -- NH000009: Phích nước 1 cái
  ('NH000009','supply','phich_nuoc_2l','Phích nước nóng Rạng Đông 2L',     1,'Cái',  1,'cái',  324287,324287,0,    324287),
  -- NH000010: Bình thuỷ tinh 2 bình
  ('NH000010','supply','binh_thuy_tinh','Bình thuỷ tinh có bơm 1.3L',      2,'Bình', 1,'cái',  132000,264000,264000,528000),
  -- NH000011: Bình đựng nước 2 combo × 2 bình = 4 bình
  ('NH000011','supply','binh_nuoc_1l','Bình đựng nước 1L',                  4,'Bình', 1,'bình', 65000, 130000,14000,116000),
  -- NH000012: Ghế nhựa gấp 2 cái
  ('NH000012','supply','ghe_gap_ptluxury','Ghế nhựa gấp gọn PTLUXURY',     2,'Cái',  1,'cái',  50000, 100000,10000,90000),
  -- NH000013: Chai xịt 3 cái
  ('NH000013','supply','chai_xit_1l','Chai nhựa xịt 1L',                   3,'Chai', 1,'chai', 35500, 106500,0,    106500),
  -- NH000014: Ghế xếp inox 1 cái
  ('NH000014','supply','ghe_xep_inox','Ghế xếp inox',                      1,'Cái',  1,'cái',  210000,210000,85000,125000),
  -- NH000015: Găng tay 1 hộp=100 cái
  ('NH000015','supply','gang_tay_nitrile','Găng tay nitrile Hygi size L',  100,'Cái',1,'cái',  1155,  115500,7500, 108000),
  -- NH000016: Thùng đá combo (11L + 25L)
  ('NH000016','supply','thung_da_11l','Thùng đá 11L',                      1,'Thùng',1,'thùng',475000,475000,165500,309500),
  ('NH000016','supply','thung_da_25l','Thùng đá 25L',                      1,'Thùng',1,'thùng',475000,475000,165500,309500),
  -- NH000017: Túi bạt 2 cái
  ('NH000017','supply','tui_bat',    'Túi bạt 50x25x46cm',                 2,'Cái',  1,'cái',  65000, 130000,0,    130000),
  -- NH000018: Cà phê Robusta combo 2 × 3 = 6 túi = 3000g
  ('NH000018','raw','ca_phe_robusta','Túi cà phê Robusta xay vừa (Combo2)',6,'Túi',  500,'g',  149000,894000,0,    894000),
  -- NH000018: Sữa đặc Ngôi Sao 1 hộp=380g (giá 0 - tặng kèm)
  ('NH000018','raw','sua_dac_ngoisao','Sữa đặc Ngôi Sao Phương Nam 380g', 1,'Hộp',  380,'g',  0,     0,     0,    0),
  -- NH000019: Khăn lau combo 10 = 10 cái
  ('NH000019','supply','khan_lau',   'Khăn lau đa năng',                   10,'Cái', 1,'cái',  2030,  20300, 0,    20300),
  -- NH000019: Cây đánh bọt 1 cái
  ('NH000019','supply','cay_danh_bot','Cây đánh bọt cà phê thủ công',      1,'Cái',  1,'cái',  22600, 22600, 0,    22600),
  -- NH000019: Túi rác túi 3 cuộn
  ('NH000019','supply','tui_rac_sinh_hoc','Túi rác sinh học size trung',   3,'Cuộn', 1,'cuộn', 13200, 39600, 0,    39600),
  -- NH000019: Muỗng pha chế 2 chiếc
  ('NH000019','supply','muong_pha_che','Muỗng pha chế 26cm',               2,'Chiếc',1,'chiếc',20100, 40200, 0,    40200),
  -- NH000019: Dao Kava 1 chiếc
  ('NH000019','supply','dao_kava',   'Dao Kava Eagle Thái Lan 10cm',        1,'Chiếc',1,'chiếc',40500, 40500, 0,    40500),
  -- NH000019: Ca nhựa 2L x2
  ('NH000019','supply','ca_nhua_2l', 'Ca nhựa trong 2L',                   2,'Cái',  1,'cái',  35000, 70000, 0,    70000),
  -- NH000019: Kéo đa năng 1 cây
  ('NH000019','supply','keo_da_nang','Kéo đa năng',                        1,'Cây',  1,'cây',  76300, 76300, 0,    76300),
  -- NH000019: Cây xúc đá 1 cây
  ('NH000019','supply','cay_xuc_da', 'Cây xúc đá',                         1,'Cây',  1,'cây',  79500, 79500, 0,    79500),
  -- NH000019: Tạp dề 2 cái
  ('NH000019','supply','tap_de',     'Tạp dề',                              2,'Cái',  1,'cái',  85000, 170000,0,    170000),
  -- NH000019: Phin lớn 3 cái
  ('NH000019','supply','phin_lon',   'Phin cà phê lớn',                    3,'Cái',  1,'cái',  132900,398700,0,    398700),
  -- NH000020: Ca nhựa 1.5L x2
  ('NH000020','supply','ca_nhua_15l','Ca nhựa 1.5L',                       2,'Cái',  1,'cái',  25000, 50000, 0,    50000),
  -- NH000020: Ca nhựa 2L x1
  ('NH000020','supply','ca_nhua_2l_b','Ca nhựa 2L',                        1,'Cái',  1,'cái',  30000, 30000, 0,    30000),
  -- NH000020: Ca đong 500ml x1
  ('NH000020','supply','ca_dong_500ml','Ca đong 500ml',                    1,'Cái',  1,'cái',  45000, 45000, 0,    45000),
  -- NH000020: Phin lớn x1
  ('NH000020','supply','phin_lon_b', 'Phin lớn',                           1,'Cái',  1,'cái',  135000,135000,0,    135000),
  -- NH000020: Phin vừa x1
  ('NH000020','supply','phin_vua',   'Phin vừa',                           1,'Cái',  1,'cái',  75000, 75000, 0,    75000),
  -- NH000020: Cốc đong 100ml x2
  ('NH000020','supply','coc_dong_100ml','Cốc đong 100ml nhựa',             2,'Cái',  1,'cái',  12500, 25000, 0,    25000),
  -- NH000020: Máy đánh trứng x1
  ('NH000020','supply','may_danh_trung','Máy đánh trứng cầm tay',          1,'Cái',  1,'cái',  93000, 93000, 0,    93000),
  -- NH000021: Sữa tươi TH 1 hộp=1000ml
  ('NH000021','raw','sua_tuoi_th',   'Sữa tươi TH True Milk',              1,'Hộp', 1000,'ml', 50000, 50000, 0,    50000),
  -- NH000021: Sữa tươi Mlekovita 1 hộp=1000ml
  ('NH000021','raw','sua_tuoi_mlekovita','Sữa tươi MLEKOVITA',             1,'Hộp', 1000,'ml', 35000, 35000, 0,    35000),
  -- NH000022: Sữa đặc La rosee 5 lon=5000g
  ('NH000022','raw','sua_dac_larosee','Sữa đặc La rosee 1000g',            5,'Lon', 1000,'g',  42000, 210000,0,    210000),
  -- NH000022: Sữa tươi Mlekovita 1 thùng=12000ml
  ('NH000022','raw','sua_tuoi_mlekovita','Sữa tươi MLEKOVITA',             1,'Thùng',12000,'ml',329004,329004,0,  329004),
  -- NH000022: Bột matcha cozy 2 túi=400g
  ('NH000022','raw','bot_matcha_cozy','Túi bột matcha trà xanh cozy',      2,'Túi',  200,'g',  139000,278000,0,    278000),
  -- NH000023: Nắp PET 98 1000 cái
  ('NH000023','supply','nap_pet98',  'Nắp nhựa PET 98',                   1000,'Cái',1,'cái',  321,   321000,0,    321000),
  -- NH000023: Ly PET 98 1000 cái
  ('NH000023','supply','ly_pet98_16oz','Ly nhựa PET 98 - 16OZ',           1000,'Cái',1,'cái',  629,   629000,0,    629000),
  -- NH000023: Ống hút 2kg=1000 ống
  ('NH000023','supply','ong_hut_den_zin','Ống hút ĐEN ZIN P6x21',         1000,'Cái',1,'cái',  118,   117600,0,    117600),
  -- NH000023: Muỗng đen 1000 cái
  ('NH000023','supply','muong_den_15','Muỗng nhựa màu đen 15cm',          1000,'Cái',1,'cái',  144,   144000,0,    144000),
  -- NH000023: Túi chữ T 2kg=1100 túi
  ('NH000023','supply','tui_chu_t',  'Túi Chữ T 12.5x26',                 1100,'Cái',1,'cái',  131,   144000,0,    144000),
  -- NH000023: Túi đôi PE 2kg=180 túi
  ('NH000023','supply','tui_doi_pe', 'Túi PE 2 Ly Seal Ép Ngăn',           180,'Cái',1,'cái',  713,   128400,0,    128400),
  -- NH000023: Giấy lót 2 xấp=1000 tấm
  ('NH000023','supply','giay_lot_ccw130','Giấy lót chống tràn CCW130',    1000,'Tấm',1,'tấm',  67,    67416, 0,    67416),
  -- NH000024: Túi lọc 2 túi
  ('NH000024','supply','tui_loc_m',  'Túi lọc đa năng size M',             2,'Túi',  1,'cái',  20000, 40000, 0,    40000),
  -- NH000024: Cốc đong 250ml x2
  ('NH000024','supply','coc_dong_250ml','Cốc đong định lượng 250ml',       2,'Cái',  1,'cái',  30000, 60000, 14000,46000),
  -- NH000024: Hộp đựng bột 1.5L x1
  ('NH000024','supply','hop_nhua_bot','Hộp nhựa đựng bột 1.5L',           1,'Hộp',  1,'hộp',  80000, 80000, 32000,48000),
  -- NH000024: Thảm bar x1
  ('NH000024','supply','tham_bar',   'Thảm bar pha chế 30x40cm',           1,'Cái',  1,'cái',  75000, 75000, 0,    75000),
  -- NH000024: Hũ rắc bột x2
  ('NH000024','supply','hu_rac_bot', 'Hũ rắc bột',                         2,'Cái',  1,'cái',  60000, 120000,28000,92000),
  -- NH000024: Cân tiểu ly x1
  ('NH000024','supply','can_tieu_ly','Cân tiểu ly',                        1,'Cái',  1,'cái',  150000,150000,51000,99000),
  -- NH000024: Khay kệ ly x1
  ('NH000024','supply','khay_ke_ly', 'Khay kệ đựng ly, ống hút',           1,'Cái',  1,'cái',  450000,450000,102000,348000),
  -- NH000025: Xe cà phê lưu động 1 chiếc → vào assets không vào supplies
  -- NH000025 sẽ xử lý riêng ở bước 6
  -- NH000026: Kệ 2 tầng x1
  ('NH000026','supply','ke_2_tang',  'Kệ 2 tầng',                          1,'Cái',  1,'cái',  250000,250000,0,    250000),
  -- NH000026: Thảm 30x45 x1
  ('NH000026','supply','tham_30x45', 'Thảm 30x45cm',                       1,'Cái',  1,'cái',  60000, 60000, 0,    60000),
  -- NH000026: Cốc đong 100ml x2
  ('NH000026','supply','coc_dong_100ml','Cốc đong 100ml',                  2,'Cái',  1,'cái',  15000, 30000, 0,    30000),
  -- NH000026: Cân tiểu ly x1
  ('NH000026','supply','can_tieu_ly','Cân tiểu ly',                        1,'Cái',  1,'cái',  100000,100000,0,    100000),
  -- NH000026: Hũ rắc bột x2
  ('NH000026','supply','hu_rac_bot', 'Hũ rắc bột',                         2,'Cái',  1,'cái',  36000, 72000, 0,    72000),
  -- NH000026: Hộp đựng bột x1
  ('NH000026','supply','hop_nhua_bot','Hộp nhựa đựng bột 1.5L',           1,'Hộp',  1,'hộp',  46000, 46000, 0,    46000),
  -- NH000026: Vợt lọc inox x1
  ('NH000026','supply','vot_loc_inox','Vợt lọc cán inox size trung',       1,'Cái',  1,'cái',  42000, 42000, 0,    42000),
  -- NH000027: Phới đánh trứng x1
  ('NH000027','supply','phoi_trung_inox','Phới đánh trứng inox 28cm',      1,'Cái',  1,'cái',  20520, 20520, 0,    20520),
  -- NH000027: Cốc đong 250ml x2
  ('NH000027','supply','coc_dong_250ml_b','Cốc đong 250ml',                2,'Cái',  1,'cái',  16200, 32400, 0,    32400)
) AS t(po_num_ref, item_type, item_id, item_name, input_qty, input_unit, to_base, base_unit, unit_price, amt_before, discount, amt_after);

-- BƯỚC 6: Cập nhật tồn kho raw_stock từ các đơn nguyên liệu
-- Tính giá vốn BQ gia quyền cho từng nguyên liệu
WITH raw_totals AS (
  SELECT
    item_id,
    SUM(base_qty) AS total_qty,
    SUM(amount_after_discount) AS total_cost
  FROM purchase_order_items
  WHERE item_type = 'raw'
  GROUP BY item_id
)
INSERT INTO raw_stock (id, quantity, avg_cost, total_qty_imported, updated_at)
SELECT
  item_id,
  total_qty,
  CASE WHEN total_qty > 0 THEN total_cost::numeric / total_qty ELSE 0 END,
  total_qty,
  NOW()
FROM raw_totals
ON CONFLICT (id) DO UPDATE SET
  quantity           = raw_stock.quantity + EXCLUDED.quantity,
  avg_cost           = CASE
    WHEN (raw_stock.quantity + EXCLUDED.quantity) > 0
    THEN (raw_stock.avg_cost * raw_stock.quantity + EXCLUDED.avg_cost * EXCLUDED.quantity)
         / (raw_stock.quantity + EXCLUDED.quantity)
    ELSE 0 END,
  total_qty_imported = raw_stock.total_qty_imported + EXCLUDED.total_qty_imported,
  updated_at         = NOW();

-- BƯỚC 7: Cập nhật tồn kho supplies từ các đơn vật tư/dụng cụ
WITH supply_totals AS (
  SELECT item_id, SUM(base_qty) AS total_qty
  FROM purchase_order_items
  WHERE item_type IN ('supply','equipment')
  GROUP BY item_id
)
UPDATE supplies s
SET quantity   = s.quantity + st.total_qty,
    updated_at = NOW()
FROM supply_totals st
WHERE s.id = st.item_id;

-- BƯỚC 8: Insert tài sản xe cà phê lưu động từ NH000025
INSERT INTO assets (
  asset_code, name, asset_type, purchase_price,
  purchase_date, status, note, active
)
SELECT
  'TS-001',
  'Xe cà phê lưu động',
  'Phương tiện',
  2100000,
  '2026-04-04',
  'active',
  'Nhập từ đơn NH000025',
  true
WHERE NOT EXISTS (SELECT 1 FROM assets WHERE asset_code = 'TS-001');
