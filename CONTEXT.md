# FNB App — CONTEXT.md
# Cập nhật lần cuối: 12/04/2026 (session 4 — POS gắn brand_id/outlet_id)

> **⚠️ QUY TẮC BẮT BUỘC CHO AI:** Sau MỖI lần hoàn thành thay đổi (tính năng mới, sửa bug,
> thay đổi schema, cập nhật module), phải cập nhật file này NGAY LẬP TỨC rồi commit cùng
> hoặc ngay sau commit code. Không được để dồn lại cuối session.
>
> **Khi bắt đầu session mới:** AI đọc toàn bộ file này trước khi làm bất cứ điều gì.
> Đây là nguồn sự thật duy nhất của dự án.

---

## THÔNG TIN DỰ ÁN
- **Repo GitHub:** github.com/sanh0605/fnbapp (Public)
- **App live:** https://sanh0605.github.io/fnbapp
- **Supabase project:** https://zicuawpwyhmtqmzawvau.supabase.co
- **Supabase key:** ⚠️ Chỉ lưu trong `src/lib/supabase.js` — KHÔNG commit vào đây
- **Môi trường:** vscode + Claude CLI + GitHub Pages + Supabase

---

## BỐI CẢNH KINH DOANH

Hệ thống quản lý bán hàng FnB đa brand — mục tiêu năm 2026:

| | Brand 1 — Cà Phê Sáng | Brand 2 — Trà Tối |
|---|---|---|
| Khung giờ | 6:00–10:00 AM | Buổi tối |
| Hình thức | Take-away only | Take-away + Dine-in |
| Số outlet 2026 | 5 | 2 |
| Đặc trưng | Rush hour, tốc độ cao | Table management, trải nghiệm |

**Tổng: 7 outlet / 2 brand — hệ thống hiện tại chưa hỗ trợ đa brand/outlet.**

---

## QUYẾT ĐỊNH KIẾN TRÚC (chốt 15/04/2026)

1. **Không đập lại từ đầu** — schema 22 bảng, RLS, phân quyền 3 tầng đã ổn
2. **Không cần backend riêng** — Supabase RLS đủ mạnh cho quy mô 7 outlet
3. **Ưu tiên multi-brand/outlet trước khi scale** — thiếu brand_id/outlet_id thì không tách báo cáo được
4. **GitHub Pages vẫn dùng được** — repo public, bảo mật dựa vào RLS Supabase
5. **Key không commit vào repo** — chỉ hardcode trong `supabase.js`

---

## PRIORITY ROADMAP

### ✅ P0 — Hoàn thành 15/04/2026
- [x] **Rotate + revoke Supabase legacy key**
  - Legacy HS256 key (đã lộ trong CONTEXT.md cũ) đã bị disable + revoke
  - Project đã migrate sang ECC P-256 (asymmetric JWT)
  - `src/lib/supabase.js` đang dùng publishable key mới (`sb_publishable_...`)
  - App xác nhận hoạt động bình thường sau khi đổi key

### ⏳ P1 — Làm trong tuần này
- [ ] **Migration 017:** tạo bảng `brands` + `outlets`, thêm `brand_id` + `outlet_id` vào `orders` và `users`
- [x] **POS** tự động gắn `brand_id` + `outlet_id` khi tạo đơn (đọc từ account đăng nhập)

### 📋 P2 — Trong tháng này
- [ ] Tách business logic ra JS module (`src/lib/orders.js`, `inventory.js`, `finance.js`)
- [ ] Dashboard tổng hợp đa brand/outlet — filter + so sánh
- [ ] Phân quyền account theo outlet (`users.outlet_id`)

### 🗂 P3 — Backlog
- [ ] Brand 2: dine-in + table management
- [ ] Offline mode cho POS
- [ ] KDS — màn hình bếp/pha chế
- [ ] Pre-order / tích hợp app giao hàng
- [ ] Loyalty / tích điểm khách hàng

---

## CẤU TRÚC THƯ MỤC

```
fnbapp/
├── index.html
├── CONTEXT.md               ← file này — commit sau mỗi session
├── migrations/              ← SQL 001–016 (017 sắp tới)
├── src/
│   ├── lib/
│   │   ├── supabase.js      ← key chỉ để ở đây
│   │   ├── orders.js        ← TODO P2
│   │   ├── inventory.js     ← TODO P2
│   │   └── finance.js       ← TODO P2
│   ├── auth/
│   ├── home/
│   ├── pos/                 ← cần gắn brand_id/outlet_id (P1)
│   ├── inventory/
│   ├── supplies/
│   ├── purchasing/
│   ├── assets/
│   ├── contacts/
│   ├── menu/
│   ├── orders/
│   ├── revenue/             ← cần filter theo brand/outlet (P2)
│   ├── finance/             ← cần filter theo brand/outlet (P2)
│   ├── schedule/
│   └── settings/
```

