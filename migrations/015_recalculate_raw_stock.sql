-- Migration 015: Tính lại tồn kho nguyên liệu thô từ đầu
-- Lý do: tồn kho sai do xuất huỷ + pha BTP thực hiện trước khi FIFO được thiết lập
--
-- CÔNG THỨC:
--   raw_stock.quantity = tổng_nhập - xuất_huỷ - dùng_pha_BTP - dùng_bán_trực_tiếp
--
-- Trong đó:
--   tổng_nhập        = SUM(purchase_order_items.base_qty) với PO đã nhận
--   xuất_huỷ         = SUM(stock_writeoffs.quantity) item_type='raw'
--   dùng_pha_BTP     = (semi_stock hiện tại + semi đã bán) × (raw_per_batch / yield)
--   dùng_bán_trực    = Σ đơn × qty × recipe_amount (raw dùng thẳng trong product_recipes)
--
-- Chạy sau Migration 014

-- ============================================================
-- BƯỚC 0: Cập nhật ngày lịch sử xuất huỷ → 08/04/2026 20:00 VN (= 13:00 UTC)
-- (Không có bảng brew_log — pha BTP được ghi thẳng vào raw_stock/semi_stock)
-- ============================================================
UPDATE stock_writeoffs
SET created_at = '2026-04-08T13:00:00.000Z'
WHERE created_at IS NOT NULL;

-- ============================================================
-- BƯỚC 1: Tính lại raw_stock.quantity
-- ============================================================
WITH

-- 1a. Tổng nhập per raw_id (chỉ tính PO status received/completed)
purchased AS (
  SELECT
    si.map_to_id                  AS raw_id,
    COALESCE(SUM(poi.base_qty), 0) AS total_in
  FROM sku_items si
  JOIN purchase_order_items poi ON poi.sku_id = si.id
  JOIN purchase_orders       po  ON po.id      = poi.po_id
  WHERE si.map_to_type = 'raw'
    AND po.status IN ('received', 'completed')
  GROUP BY si.map_to_id
),

-- 1b. Tổng xuất huỷ per raw_id
written_off AS (
  SELECT item_id AS raw_id, COALESCE(SUM(quantity), 0) AS total_out
  FROM stock_writeoffs
  WHERE item_type = 'raw'
  GROUP BY item_id
),

-- 1c. Semi đã tiêu thụ qua bán hàng (từ product_recipes ingredient_type='semi')
-- Đây là lượng bán thành phẩm đã dùng để pha thành đồ uống
semi_used_in_sales AS (
  SELECT
    pr.ingredient_id AS semi_id,
    COALESCE(SUM(
      (item_data->>'qty')::numeric * pr.amount
    ), 0) AS qty_sold
  FROM orders o,
       jsonb_array_elements(
         CASE jsonb_typeof(o.items::jsonb) WHEN 'array' THEN o.items::jsonb ELSE '[]'::jsonb END
       ) AS item_data
  JOIN product_recipes pr
    ON pr.product_id  = (item_data->>'id')::uuid
   AND pr.ingredient_type = 'semi'
  WHERE NOT COALESCE(o.voided, false)
    AND o.items IS NOT NULL
  GROUP BY pr.ingredient_id
),

-- 1d. Tổng raw dùng để pha BTP = (semi hiện tồn + semi đã bán) × tỷ lệ nguyên liệu/lô
--     Tỷ lệ = semi_recipes.amount / semi_products.yield_qty
--     Bỏ qua nước (nuoc) vì không track tồn kho
brew_raw_used AS (
  SELECT
    sr.raw_id,
    SUM(
      (COALESCE(ss.quantity, 0) + COALESCE(sus.qty_sold, 0))
      * (sr.amount::numeric / NULLIF(sp.yields, 0))
    ) AS total_for_brew
  FROM semi_recipes sr
  JOIN semi_products sp ON sp.id = sr.semi_id
  LEFT JOIN semi_stock          ss  ON ss.id     = sr.semi_id
  LEFT JOIN semi_used_in_sales  sus ON sus.semi_id = sr.semi_id
  WHERE sr.raw_id != 'nuoc'     -- bỏ nước, không track
    AND sr.raw_id IS NOT NULL
  GROUP BY sr.raw_id
),

-- 1e. Raw dùng trực tiếp khi bán (product_recipes ingredient_type='raw')
--     VD: sữa đặc, sữa tươi dùng thẳng trong công thức ly
raw_used_direct AS (
  SELECT
    pr.ingredient_id AS raw_id,
    COALESCE(SUM(
      (item_data->>'qty')::numeric * pr.amount
    ), 0) AS total_direct
  FROM orders o,
       jsonb_array_elements(
         CASE jsonb_typeof(o.items::jsonb) WHEN 'array' THEN o.items::jsonb ELSE '[]'::jsonb END
       ) AS item_data
  JOIN product_recipes pr
    ON pr.product_id  = (item_data->>'id')::uuid
   AND pr.ingredient_type = 'raw'
  WHERE NOT COALESCE(o.voided, false)
    AND o.items IS NOT NULL
  GROUP BY pr.ingredient_id
),

