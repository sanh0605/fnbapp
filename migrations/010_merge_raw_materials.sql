-- Migration 010: Gộp nguyên liệu thô trùng lặp
-- Canonical giữ lại: cacao_bot, matcha_bot, bot_kem_muoi, ca_phe_bot,
--                    sua_tuoi, sua_dac, duong_trang
-- Chạy sau Migration 009

-- ============================================================
-- Cập nhật tên + metadata cho các canonical (từ brand cụ thể)
-- ============================================================
UPDATE raw_materials SET name='Bột cacao',    icon='🍫', warn_at=200, color='#BA751730' WHERE id='cacao_bot';
UPDATE raw_materials SET name='Bột matcha',   icon='🍵', warn_at=100, color='#C0DD9740' WHERE id='matcha_bot';
UPDATE raw_materials SET name='Bột kem muối', icon='🧂', warn_at=200, color='#B5D4F440' WHERE id='bot_kem_muoi';
UPDATE raw_materials SET name='Bột cà phê',   icon='☕', warn_at=500, color='#FAEEDA'   WHERE id='ca_phe_bot';
UPDATE raw_materials SET name='Sữa tươi',     icon='🍼', warn_at=500, color='#E6F1FB'   WHERE id='sua_tuoi';
UPDATE raw_materials SET name='Sữa đặc',      icon='🥛', warn_at=300, color='#FAC77540' WHERE id='sua_dac';

-- ============================================================
-- NHÓM 1: bot_cacao_dk → cacao_bot
-- ============================================================
UPDATE raw_stock dst SET
  quantity   = (SELECT SUM(rs.quantity) FROM raw_stock rs WHERE rs.id IN ('cacao_bot','bot_cacao_dk')),
  avg_cost   = (SELECT CASE WHEN SUM(rs.quantity)>0
                  THEN SUM(rs.quantity * COALESCE(rs.avg_cost,0)) / SUM(rs.quantity)
                  ELSE 0 END
                FROM raw_stock rs WHERE rs.id IN ('cacao_bot','bot_cacao_dk')),
  updated_at = NOW()
WHERE dst.id = 'cacao_bot';

UPDATE semi_recipes       SET raw_id        = 'cacao_bot' WHERE raw_id        = 'bot_cacao_dk';
UPDATE product_recipes    SET ingredient_id = 'cacao_bot' WHERE ingredient_id = 'bot_cacao_dk' AND ingredient_type='raw';
UPDATE sku_items          SET map_to_id     = 'cacao_bot' WHERE map_to_id     = 'bot_cacao_dk';
UPDATE purchase_order_items SET item_id     = 'cacao_bot' WHERE item_id       = 'bot_cacao_dk' AND item_type='raw';

DELETE FROM raw_stock     WHERE id = 'bot_cacao_dk';
DELETE FROM raw_materials WHERE id = 'bot_cacao_dk';

-- ============================================================
-- NHÓM 2: bot_matcha_cozy → matcha_bot
-- ============================================================
UPDATE raw_stock dst SET
  quantity   = (SELECT SUM(rs.quantity) FROM raw_stock rs WHERE rs.id IN ('matcha_bot','bot_matcha_cozy')),
  avg_cost   = (SELECT CASE WHEN SUM(rs.quantity)>0
                  THEN SUM(rs.quantity * COALESCE(rs.avg_cost,0)) / SUM(rs.quantity)
                  ELSE 0 END
                FROM raw_stock rs WHERE rs.id IN ('matcha_bot','bot_matcha_cozy')),
  updated_at = NOW()
WHERE dst.id = 'matcha_bot';

UPDATE semi_recipes       SET raw_id        = 'matcha_bot' WHERE raw_id        = 'bot_matcha_cozy';
UPDATE product_recipes    SET ingredient_id = 'matcha_bot' WHERE ingredient_id = 'bot_matcha_cozy' AND ingredient_type='raw';
UPDATE sku_items          SET map_to_id     = 'matcha_bot' WHERE map_to_id     = 'bot_matcha_cozy';
UPDATE purchase_order_items SET item_id     = 'matcha_bot' WHERE item_id       = 'bot_matcha_cozy' AND item_type='raw';

