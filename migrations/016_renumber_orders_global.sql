-- Migration 016: Đánh lại mã đơn toàn cục theo created_at tăng dần
-- Lý do: order_num hiện tại reset mỗi lần load POS (bắt đầu từ #001 mỗi session)
-- Kết quả: #001 = đơn đầu tiên từ trước đến nay, tăng dần không reset

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM orders
)
UPDATE orders o
SET order_num = '#' || LPAD(r.rn::text, 3, '0')
FROM ranked r
WHERE o.id = r.id;

-- Kiểm tra sau khi chạy:
-- SELECT order_num, created_at FROM orders ORDER BY created_at ASC LIMIT 20;
