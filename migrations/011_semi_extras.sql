-- Migration 011: Cho phép bán thành phẩm như extra tại POS
-- sell_price  > 0  → xuất hiện trong tab Extra của POS
-- sell_unit_qty    → số lượng (ml/g) trừ khỏi semi_stock mỗi lần bán 1 đơn vị
-- Chạy sau Migration 010

ALTER TABLE semi_products ADD COLUMN IF NOT EXISTS sell_price    numeric DEFAULT 0;
ALTER TABLE semi_products ADD COLUMN IF NOT EXISTS sell_unit_qty numeric DEFAULT 0;
ALTER TABLE semi_products ADD COLUMN IF NOT EXISTS sell_sort     int     DEFAULT 99;

-- Kem muối: 50 ml / lần extra, giá 4.000đ
UPDATE semi_products SET sell_price = 4000, sell_unit_qty = 50, sell_sort = 1 WHERE id = 'kem_muoi';

-- Matcha base: 30 ml / lần extra, giá 5.000đ (điều chỉnh tuỳ ý)
UPDATE semi_products SET sell_price = 5000, sell_unit_qty = 30, sell_sort = 2 WHERE id = 'matcha_base';

-- Cacao base: 30 ml / lần extra, giá 5.000đ
UPDATE semi_products SET sell_price = 5000, sell_unit_qty = 30, sell_sort = 3 WHERE id = 'cacao_base';

-- Cho phép đánh dấu huỷ đơn bán hàng
ALTER TABLE orders ADD COLUMN IF NOT EXISTS voided boolean DEFAULT false;