---

## DATABASE — 22 BẢNG HIỆN CÓ

### Migration 001
`users`, `orders`, `stock_receipts`, `raw_stock`, `semi_stock`, `expenses`, `schedule_logs`

### Migration 002
`settings`, `raw_materials`, `semi_products`, `semi_recipes`, `products`, `product_recipes`, `unit_conversions`

### Migration 003 — Seed mặc định
- raw_materials: ca_phe_bot, cacao_bot, matcha_bot, bot_kem_muoi, sua_dac, sua_tuoi, duong, nuoc
- semi_products: cot_ca_phe, cot_cacao, cot_matcha, kem_muoi, nuoc_duong
- products: 6 sản phẩm với công thức đầy đủ
- supplies: ly, nap, ong_hut, muong, tui_don, tui_doi

### Migration 004 — Purchase Management ✅
`suppliers`, `sku_items`, `sku_units`, `po_adjustments`, `po_payments`

### Migration 005 — Contacts ✅
`suppliers.contact_type`: nha_cung_cap / khach_hang / nhuong_quyen / khac

### Migration 006 — Assets ✅
`assets` — khấu hao đường thẳng

### Migration 007 — Seed SKUs thực tế ✅
60 SKU: NVL-CF/DT/CA/MF/MT/SD/ST, VTU-LY/NP/OH..., CCU-xxx

### Migration 014 — Retime orders ✅
Dịch chuyển đơn về khung 08:30–10:00

### Migration 015 — Tính lại raw_stock ✅
FIFO từ PO received/completed

### Migration 016 — Đánh lại mã đơn ⏳ CẦN CHẠY
```sql
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn FROM orders
)
UPDATE orders o SET order_num = '#' || LPAD(r.rn::text, 3, '0')
FROM ranked r WHERE o.id = r.id;
```

### Migration 017 — Multi-brand/outlet ⏳ P1 — CHƯA CHẠY
```sql
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  address text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders
  ADD COLUMN brand_id uuid REFERENCES brands(id),
  ADD COLUMN outlet_id uuid REFERENCES outlets(id);

ALTER TABLE users
  ADD COLUMN outlet_id uuid REFERENCES outlets(id);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_brands" ON brands FOR ALL USING (true);
CREATE POLICY "allow_all_outlets" ON outlets FOR ALL USING (true);

INSERT INTO brands (code, name) VALUES
  ('CF_SANG', 'Cà Phê Sáng'),
  ('TRA_TOI', 'Trà Tối');

INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O1', 'Cà Phê Sáng — Outlet 1' FROM brands WHERE code = 'CF_SANG';
INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O2', 'Cà Phê Sáng — Outlet 2' FROM brands WHERE code = 'CF_SANG';
INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O3', 'Cà Phê Sáng — Outlet 3' FROM brands WHERE code = 'CF_SANG';
INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O4', 'Cà Phê Sáng — Outlet 4' FROM brands WHERE code = 'CF_SANG';
INSERT INTO outlets (brand_id, code, name)
SELECT id, 'CF_O5', 'Cà Phê Sáng — Outlet 5' FROM brands WHERE code = 'CF_SANG';

INSERT INTO outlets (brand_id, code, name)
SELECT id, 'TRA_O1', 'Trà Tối — Outlet 1' FROM brands WHERE code = 'TRA_TOI';
INSERT INTO outlets (brand_id, code, name)
SELECT id, 'TRA_O2', 'Trà Tối — Outlet 2' FROM brands WHERE code = 'TRA_TOI';
```

**Sau migration 017:** POS đọc `outlet_id` từ `users.outlet_id` của account đăng nhập,
gắn tự động vào order — staff không chọn thủ công.

**POS logic (đã implement):**
- `init()` query `users?id=eq.{session.id}&select=outlet_id` → `posOutletId`
- Nếu có `outlet_id` → query `outlets?id=eq.{posOutletId}&select=brand_id` → `posBrandId`
- `confirmPay()` → `DB.insert('orders', {..., outlet_id: posOutletId, brand_id: posBrandId})`
- Owner/manager không có outlet_id → cả hai = `undefined` (không lỗi)

---

## MENU & CÔNG THỨC

| Sản phẩm | Giá | Công thức |
|---|---|---|
| Cà phê đen | 18.000đ | 60ml cốt CF + 20ml nước đường |
| Cà phê sữa | 20.000đ | 50ml cốt CF + 20g sữa đặc |
| Cà phê sữa tươi | 22.000đ | 30ml cốt CF + 30g sữa đặc + 70ml sữa tươi |
| Cà phê kem muối | 24.000đ | 50ml cốt CF + 20g sữa đặc + 30g kem muối |
| Matcha latte | 23.000đ | 40ml cốt matcha + 30g sữa đặc + 70ml sữa tươi |
| Cacao latte | 23.000đ | 40ml cốt cacao + 30g sữa đặc + 70ml sữa tươi |

