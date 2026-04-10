-- ĐÃ KIỂM TRA: chạy sau Migration 004
-- Migration 007: Seed SKU items từ danh sách sản phẩm thực tế

-- BƯỚC 1: Thêm raw_materials mới (nếu chưa có)
INSERT INTO raw_materials (id, name, icon, unit, warn_at, color) VALUES
  ('ca_phe_robusta',    'Cà phê Robusta xay vừa',        '☕', 'g',   500,  '#FAEEDA'),
  ('ca_phe_phin_dam',   'Cà phê truyền thống Phin Đậm',  '☕', 'g',   500,  '#FAEEDA'),
  ('duong_trang',       'Đường trắng',                    '🍬', 'g',   500,  '#FAEEDA'),
  ('bot_cacao_dk',      'Bột cacao DK Harvest',           '🍫', 'g',   200,  '#BA751730'),
  ('bot_milk_foam',     'Bột milk foam muối biển',        '🧂', 'g',   200,  '#B5D4F440'),
  ('bot_matcha_cozy',   'Bột matcha trà xanh cozy',      '🍵', 'g',   100,  '#C0DD9740'),
  ('sua_dac_vinamilk',  'Sữa đặc Vinamilk',               '🥛', 'g',   300,  '#FAC77540'),
  ('sua_dac_ngoisao',   'Sữa đặc Ngôi Sao Phương Nam',   '🥛', 'g',   300,  '#FAC77540'),
  ('sua_dac_larosee',   'Sữa đặc La rosee',               '🥛', 'g',   300,  '#FAC77540'),
  ('sua_tuoi_th',       'Sữa tươi TH True Milk',          '🍼', 'ml',  500,  '#E6F1FB'),
  ('sua_tuoi_mlekovita','Sữa tươi MLEKOVITA',             '🍼', 'ml',  500,  '#E6F1FB')
ON CONFLICT (id) DO NOTHING;

-- BƯỚC 2: Thêm supplies (vật tư tiêu hao) mới
INSERT INTO supplies (id, name, category, unit, quantity, warn_at) VALUES
  ('nap_pet98',         'Nắp nhựa PET 98',                'consumable', 'cái',   0, 50),
  ('ly_pet98_16oz',     'Ly nhựa PET 98 - 16OZ',          'consumable', 'cái',   0, 50),
  ('ong_hut_den_zin',   'Ống hút ĐEN ZIN nhọn P6x21',     'consumable', 'cái',   0, 50),
  ('muong_den_15',      'Muỗng nhựa màu đen 15cm',        'consumable', 'cái',   0, 30),
  ('tui_chu_t',         'Túi Chữ T 12.5x26',              'consumable', 'cái',   0, 30),
  ('tui_doi_pe',        'Túi PE 2 Ly Seal Ép Ngăn',       'consumable', 'cái',   0, 20),
  ('giay_lot_ccw130',   'Giấy lót chống tràn CCW130',     'consumable', 'tấm',   0, 100),
  ('gang_tay_nitrile',  'Găng tay nitrile Hygi size L',   'consumable', 'cái',   0, 20),
  ('khan_lau',          'Khăn lau đa năng',               'consumable', 'cái',   0, 10),
  ('tui_rac_sinh_hoc',  'Túi rác sinh học size trung',    'consumable', 'cuộn',  0, 5),
  ('tui_loc_m',         'Túi lọc đa năng size M 20x30cm', 'consumable', 'cái',   0, 10)
ON CONFLICT (id) DO NOTHING;

