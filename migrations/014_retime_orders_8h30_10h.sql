-- Migration 014: Dời tất cả đơn hàng về khung giờ 08:30–10:00 (giờ VN)
-- Các đơn cùng ngày được cách đều nhau trong 90 phút (5400 giây)
-- Công thức: start = 08:30, nếu N đơn thì mỗi đơn cách nhau 90/(N-1) phút
--            (nếu chỉ 1 đơn → đặt vào đúng 08:30)

WITH ranked AS (
  SELECT
    id,
    -- Xác định ngày theo giờ VN (UTC+7)
    (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS order_date,
    ROW_NUMBER() OVER (
      PARTITION BY (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      ORDER BY created_at ASC
    ) AS rn,
    COUNT(*) OVER (
      PARTITION BY (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    ) AS total
  FROM orders
),
new_times AS (
  SELECT
    id,
    -- Điểm bắt đầu: 08:30 giờ VN của ngày đó → chuyển về UTC để lưu
    (order_date::timestamp + INTERVAL '8 hours 30 minutes') AT TIME ZONE 'Asia/Ho_Chi_Minh'
    -- Cộng khoảng cách đều (phút)
    + CASE
        WHEN total = 1 THEN INTERVAL '0'
        ELSE ((rn - 1)::numeric / (total - 1)::numeric * 90) * INTERVAL '1 minute'
      END AS new_created_at
  FROM ranked
)
UPDATE orders o
SET created_at = nt.new_created_at
FROM new_times nt
WHERE o.id = nt.id;

-- Kiểm tra sau khi chạy:
-- SELECT
--   (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS ngay,
--   COUNT(*) AS so_don,
--   MIN(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time AS gio_dau,
--   MAX(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time AS gio_cuoi
-- FROM orders
-- GROUP BY ngay
-- ORDER BY ngay;