-- 1f. Tổng hợp: new_qty = nhập - huỷ - pha_BTP - bán_trực
final_qty AS (
  SELECT
    p.raw_id,
    GREATEST(0,
      p.total_in
      - COALESCE(wo.total_out,       0)
      - COALESCE(br.total_for_brew,  0)
      - COALESCE(rd.total_direct,    0)
    ) AS new_qty
  FROM purchased p
  LEFT JOIN written_off    wo ON wo.raw_id = p.raw_id
  LEFT JOIN brew_raw_used  br ON br.raw_id = p.raw_id
  LEFT JOIN raw_used_direct rd ON rd.raw_id = p.raw_id
)

UPDATE raw_stock rs
SET    quantity   = fq.new_qty,
       updated_at = NOW()
FROM   final_qty fq
WHERE  rs.id = fq.raw_id;

-- ============================================================
-- BƯỚC 2: Tính lại sku_items.quantity theo FIFO
-- (dùng raw_stock mới vừa cập nhật ở BƯỚC 1)
-- ============================================================
WITH
sku_stats AS (
  SELECT
    si.id                          AS sku_id,
    si.sku_code,
    si.map_to_id                   AS raw_id,
    COALESCE(SUM(poi.base_qty), 0) AS total_in,
    MAX(po.received_at)            AS last_received
  FROM sku_items si
  LEFT JOIN purchase_order_items poi ON poi.sku_id = si.id
  LEFT JOIN purchase_orders       po  ON po.id      = poi.po_id
  WHERE si.map_to_type = 'raw'
  GROUP BY si.id, si.sku_code, si.map_to_id
),
raw_remaining AS (
  SELECT id, COALESCE(quantity, 0) AS qty FROM raw_stock
),
raw_totals AS (
  SELECT
    s.raw_id,
    SUM(s.total_in)                             AS total_purchased,
    r.qty                                        AS remaining,
    GREATEST(0, SUM(s.total_in) - r.qty)        AS total_used
  FROM sku_stats s
  JOIN raw_remaining r ON r.id = s.raw_id
  WHERE s.total_in > 0
  GROUP BY s.raw_id, r.qty
),
ranked AS (
  SELECT
    s.sku_id, s.raw_id, s.total_in, s.last_received, t.total_used,
    COALESCE(SUM(s.total_in) OVER (
      PARTITION BY s.raw_id
      ORDER BY s.last_received ASC NULLS FIRST
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS cum_before
  FROM sku_stats s
  JOIN raw_totals t ON t.raw_id = s.raw_id
),
fifo_new AS (
  SELECT
    sku_id,
    GREATEST(0, total_in - GREATEST(0, total_used - cum_before)) AS new_qty
  FROM ranked
)
UPDATE sku_items si
SET    quantity = fn.new_qty
FROM   fifo_new fn
WHERE  si.id          = fn.sku_id
  AND  si.map_to_type = 'raw';

-- ============================================================
-- KIỂM TRA SAU KHI CHẠY
-- ============================================================
-- -- Xem tồn kho mới của raw_stock so với tổng nhập:
-- SELECT
--   rs.id,
--   rs.quantity                            AS ton_kho_moi,
--   COALESCE(p.total_in, 0)               AS tong_nhap,
--   COALESCE(wo.total_out, 0)             AS xuat_huy,
--   COALESCE(br.total_for_brew, 0)        AS dung_pha_btp,
--   COALESCE(rd.total_direct, 0)          AS ban_truc_tiep
-- FROM raw_stock rs
-- LEFT JOIN (
--   SELECT si.map_to_id AS raw_id, SUM(poi.base_qty) AS total_in
--   FROM sku_items si JOIN purchase_order_items poi ON poi.sku_id=si.id
--   JOIN purchase_orders po ON po.id=poi.po_id
--   WHERE si.map_to_type='raw' AND po.status IN ('received','completed')
--   GROUP BY si.map_to_id
-- ) p ON p.raw_id = rs.id
-- LEFT JOIN (
--   SELECT item_id AS raw_id, SUM(quantity) AS total_out FROM stock_writeoffs WHERE item_type='raw' GROUP BY item_id
-- ) wo ON wo.raw_id = rs.id
-- LEFT JOIN (
--   SELECT sr.raw_id, SUM((COALESCE(ss.quantity,0)) * (sr.amount::numeric/NULLIF(sp.yield_qty,0))) AS total_for_brew
--   FROM semi_recipes sr JOIN semi_products sp ON sp.id=sr.semi_id LEFT JOIN semi_stock ss ON ss.id=sr.semi_id
--   WHERE sr.raw_id != 'nuoc' GROUP BY sr.raw_id
-- ) br ON br.raw_id = rs.id
-- LEFT JOIN (
--   SELECT pr.ingredient_id AS raw_id, SUM((item->>'qty')::numeric*pr.amount) AS total_direct
--   FROM orders o, jsonb_array_elements(o.items::jsonb) item
--   JOIN product_recipes pr ON pr.product_id=(item->>'id')::uuid AND pr.ingredient_type='raw'
--   WHERE NOT COALESCE(o.voided,false) GROUP BY pr.ingredient_id
-- ) rd ON rd.raw_id = rs.id
-- ORDER BY rs.id;