-- BƯỚC 3: Thêm supplies (công cụ dụng cụ/thiết bị)
INSERT INTO supplies (id, name, category, unit, quantity, warn_at) VALUES
  ('muong_dinh_luong',  'Muỗng nhựa định lượng 10g',      'equipment', 'chiếc', 0, 0),
  ('may_danh_bot',      'Máy đánh bọt cà phê, bọt sữa',  'equipment', 'cái',   0, 0),
  ('phich_nuoc_2l',     'Phích nước nóng Rạng Đông 2L',   'equipment', 'cái',   0, 0),
  ('binh_thuy_tinh',    'Bình thuỷ tinh có bơm 1.3L',     'equipment', 'bình',  0, 0),
  ('binh_nuoc_1l',      'Bình đựng nước 1L',              'equipment', 'bình',  0, 0),
  ('ghe_gap_ptluxury',  'Ghế nhựa gấp gọn PTLUXURY',     'equipment', 'cái',   0, 0),
  ('ghe_xep_inox',      'Ghế xếp inox',                   'equipment', 'cái',   0, 0),
  ('chai_xit_1l',       'Chai nhựa xịt 1L',               'equipment', 'chai',  0, 0),
  ('tui_bat',           'Túi bạt 50x25x46cm',             'equipment', 'cái',   0, 0),
  ('thung_da_11l',      'Thùng đá 11L',                   'equipment', 'thùng', 0, 0),
  ('thung_da_25l',      'Thùng đá 25L',                   'equipment', 'thùng', 0, 0),
  ('ca_nhua_2l',        'Ca nhựa trong 2L',               'equipment', 'cái',   0, 0),
  ('ca_nhua_15l',       'Ca nhựa 1.5L',                   'equipment', 'cái',   0, 0),
  ('ca_nhua_2l_b',      'Ca nhựa 2L',                     'equipment', 'cái',   0, 0),
  ('ca_dong_500ml',     'Ca đong 500ml',                   'equipment', 'cái',   0, 0),
  ('coc_dong_100ml',    'Cốc đong 100ml nhựa',            'equipment', 'cái',   0, 0),
  ('coc_dong_250ml',    'Cốc đong 250ml',                 'equipment', 'cái',   0, 0),
  ('coc_dong_250ml_b',  'Cốc đong định lượng 250ml',      'equipment', 'cái',   0, 0),
  ('phin_lon',          'Phin cà phê lớn',                'equipment', 'cái',   0, 0),
  ('phin_vua',          'Phin vừa',                        'equipment', 'cái',   0, 0),
  ('phin_lon_b',        'Phin lớn',                        'equipment', 'cái',   0, 0),
  ('may_danh_trung',    'Máy đánh trứng cầm tay',         'equipment', 'cái',   0, 0),
  ('cay_danh_bot',      'Cây đánh bọt cà phê thủ công',  'equipment', 'cái',   0, 0),
  ('muong_pha_che',     'Muỗng pha chế 26cm',             'equipment', 'chiếc', 0, 0),
  ('dao_kava',          'Dao Kava Eagle Thái Lan 10cm',   'equipment', 'chiếc', 0, 0),
  ('keo_da_nang',       'Kéo đa năng',                    'equipment', 'cây',   0, 0),
  ('cay_xuc_da',        'Cây xúc đá',                     'equipment', 'cây',   0, 0),
  ('tap_de',            'Tạp dề',                         'equipment', 'cái',   0, 0),
  ('hop_nhua_bot',      'Hộp nhựa đựng bột 1.5L',        'equipment', 'hộp',   0, 0),
  ('tham_bar',          'Thảm bar pha chế 30x40cm',       'equipment', 'cái',   0, 0),
  ('tham_30x45',        'Thảm 30x45cm',                   'equipment', 'cái',   0, 0),
  ('hu_rac_bot',        'Hũ rắc bột',                     'equipment', 'cái',   0, 0),
  ('can_tieu_ly',       'Cân tiểu ly',                    'equipment', 'cái',   0, 0),
  ('khay_ke_ly',        'Khay kệ đựng ly, ống hút',       'equipment', 'cái',   0, 0),
  ('ke_2_tang',         'Kệ 2 tầng',                      'equipment', 'cái',   0, 0),
  ('vot_loc_inox',      'Vợt lọc cán inox size trung',   'equipment', 'cái',   0, 0),
  ('phoi_trung_inox',   'Phới đánh trứng inox 28cm',      'equipment', 'cái',   0, 0)