DELETE FROM raw_stock     WHERE id = 'bot_matcha_cozy';
DELETE FROM raw_materials WHERE id = 'bot_matcha_cozy';

-- ============================================================
-- NHÓM 3: bot_milk_foam → bot_kem_muoi
-- ============================================================
UPDATE raw_stock dst SET
  quantity   = (SELECT SUM(rs.quantity) FROM raw_stock rs WHERE rs.id IN ('bot_kem_muoi','bot_milk_foam')),
  avg_cost   = (SELECT CASE WHEN SUM(rs.quantity)>0
                  THEN SUM(rs.quantity * COALESCE(rs.avg_cost,0)) / SUM(rs.quantity)
                  ELSE 0 END
                FROM raw_stock rs WHERE rs.id IN ('bot_kem_muoi','bot_milk_foam')),
  updated_at = NOW()
WHERE dst.id = 'bot_kem_muoi';

UPDATE semi_recipes       SET raw_id        = 'bot_kem_muoi' WHERE raw_id        = 'bot_milk_foam';
UPDATE product_recipes    SET ingredient_id = 'bot_kem_muoi' WHERE ingredient_id = 'bot_milk_foam' AND ingredient_type='raw';
UPDATE sku_items          SET map_to_id     = 'bot_kem_muoi' WHERE map_to_id     = 'bot_milk_foam';
UPDATE purchase_order_items SET item_id     = 'bot_kem_muoi' WHERE item_id       = 'bot_milk_foam' AND item_type='raw';

DELETE FROM raw_stock     WHERE id = 'bot_milk_foam';
DELETE FROM raw_materials WHERE id = 'bot_milk_foam';

-- ============================================================
-- NHÓM 4: ca_phe_robusta + ca_phe_phin_dam → ca_phe_bot
-- ============================================================
UPDATE raw_stock dst SET
  quantity   = (SELECT SUM(rs.quantity) FROM raw_stock rs WHERE rs.id IN ('ca_phe_bot','ca_phe_robusta','ca_phe_phin_dam')),
  avg_cost   = (SELECT CASE WHEN SUM(rs.quantity)>0
                  THEN SUM(rs.quantity * COALESCE(rs.avg_cost,0)) / SUM(rs.quantity)
                  ELSE 0 END
                FROM raw_stock rs WHERE rs.id IN ('ca_phe_bot','ca_phe_robusta','ca_phe_phin_dam')),
  updated_at = NOW()
WHERE dst.id = 'ca_phe_bot';

UPDATE semi_recipes       SET raw_id        = 'ca_phe_bot' WHERE raw_id        IN ('ca_phe_robusta','ca_phe_phin_dam');
UPDATE product_recipes    SET ingredient_id = 'ca_phe_bot' WHERE ingredient_id IN ('ca_phe_robusta','ca_phe_phin_dam') AND ingredient_type='raw';
UPDATE sku_items          SET map_to_id     = 'ca_phe_bot' WHERE map_to_id     IN ('ca_phe_robusta','ca_phe_phin_dam');
UPDATE purchase_order_items SET item_id     = 'ca_phe_bot' WHERE item_id       IN ('ca_phe_robusta','ca_phe_phin_dam') AND item_type='raw';

DELETE FROM raw_stock     WHERE id IN ('ca_phe_robusta','ca_phe_phin_dam');
DELETE FROM raw_materials WHERE id IN ('ca_phe_robusta','ca_phe_phin_dam');

-- ============================================================
-- NHÓM 5: sua_tuoi_th + sua_tuoi_mlekovita → sua_tuoi
-- ============================================================
UPDATE raw_stock dst SET
  quantity   = (SELECT SUM(rs.quantity) FROM raw_stock rs WHERE rs.id IN ('sua_tuoi','sua_tuoi_th','sua_tuoi_mlekovita')),
  avg_cost   = (SELECT CASE WHEN SUM(rs.quantity)>0
                  THEN SUM(rs.quantity * COALESCE(rs.avg_cost,0)) / SUM(rs.quantity)
                  ELSE 0 END
                FROM raw_stock rs WHERE rs.id IN ('sua_tuoi','sua_tuoi_th','sua_tuoi_mlekovita')),
  updated_at = NOW()
