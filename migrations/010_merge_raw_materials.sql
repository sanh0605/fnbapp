-- Migration 010: Gộp nguyên liệu thô trùng lặp
-- Chạy sau Migration 009

-- ============================================================
-- NHÓM 1: cacao_bot → bot_cacao_dk
-- ============================================================
UPDATE raw_stock SET
  quantity  = quantity + (SELECT COALESCE(quantity,0)  FROM raw_stock WHERE id='cacao_bot'),
  avg_cost  = CASE WHEN quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='cacao_bot') > 0
                THEN (quantity * COALESCE(avg_cost,0) + (SELECT COALESCE(quantity,0)*COALESCE(avg_cost,0) FROM raw_stock WHERE id='cacao_bot'))
                     / (quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='cacao_bot'))
                ELSE 0 END,
  updated_at = NOW()
WHERE id = 'bot_cacao_dk';

UPDATE semi_recipes       SET ingredient_id = 'bot_cacao_dk' WHERE ingredient_id = 'cacao_bot';
UPDATE product_recipes    SET ingredient_id = 'bot_cacao_dk' WHERE ingredient_id = 'cacao_bot' AND ingredient_type = 'raw';
UPDATE sku_items          SET map_to_id     = 'bot_cacao_dk' WHERE map_to_id     = 'cacao_bot';
UPDATE purchase_order_items SET item_id     = 'bot_cacao_dk' WHERE item_id       = 'cacao_bot' AND item_type = 'raw';

DELETE FROM raw_stock     WHERE id = 'cacao_bot';
DELETE FROM raw_materials WHERE id = 'cacao_bot';

-- ============================================================
-- NHÓM 2: matcha_bot → bot_matcha_cozy
-- ============================================================
UPDATE raw_stock SET
  quantity  = quantity + (SELECT COALESCE(quantity,0)  FROM raw_stock WHERE id='matcha_bot'),
  avg_cost  = CASE WHEN quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='matcha_bot') > 0
                THEN (quantity * COALESCE(avg_cost,0) + (SELECT COALESCE(quantity,0)*COALESCE(avg_cost,0) FROM raw_stock WHERE id='matcha_bot'))
                     / (quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='matcha_bot'))
                ELSE 0 END,
  updated_at = NOW()
WHERE id = 'bot_matcha_cozy';

UPDATE semi_recipes       SET ingredient_id = 'bot_matcha_cozy' WHERE ingredient_id = 'matcha_bot';
UPDATE product_recipes    SET ingredient_id = 'bot_matcha_cozy' WHERE ingredient_id = 'matcha_bot' AND ingredient_type = 'raw';
UPDATE sku_items          SET map_to_id     = 'bot_matcha_cozy' WHERE map_to_id     = 'matcha_bot';
UPDATE purchase_order_items SET item_id     = 'bot_matcha_cozy' WHERE item_id       = 'matcha_bot' AND item_type = 'raw';

DELETE FROM raw_stock     WHERE id = 'matcha_bot';
DELETE FROM raw_materials WHERE id = 'matcha_bot';

-- ============================================================
-- NHÓM 3: bot_kem_muoi → bot_milk_foam
-- ============================================================
UPDATE raw_stock SET
  quantity  = quantity + (SELECT COALESCE(quantity,0)  FROM raw_stock WHERE id='bot_kem_muoi'),
  avg_cost  = CASE WHEN quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='bot_kem_muoi') > 0
                THEN (quantity * COALESCE(avg_cost,0) + (SELECT COALESCE(quantity,0)*COALESCE(avg_cost,0) FROM raw_stock WHERE id='bot_kem_muoi'))
                     / (quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='bot_kem_muoi'))
                ELSE 0 END,
  updated_at = NOW()
WHERE id = 'bot_milk_foam';

UPDATE semi_recipes       SET ingredient_id = 'bot_milk_foam' WHERE ingredient_id = 'bot_kem_muoi';
UPDATE product_recipes    SET ingredient_id = 'bot_milk_foam' WHERE ingredient_id = 'bot_kem_muoi' AND ingredient_type = 'raw';
UPDATE sku_items          SET map_to_id     = 'bot_milk_foam' WHERE map_to_id     = 'bot_kem_muoi';
UPDATE purchase_order_items SET item_id     = 'bot_milk_foam' WHERE item_id       = 'bot_kem_muoi' AND item_type = 'raw';

DELETE FROM raw_stock     WHERE id = 'bot_kem_muoi';
DELETE FROM raw_materials WHERE id = 'bot_kem_muoi';

-- ============================================================
-- NHÓM 4: duong → duong_trang
-- ============================================================
UPDATE raw_stock SET
  quantity  = quantity + (SELECT COALESCE(quantity,0)  FROM raw_stock WHERE id='duong'),
  avg_cost  = CASE WHEN quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='duong') > 0
                THEN (quantity * COALESCE(avg_cost,0) + (SELECT COALESCE(quantity,0)*COALESCE(avg_cost,0) FROM raw_stock WHERE id='duong'))
                     / (quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='duong'))
                ELSE 0 END,
  updated_at = NOW()
WHERE id = 'duong_trang';

