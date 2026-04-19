-- 020_order_counter.sql
-- Bảng đếm số thứ tự đơn hàng per outlet, tránh collision khi 2 thiết bị tạo đơn đồng thời

CREATE TABLE IF NOT EXISTS order_counters (
  outlet_id uuid PRIMARY KEY,
  last_num  integer NOT NULL DEFAULT 0
);

ALTER TABLE order_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can use counter" ON order_counters
  FOR ALL USING (true);

-- Seed từ dữ liệu hiện có
INSERT INTO order_counters (outlet_id, last_num)
SELECT
  outlet_id::uuid,
  MAX(
    CASE
      WHEN order_num ~ '\d+$'
        THEN CAST(REGEXP_REPLACE(order_num, '^.*[^\d](\d+)$', '\1') AS integer)
      ELSE 0
    END
  )
FROM orders
WHERE outlet_id IS NOT NULL
GROUP BY outlet_id
ON CONFLICT DO NOTHING;

-- Hàm atomic increment — trả về số tiếp theo
CREATE OR REPLACE FUNCTION next_order_num(p_outlet_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v integer;
BEGIN
  INSERT INTO order_counters (outlet_id, last_num)
  VALUES (p_outlet_id, 1)
  ON CONFLICT (outlet_id) DO UPDATE
    SET last_num = order_counters.last_num + 1
  RETURNING last_num INTO v;
  RETURN v;
END;
$$;