WHERE dst.id = 'sua_tuoi';

UPDATE semi_recipes       SET raw_id        = 'sua_tuoi' WHERE raw_id        IN ('sua_tuoi_th','sua_tuoi_mlekovita');
UPDATE product_recipes    SET ingredient_id = 'sua_tuoi' WHERE ingredient_id IN ('sua_tuoi_th','sua_tuoi_mlekovita') AND ingredient_type='raw';
UPDATE sku_items          SET map_to_id     = 'sua_tuoi' WHERE map_to_id     IN ('sua_tuoi_th','sua_tuoi_mlekovita');
UPDATE purchase_order_items SET item_id     = 'sua_tuoi' WHERE item_id       IN ('sua_tuoi_th','sua_tuoi_mlekovita') AND item_type='raw';

DELETE FROM raw_stock     WHERE id IN ('sua_tuoi_th','sua_tuoi_mlekovita');
DELETE FROM raw_materials WHERE id IN ('sua_tuoi_th','sua_tuoi_mlekovita');

-- ============================================================
-- NHÓM 6: sua_dac_larosee + sua_dac_vinamilk + sua_dac_ngoisao → sua_dac
-- ============================================================
UPDATE raw_stock dst SET
  quantity   = (SELECT SUM(rs.quantity) FROM raw_stock rs WHERE rs.id IN ('sua_dac','sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao')),
  avg_cost   = (SELECT CASE WHEN SUM(rs.quantity)>0
                  THEN SUM(rs.quantity * COALESCE(rs.avg_cost,0)) / SUM(rs.quantity)
                  ELSE 0 END
                FROM raw_stock rs WHERE rs.id IN ('sua_dac','sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao')),
  updated_at = NOW()
WHERE dst.id = 'sua_dac';

UPDATE semi_recipes       SET raw_id        = 'sua_dac' WHERE raw_id        IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao');
UPDATE product_recipes    SET ingredient_id = 'sua_dac' WHERE ingredient_id IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao') AND ingredient_type='raw';
UPDATE sku_items          SET map_to_id     = 'sua_dac' WHERE map_to_id     IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao');
UPDATE purchase_order_items SET item_id     = 'sua_dac' WHERE item_id       IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao') AND item_type='raw';

DELETE FROM raw_stock     WHERE id IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao');
DELETE FROM raw_materials WHERE id IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao');

-- ============================================================
-- NHÓM 7: duong → duong_trang
-- ============================================================
UPDATE raw_stock dst SET
  quantity   = (SELECT SUM(rs.quantity) FROM raw_stock rs WHERE rs.id IN ('duong_trang','duong')),
  avg_cost   = (SELECT CASE WHEN SUM(rs.quantity)>0
                  THEN SUM(rs.quantity * COALESCE(rs.avg_cost,0)) / SUM(rs.quantity)
                  ELSE 0 END
                FROM raw_stock rs WHERE rs.id IN ('duong_trang','duong')),
  updated_at = NOW()
WHERE dst.id = 'duong_trang';

UPDATE semi_recipes       SET raw_id        = 'duong_trang' WHERE raw_id        = 'duong';
UPDATE product_recipes    SET ingredient_id = 'duong_trang' WHERE ingredient_id = 'duong' AND ingredient_type='raw';
UPDATE sku_items          SET map_to_id     = 'duong_trang' WHERE map_to_id     = 'duong';
UPDATE purchase_order_items SET item_id     = 'duong_trang' WHERE item_id       = 'duong' AND item_type='raw';

DELETE FROM raw_stock     WHERE id = 'duong';
DELETE FROM raw_materials WHERE id = 'duong';