Mỗi ly: 1 ly + 1 nắp + 1 ống hút. Logic túi: lẻ → túi chữ T, chẵn → túi đôi.

## BÁN THÀNH PHẨM

| BTP | Công thức | Yield |
|---|---|---|
| Cốt cà phê | 200g cà phê + 650ml nước | 500ml |
| Cốt cacao | 200g cacao + 1000ml nước | 1000ml |
| Cốt matcha | 100g matcha + 1000ml nước | 1000ml |
| Kem muối | 100g bột kem muối + 200ml sữa tươi | 300g |
| Nước đường | 600g đường + 1000ml nước | 1000ml |

---

## PHÂN QUYỀN

| Tính năng | staff | manager | owner |
|---|:---:|:---:|:---:|
| POS bán hàng | ✓ | ✓ | ✓ |
| Xem tồn kho BTP + vật tư | ✓ | ✓ | ✓ |
| Xem tồn kho nguyên liệu thô | — | ✓ | ✓ |
| Nhập kho / pha BTP | — | ✓ | ✓ |
| Xem doanh thu | — | ✓ | ✓ |
| Báo cáo tài chính P&L | — | ✓ | ✓ |
| Quản lý SKU | — | — | ✓ |
| Quản lý menu & công thức | — | — | ✓ |
| Tạo/sửa/xoá tài khoản | — | — | ✓ |

---

## ROUTING SAU ĐĂNG NHẬP
- `staff` → `src/pos/index.html`
- `manager` / `owner` → `src/home/index.html`

---

## GHI CHÚ KỸ THUẬT
- Supabase REST API qua `src/lib/supabase.js`
- Supabase đã migrate sang ECC P-256 asymmetric JWT (15/04/2026)
- localStorage chỉ dùng cho `fnb_session`
- GitHub Pages tự deploy khi push main
- Giá vốn BQ: `(Tồn cũ × Giá BQ cũ + Qty nhập × Đơn giá thực) ÷ (Tồn cũ + Qty nhập)`
- `semi_recipes` dùng cột `raw_id`, `semi_products` dùng cột `yields`
- Mã đơn `order_num`: toàn cục, format `#001` `#002`... POS đọc max từ DB khi init
- DOW = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy']
- SheetJS (xlsx.js CDN): xuất Excel trong revenue + finance
- Orders layout: `height:100dvh;overflow:hidden`, scroll trong `.content`, card cần `flex-shrink:0`
- Orders scrollbar: `scrollbar-width:none` + `::-webkit-scrollbar{display:none}`
- `purchase_order_items.item_id` = `raw_stock.id` trực tiếp (không join qua sku_items)
- COGS: avg_cost = Σ(total_price)/Σ(base_qty) từ PO received/completed
- `fnb_session` trong localStorage KHÔNG lưu `outlet_id` — POS phải query `users` table để lấy

---

## TRẠNG THÁI MODULES

| Module | File | Trạng thái |
|---|---|:---:|
| Auth | src/auth/ | ✅ |
| Home | src/home/ | ✅ cần filter đa brand P2 |
| POS | src/pos/ | ✅ đã gắn brand_id/outlet_id tự động |
| Inventory | src/inventory/ | ✅ |
| Supplies | src/supplies/ | ✅ |
| Purchasing | src/purchasing/ | ✅ |
| Orders | src/orders/ | ✅ |
| Revenue | src/revenue/ | ✅ cần filter brand/outlet P2 |
| Finance | src/finance/ | ✅ cần filter brand/outlet P2 |
| Schedule | src/schedule/ | ✅ |
| Menu | src/menu/ | ✅ |
| Settings | src/settings/ | ✅ |
| Assets | src/assets/ | ✅ |
| Contacts | src/contacts/ | ✅ |

---

## CÁCH DÙNG FILE NÀY ĐỂ KHÔNG MẤT CONTEXT

**Với Claude CLI (vscode):**
Thêm dòng này vào đầu mỗi prompt hoặc tạo file `.claude/context.md` trỏ vào file này:
```
Đọc file CONTEXT.md trong repo trước khi làm bất cứ điều gì.
```

**Với Claude.ai chat:**
Paste toàn bộ nội dung file này vào đầu conversation mới.

**Sau mỗi session:**
Tải CONTEXT.md mới từ em về → thay thế file cũ trong repo → commit với message `docs: update CONTEXT.md`.