ON CONFLICT (id) DO NOTHING;

-- BƯỚC 4: Seed sku_items (SKU theo thương hiệu/đóng gói)
INSERT INTO sku_items (sku_code, name, type, map_to_id, map_to_type, base_unit) VALUES
  -- Nguyên liệu cà phê
  ('NVL-CF-001', 'Cà phê Robusta xay vừa 500g',        'raw', 'ca_phe_robusta',     'raw', 'g'),
  ('NVL-CF-002', 'Cà phê truyền thống Phin Đậm 500g',  'raw', 'ca_phe_phin_dam',    'raw', 'g'),
  ('NVL-DT-001', 'Đường trắng 1kg',                    'raw', 'duong_trang',         'raw', 'g'),
  ('NVL-CA-001', 'Bột cacao DK Harvest 500g',           'raw', 'bot_cacao_dk',        'raw', 'g'),
  ('NVL-MF-001', 'Bột milk foam muối biển 500g',        'raw', 'bot_milk_foam',       'raw', 'g'),
  ('NVL-MT-001', 'Bột matcha trà xanh cozy 200g',       'raw', 'bot_matcha_cozy',     'raw', 'g'),
  -- Sữa đặc
  ('NVL-SD-001', 'Sữa đặc Vinamilk 1284g (Hộp)',        'raw', 'sua_dac_vinamilk',    'raw', 'g'),
  ('NVL-SD-002', 'Sữa đặc Ngôi Sao Phương Nam 380g',   'raw', 'sua_dac_ngoisao',     'raw', 'g'),
  ('NVL-SD-003', 'Sữa đặc La rosee 1000g (Lon)',        'raw', 'sua_dac_larosee',     'raw', 'g'),
  -- Sữa tươi
  ('NVL-ST-001', 'Sữa tươi TH True Milk 1000ml (Hộp)', 'raw', 'sua_tuoi_th',         'raw', 'ml'),
  ('NVL-ST-002', 'Sữa tươi MLEKOVITA 1000ml (Hộp)',    'raw', 'sua_tuoi_mlekovita',  'raw', 'ml'),
  -- Vật tư tiêu hao
  ('VTU-LY-001', 'Ly nhựa PET 98 - 16OZ (Cái)',         'supply', 'ly_pet98_16oz',    'supply', 'cái'),
  ('VTU-NP-001', 'Nắp nhựa PET 98 (Cái)',               'supply', 'nap_pet98',         'supply', 'cái'),
  ('VTU-OH-001', 'Ống hút ĐEN ZIN P6x21 (Ống)',         'supply', 'ong_hut_den_zin',   'supply', 'cái'),
  ('VTU-OH-002', 'Ống hút ĐEN ZIN P6x21 (Kg=500 ống)', 'supply', 'ong_hut_den_zin',   'supply', 'cái'),
  ('VTU-MG-001', 'Muỗng nhựa màu đen 15cm (Cái)',       'supply', 'muong_den_15',      'supply', 'cái'),
  ('VTU-TT-001', 'Túi Chữ T 12.5x26 2kg (Túi)',         'supply', 'tui_chu_t',         'supply', 'cái'),
  ('VTU-TT-002', 'Túi Chữ T 12.5x26 2kg (Kg=550 túi)', 'supply', 'tui_chu_t',         'supply', 'cái'),
  ('VTU-TD-001', 'Túi PE 2 Ly Seal Ép Ngăn (Túi)',      'supply', 'tui_doi_pe',        'supply', 'cái'),
  ('VTU-TD-002', 'Túi PE 2 Ly Seal Ép Ngăn (Kg=90t)',  'supply', 'tui_doi_pe',        'supply', 'cái'),
  ('VTU-GL-001', 'Giấy lót chống tràn CCW130 (Tấm)',    'supply', 'giay_lot_ccw130',   'supply', 'tấm'),
  ('VTU-GL-002', 'Giấy lót chống tràn CCW130 (Xấp)',    'supply', 'giay_lot_ccw130',   'supply', 'tấm'),
  ('VTU-GT-001', 'Găng tay nitrile Hygi size L (Cái)',  'supply', 'gang_tay_nitrile',  'supply', 'cái'),
  ('VTU-GT-002', 'Găng tay nitrile Hygi size L (Hộp)', 'supply', 'gang_tay_nitrile',  'supply', 'cái'),
  ('VTU-KL-001', 'Khăn lau đa năng (Cái)',              'supply', 'khan_lau',           'supply', 'cái'),
  ('VTU-KL-002', 'Khăn lau đa năng (Combo 10)',         'supply', 'khan_lau',           'supply', 'cái'),
  ('VTU-TR-001', 'Túi rác sinh học size trung (Cuộn)',  'supply', 'tui_rac_sinh_hoc',  'supply', 'cuộn'),
  ('VTU-TR-002', 'Túi rác sinh học size trung (Túi)',   'supply', 'tui_rac_sinh_hoc',  'supply', 'cuộn'),
  ('VTU-TL-001', 'Túi lọc đa năng size M (Túi)',        'supply', 'tui_loc_m',          'supply', 'cái'),
  -- Công cụ dụng cụ
  ('CCU-MD-001', 'Muỗng nhựa định lượng 10g (Chiếc)',  'equipment', 'muong_dinh_luong','supply', 'chiếc'),
  ('CCU-MD-002', 'Muỗng nhựa định lượng 10g (Combo 5)','equipment', 'muong_dinh_luong','supply', 'chiếc'),
  ('CCU-MB-001', 'Máy đánh bọt cà phê, bọt sữa',       'equipment', 'may_danh_bot',    'supply', 'cái'),
  ('CCU-PN-001', 'Phích nước nóng Rạng Đông 2L',        'equipment', 'phich_nuoc_2l',   'supply', 'cái'),
  ('CCU-BT-001', 'Bình thuỷ tinh có bơm 1.3L',          'equipment', 'binh_thuy_tinh',  'supply', 'bình'),
  ('CCU-BN-001', 'Bình đựng nước 1L',                   'equipment', 'binh_nuoc_1l',    'supply', 'bình'),
  ('CCU-GH-001', 'Ghế nhựa gấp gọn PTLUXURY',           'equipment', 'ghe_gap_ptluxury','supply', 'cái'),
  ('CCU-GH-002', 'Ghế xếp inox',                        'equipment', 'ghe_xep_inox',    'supply', 'cái'),
  ('CCU-CX-001', 'Chai nhựa xịt 1L',                    'equipment', 'chai_xit_1l',     'supply', 'chai'),
  ('CCU-TB-001', 'Túi bạt 50x25x46cm',                  'equipment', 'tui_bat',          'supply', 'cái'),
  ('CCU-TD-001', 'Thùng đá 11L',                        'equipment', 'thung_da_11l',     'supply', 'thùng'),
  ('CCU-TD-002', 'Thùng đá 25L',                        'equipment', 'thung_da_25l',     'supply', 'thùng'),
  ('CCU-CN-001', 'Ca nhựa trong 2L',                    'equipment', 'ca_nhua_2l',       'supply', 'cái'),
  ('CCU-CN-002', 'Ca nhựa 1.5L',                        'equipment', 'ca_nhua_15l',      'supply', 'cái'),
  ('CCU-CN-003', 'Ca nhựa 2L',                          'equipment', 'ca_nhua_2l_b',     'supply', 'cái'),
  ('CCU-CD-001', 'Ca đong 500ml',                        'equipment', 'ca_dong_500ml',    'supply', 'cái'),
  ('CCU-CK-001', 'Cốc đong 100ml nhựa',                 'equipment', 'coc_dong_100ml',   'supply', 'cái'),
  ('CCU-CK-002', 'Cốc đong 250ml',                      'equipment', 'coc_dong_250ml',   'supply', 'cái'),
  ('CCU-CK-003', 'Cốc đong định lượng 250ml',           'equipment', 'coc_dong_250ml_b', 'supply', 'cái'),
  ('CCU-PH-001', 'Phin cà phê lớn',                     'equipment', 'phin_lon',         'supply', 'cái'),
  ('CCU-PH-002', 'Phin vừa',                             'equipment', 'phin_vua',         'supply', 'cái'),
  ('CCU-MT-001', 'Máy đánh trứng cầm tay',              'equipment', 'may_danh_trung',   'supply', 'cái'),
  ('CCU-DB-001', 'Cây đánh bọt cà phê thủ công',        'equipment', 'cay_danh_bot',     'supply', 'cái'),
  ('CCU-MP-001', 'Muỗng pha chế 26cm',                  'equipment', 'muong_pha_che',    'supply', 'chiếc'),
  ('CCU-DK-001', 'Dao Kava Eagle Thái Lan 10cm',         'equipment', 'dao_kava',         'supply', 'chiếc'),
  ('CCU-KE-001', 'Kéo đa năng',                         'equipment', 'keo_da_nang',      'supply', 'cây'),
  ('CCU-XD-001', 'Cây xúc đá',                          'equipment', 'cay_xuc_da',       'supply', 'cây'),
  ('CCU-TP-001', 'Tạp dề',                               'equipment', 'tap_de',           'supply', 'cái'),
  ('CCU-HN-001', 'Hộp nhựa đựng bột 1.5L',              'equipment', 'hop_nhua_bot',     'supply', 'hộp'),
  ('CCU-TB-002', 'Thảm bar pha chế 30x40cm',             'equipment', 'tham_bar',         'supply', 'cái'),
  ('CCU-TM-001', 'Thảm 30x45cm',                        'equipment', 'tham_30x45',       'supply', 'cái'),
  ('CCU-HR-001', 'Hũ rắc bột',                          'equipment', 'hu_rac_bot',        'supply', 'cái'),
  ('CCU-CL-001', 'Cân tiểu ly',                         'equipment', 'can_tieu_ly',       'supply', 'cái'),
  ('CCU-KK-001', 'Khay kệ đựng ly, ống hút',            'equipment', 'khay_ke_ly',        'supply', 'cái'),
  ('CCU-KT-001', 'Kệ 2 tầng',                           'equipment', 'ke_2_tang',         'supply', 'cái'),
  ('CCU-VL-001', 'Vợt lọc cán inox size trung',         'equipment', 'vot_loc_inox',      'supply', 'cái'),
  ('CCU-PI-001', 'Phới đánh trứng inox 28cm',           'equipment', 'phoi_trung_inox',   'supply', 'cái')
