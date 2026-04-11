-- Migration 012: Tính lại tồn kho per-SKU theo FIFO chính xác
-- Vấn đề: migration 008 seed PO items không gán sku_id,
--         migration 010 đã merge item_id gốc (ca_phe_robusta → ca_phe_bot)
--         → không thể phân biệt Robusta vs Phin Đậm qua item_id
-- Giải pháp:
--   BƯỚC 1: Gán lại sku_id trong purchase_order_items dựa trên item_name
--   BƯỚC 2: Tính lại sku_items.quantity theo FIFO
--           (SKU nào nhập lần cuối SỚM HƠN = tiêu thụ trước)
-- Chạy sau Migration 011

-- ============================================================
-- BƯỚC 1: Gán sku_id trong purchase_order_items
-- ============================================================
UPDATE purchase_order_items poi
SET sku_id = si.id
FROM sku_items si
WHERE poi.sku_id IS NULL
  AND poi.item_type = 'raw'
  AND (
    (si.sku_code = 'NVL-CF-001' AND poi.item_name ILIKE '%Robusta%')
    OR (si.sku_code = 'NVL-CF-002' AND (poi.item_name ILIKE '%Phin Đậm%' OR poi.item_name ILIKE '%Phin Dam%'))
    OR (si.sku_code = 'NVL-DT-001' AND poi.item_name ILIKE '%Đường%')
    OR (si.sku_code = 'NVL-CA-001' AND poi.item_name ILIKE '%cacao%')
    OR (si.sku_code = 'NVL-MF-001' AND poi.item_name ILIKE '%milk foam%')
    OR (si.sku_code = 'NVL-MT-001' AND poi.item_name ILIKE '%matcha%')
    OR (si.sku_code = 'NVL-SD-001' AND poi.item_name ILIKE '%Vinamilk%')
    OR (si.sku_code = 'NVL-SD-002' AND poi.item_name ILIKE '%Ngôi Sao%')
    OR (si.sku_code = 'NVL-SD-003' AND poi.item_name ILIKE '%La rosee%')
    OR (si.sku_code = 'NVL-ST-001' AND poi.item_name ILIKE '%TH True Milk%')
    OR (si.sku_code = 'NVL-ST-002' AND (poi.item_name ILIKE '%Mlekovita%' OR poi.item_name ILIKE '%MLEKOVITA%'))
  );

-- ============================================================
-- BƯỚC 2: Tính lại sku_items.quantity theo FIFO
-- FIFO rule: SKU nào có lần nhập CUỐI CÙNG SỚM HƠN → tiêu thụ trước
--   Ví dụ:
--   NVL-CF-002 (Phin Đậm): chỉ nhập NH000001 (27/3) → last_received = 27/3 → tiêu trước
--   NVL-CF-001 (Robusta):  nhập NH000001 + NH000018 (4/4)  → last_received = 4/4  → tiêu sau
-- ============================================================
WITH
-- Tổng mua và ngày nhập cuối cùng theo SKU
sku_stats AS (
  SELECT
    si.id                                   AS sku_id,
    si.sku_code,
    si.map_to_id                            AS raw_id,
    COALESCE(SUM(poi.base_qty), 0)          AS total_in,
    MAX(po.received_at)                     AS last_received
  FROM sku_items si
  LEFT JOIN purchase_order_items poi ON poi.sku_id = si.id
  LEFT JOIN purchase_orders       po  ON po.id       = poi.po_id
  WHERE si.map_to_type = 'raw'
  GROUP BY si.id, si.sku_code, si.map_to_id
),

-- Chỉ xử lý các raw material có ít nhất 1 SKU đã gán PO
raw_with_data AS (
  SELECT raw_id
  FROM   sku_stats
  GROUP  BY raw_id
  HAVING SUM(total_in) > 0
),

-- Tồn kho tổng hiện tại
raw_remaining AS (
  SELECT id, COALESCE(quantity, 0) AS qty FROM raw_stock
),

-- Tổng đã dùng = tổng nhập − tồn hiện tại (per raw material)
raw_totals AS (
  SELECT
    s.raw_id,
    SUM(s.total_in)                               AS total_purchased,
    r.qty                                          AS remaining,
    GREATEST(0, SUM(s.total_in) - r.qty)          AS total_used
  FROM sku_stats  s
  JOIN raw_remaining r ON r.id = s.raw_id
  JOIN raw_with_data d ON d.raw_id = s.raw_id
  GROUP BY s.raw_id, r.qty
),

-- FIFO rank + lũy kế số đã nhập CỦA CÁC SKU CŨ HƠN
ranked AS (
  SELECT
    s.sku_id,
    s.sku_code,
    s.raw_id,
    s.total_in,
    s.last_received,
    t.total_used,
    -- Tổng total_in của tất cả SKU cũ hơn (sẽ bị tiêu trước mình)
    COALESCE(
      SUM(s.total_in) OVER (
        PARTITION BY s.raw_id
        ORDER BY s.last_received ASC NULLS FIRST
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0
    ) AS cum_before
  FROM sku_stats s
  JOIN raw_totals t ON t.raw_id = s.raw_id
),

-- Số lượng mới theo FIFO:
--   already_used_before = phần total_used đã được hấp thụ bởi các SKU cũ hơn
--   còn lại cho mình     = GREATEST(0, total_used - cum_before)
--   new_qty              = GREATEST(0, total_in - phần_còn_lại_cho_mình)
fifo_new AS (
  SELECT
    sku_id,
    GREATEST(0, total_in - GREATEST(0, total_used - cum_before)) AS new_qty
  FROM ranked
)

UPDATE sku_items si
SET    quantity = fn.new_qty
FROM   fifo_new fn
WHERE  si.id           = fn.sku_id
  AND  si.map_to_type  = 'raw';

-- ============================================================
-- KIỂM TRA SAU KHI CHẠY (chạy query này để xác nhận)
-- ============================================================
-- SELECT
--   r.id                                          AS raw_id,
--   r.quantity                                    AS raw_stock,
--   COALESCE(SUM(si.quantity), 0)                AS sku_sum,
--   r.quantity - COALESCE(SUM(si.quantity), 0)  AS diff,
--   STRING_AGG(
--     si.sku_code || ': ' || ROUND(si.quantity::numeric) || si.base_unit,
--     ' | ' ORDER BY si.sku_code
--   )                                             AS detail
-- FROM raw_stock   r
-- LEFT JOIN sku_items si ON si.map_to_id = r.id AND si.map_to_type = 'raw'
-- GROUP BY r.id, r.quantity
-- ORDER BY r.id;