UPDATE semi_recipes       SET ingredient_id = 'duong_trang' WHERE ingredient_id = 'duong';
UPDATE product_recipes    SET ingredient_id = 'duong_trang' WHERE ingredient_id = 'duong' AND ingredient_type = 'raw';
UPDATE sku_items          SET map_to_id     = 'duong_trang' WHERE map_to_id     = 'duong';
UPDATE purchase_order_items SET item_id     = 'duong_trang' WHERE item_id       = 'duong' AND item_type = 'raw';

DELETE FROM raw_stock     WHERE id = 'duong';
DELETE FROM raw_materials WHERE id = 'duong';

-- ============================================================
-- NHÓM 5: ca_phe_bot → ca_phe_robusta
-- ============================================================
UPDATE raw_stock SET
  quantity  = quantity + (SELECT COALESCE(quantity,0)  FROM raw_stock WHERE id='ca_phe_bot'),
  avg_cost  = CASE WHEN quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='ca_phe_bot') > 0
                THEN (quantity * COALESCE(avg_cost,0) + (SELECT COALESCE(quantity,0)*COALESCE(avg_cost,0) FROM raw_stock WHERE id='ca_phe_bot'))
                     / (quantity + (SELECT COALESCE(quantity,0) FROM raw_stock WHERE id='ca_phe_bot'))
                ELSE 0 END,
  updated_at = NOW()
WHERE id = 'ca_phe_robusta';

UPDATE semi_recipes       SET ingredient_id = 'ca_phe_robusta' WHERE ingredient_id = 'ca_phe_bot';
UPDATE product_recipes    SET ingredient_id = 'ca_phe_robusta' WHERE ingredient_id = 'ca_phe_bot' AND ingredient_type = 'raw';
UPDATE sku_items          SET map_to_id     = 'ca_phe_robusta' WHERE map_to_id     = 'ca_phe_bot';
UPDATE purchase_order_items SET item_id     = 'ca_phe_robusta' WHERE item_id       = 'ca_phe_bot' AND item_type = 'raw';

DELETE FROM raw_stock     WHERE id = 'ca_phe_bot';
DELETE FROM raw_materials WHERE id = 'ca_phe_bot';

-- ============================================================
-- NHÓM 6: sua_dac_larosee + sua_dac_vinamilk + sua_dac_ngoisao → sua_dac
-- (giữ generic vì product_recipes dùng sua_dac)
-- ============================================================
UPDATE raw_stock dst SET
  quantity  = (SELECT SUM(rs.quantity) FROM raw_stock rs
               WHERE rs.id IN ('sua_dac','sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao')),
  avg_cost  = (SELECT CASE WHEN SUM(rs.quantity) > 0
                 THEN SUM(rs.quantity * COALESCE(rs.avg_cost,0)) / SUM(rs.quantity)
                 ELSE 0 END
               FROM raw_stock rs
               WHERE rs.id IN ('sua_dac','sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao')),
  updated_at = NOW()
WHERE dst.id = 'sua_dac';

UPDATE semi_recipes       SET ingredient_id = 'sua_dac'
  WHERE ingredient_id IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao');
UPDATE product_recipes    SET ingredient_id = 'sua_dac'
  WHERE ingredient_id IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao') AND ingredient_type = 'raw';
UPDATE sku_items          SET map_to_id     = 'sua_dac'
  WHERE map_to_id     IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao');
UPDATE purchase_order_items SET item_id     = 'sua_dac'
  WHERE item_id       IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao') AND item_type = 'raw';

DELETE FROM raw_stock     WHERE id IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao');
DELETE FROM raw_materials WHERE id IN ('sua_dac_larosee','sua_dac_vinamilk','sua_dac_ngoisao');

-- ============================================================
-- NHÓM 7: sua_tuoi_th + sua_tuoi_mlekovita → sua_tuoi
-- (giữ generic vì product_recipes dùng sua_tuoi)
-- ============================================================
UPDATE raw_stock dst SET
  quantity  = (SELECT SUM(rs.quantity) FROM raw_stock rs
               WHERE rs.id IN ('sua_tuoi','sua_tuoi_th','sua_tuoi_mlekovita')),
  avg_cost  = (SELECT CASE WHEN SUM(rs.quantity) > 0
                 THEN SUM(rs.quantity * COALESCE(rs.avg_cost,0)) / SUM(rs.quantity)
                 ELSE 0 END
               FROM raw_stock rs
               WHERE rs.id IN ('sua_tuoi','sua_tuoi_th','sua_tuoi_mlekovita')),
  updated_at = NOW()
WHERE dst.id = 'sua_tuoi';

UPDATE semi_recipes       SET ingredient_id = 'sua_tuoi'
  WHERE ingredient_id IN ('sua_tuoi_th','sua_tuoi_mlekovita');
UPDATE product_recipes    SET ingredient_id = 'sua_tuoi'
  WHERE ingredient_id IN ('sua_tuoi_th','sua_tuoi_mlekovita') AND ingredient_type = 'raw';
UPDATE sku_items          SET map_to_id     = 'sua_tuoi'
  WHERE map_to_id     IN ('sua_tuoi_th','sua_tuoi_mlekovita');
UPDATE purchase_order_items SET item_id     = 'sua_tuoi'
  WHERE item_id       IN ('sua_tuoi_th','sua_tuoi_mlekovita') AND item_type = 'raw';

DELETE FROM raw_stock     WHERE id IN ('sua_tuoi_th','sua_tuoi_mlekovita');
DELETE FROM raw_materials WHERE id IN ('sua_tuoi_th','sua_tuoi_mlekovita');