ON CONFLICT (sku_code) DO NOTHING;

-- BƯỚC 5: Seed sku_units (đơn vị tính quy đổi)
INSERT INTO sku_units (sku_id, unit_name, to_base, description)
SELECT id, 'túi',    500,  '1 túi = 500g'   FROM sku_items WHERE sku_code = 'NVL-CF-001' UNION ALL
SELECT id, 'g',      1,    '1g = 1g'        FROM sku_items WHERE sku_code = 'NVL-CF-001' UNION ALL
SELECT id, 'túi',    500,  '1 túi = 500g'   FROM sku_items WHERE sku_code = 'NVL-CF-002' UNION ALL
SELECT id, 'g',      1,    '1g = 1g'        FROM sku_items WHERE sku_code = 'NVL-CF-002' UNION ALL
SELECT id, 'túi',    1000, '1 túi = 1000g'  FROM sku_items WHERE sku_code = 'NVL-DT-001' UNION ALL
SELECT id, 'g',      1,    '1g = 1g'        FROM sku_items WHERE sku_code = 'NVL-DT-001' UNION ALL
SELECT id, 'túi',    500,  '1 túi = 500g'   FROM sku_items WHERE sku_code = 'NVL-CA-001' UNION ALL
SELECT id, 'g',      1,    '1g = 1g'        FROM sku_items WHERE sku_code = 'NVL-CA-001' UNION ALL
SELECT id, 'túi',    500,  '1 túi = 500g'   FROM sku_items WHERE sku_code = 'NVL-MF-001' UNION ALL
SELECT id, 'g',      1,    '1g = 1g'        FROM sku_items WHERE sku_code = 'NVL-MF-001' UNION ALL
SELECT id, 'túi',    200,  '1 túi = 200g'   FROM sku_items WHERE sku_code = 'NVL-MT-001' UNION ALL
SELECT id, 'g',      1,    '1g = 1g'        FROM sku_items WHERE sku_code = 'NVL-MT-001' UNION ALL
SELECT id, 'hộp',   1284,  '1 hộp = 1284g'  FROM sku_items WHERE sku_code = 'NVL-SD-001' UNION ALL
SELECT id, 'g',      1,    '1g = 1g'        FROM sku_items WHERE sku_code = 'NVL-SD-001' UNION ALL
SELECT id, 'hộp',   380,   '1 hộp = 380g'   FROM sku_items WHERE sku_code = 'NVL-SD-002' UNION ALL
SELECT id, 'g',      1,    '1g = 1g'        FROM sku_items WHERE sku_code = 'NVL-SD-002' UNION ALL
SELECT id, 'lon',    1000,  '1 lon = 1000g'  FROM sku_items WHERE sku_code = 'NVL-SD-003' UNION ALL
SELECT id, 'thùng', 24000, '1 thùng = 24 lon × 1000g' FROM sku_items WHERE sku_code = 'NVL-SD-003' UNION ALL
SELECT id, 'g',      1,    '1g = 1g'        FROM sku_items WHERE sku_code = 'NVL-SD-003' UNION ALL
SELECT id, 'hộp',   1000,  '1 hộp = 1000ml' FROM sku_items WHERE sku_code = 'NVL-ST-001' UNION ALL
SELECT id, 'ml',     1,    '1ml = 1ml'      FROM sku_items WHERE sku_code = 'NVL-ST-001' UNION ALL
SELECT id, 'hộp',   1000,  '1 hộp = 1000ml' FROM sku_items WHERE sku_code = 'NVL-ST-002' UNION ALL
SELECT id, 'thùng', 12000, '1 thùng = 12 hộp × 1000ml' FROM sku_items WHERE sku_code = 'NVL-ST-002' UNION ALL
SELECT id, 'ml',     1,    '1ml = 1ml'      FROM sku_items WHERE sku_code = 'NVL-ST-002' UNION ALL
SELECT id, 'kg',     500,  '1 kg = 500 ống' FROM sku_items WHERE sku_code = 'VTU-OH-002' UNION ALL
SELECT id, 'kg',     550,  '1 kg = 550 túi' FROM sku_items WHERE sku_code = 'VTU-TT-002' UNION ALL
SELECT id, 'kg',     90,   '1 kg = 90 túi'  FROM sku_items WHERE sku_code = 'VTU-TD-002' UNION ALL
SELECT id, 'xấp',   500,  '1 xấp = 500 tấm' FROM sku_items WHERE sku_code = 'VTU-GL-002' UNION ALL
SELECT id, 'hộp',   100,  '1 hộp = 100 cái' FROM sku_items WHERE sku_code = 'VTU-GT-002' UNION ALL
SELECT id, 'combo', 10,   '1 combo = 10 cái' FROM sku_items WHERE sku_code = 'VTU-KL-002' UNION ALL
SELECT id, 'túi',   3,    '1 túi = 3 cuộn'  FROM sku_items WHERE sku_code = 'VTU-TR-002' UNION ALL
SELECT id, 'combo', 5,    '1 combo = 5 chiếc' FROM sku_items WHERE sku_code = 'CCU-MD-002' UNION ALL
SELECT id, 'combo', 2,    '1 combo = 2 bình' FROM sku_items WHERE sku_code = 'CCU-BN-001';
