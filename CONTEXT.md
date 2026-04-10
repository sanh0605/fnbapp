# FNB App — CONTEXT.md
# Cập nhật lần cuối: 10/04/2026

## THÔNG TIN DỰ ÁN
- **Repo GitHub:** github.com/sanh0605/fnbapp (Public)
- **App live:** https://sanh0605.github.io/fnbapp
- **Supabase project:** https://zicuawpwyhmtqmzawvau.supabase.co
- **Supabase anon key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY3Vhd3B3eWhtdHFtemF3dmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Njc4MzcsImV4cCI6MjA5MTM0MzgzN30.gWia6lTXfHcwewH62i3xjlcqNpZBwLo7U7ig_v5ZcpM
- **Môi trường:** vscode.dev + GitHub Pages + Supabase

---

## CẤU TRÚC THƯ MỤC

```
fnbapp/
├── index.html
├── CONTEXT.md
├── src/
│   ├── lib/supabase.js
│   ├── auth/auth.js + login.html
│   ├── home/index.html
│   ├── pos/index.html
│   ├── inventory/index.html
│   ├── purchasing/index.html
│   ├── assets/index.html
│   ├── contacts/index.html
│   ├── menu/index.html
│   ├── revenue/index.html
│   ├── finance/index.html
│   ├── schedule/index.html
│   └── settings/index.html
```

---

## DATABASE — 22 BẢNG HIỆN CÓ

### Migration 001 — Bảng gốc
`users`, `orders`, `stock_receipts`, `raw_stock`, `semi_stock`, `expenses`, `schedule_logs`

### Migration Supplies & PO (cũ)
`purchase_orders` *(đã ALTER thêm cột)*, `purchase_order_items` *(đã ALTER)*, `supplies`

### Migration 002 — Bảng cấu hình động
`settings`, `raw_materials`, `semi_products`, `semi_recipes`, `products`, `product_recipes`, `unit_conversions`

### Migration 003 — Seed dữ liệu mặc định
- settings: bank_id=ACB, account_no=XXXXXXXXXX, open_hour=6, close_hour=10, late_grace_minutes=15
- raw_materials: ca_phe_bot, cacao_bot, matcha_bot, bot_kem_muoi, sua_dac, sua_tuoi, duong, nuoc
- semi_products: cot_ca_phe, cot_cacao, cot_matcha, kem_muoi, nuoc_duong
- products: 6 sản phẩm với công thức đầy đủ
- supplies: ly, nap, ong_hut, muong, tui_don, tui_doi
- unit_conversions: thùng/hộp sữa, kg, lon, lốc, hộp

### Migration 004 — Purchase Management System (10/04/2026) ✅
Bảng mới:
- `suppliers` — nhà cung cấp (code, name, phone, email, address, platform, platform_url)
- `sku_items` — sản phẩm nhập kho theo thương hiệu, map về raw_materials/supplies
- `sku_units` — đơn vị tính của từng SKU (ml/hộp/thùng + tỷ lệ quy đổi về base_unit)
- `po_adjustments` — chiết khấu/phí tự thêm cho từng đơn (discount/fee/other)
- `po_payments` — ghi nhận thanh toán nhiều lần (cash/transfer/cod/other)

Cột mới trong `purchase_orders`:
- supplier_id, status (pending/received/completed)
- platform, platform_order_id (mã đơn sàn TMĐT)
- debt_due_date (hạn công nợ)
- shipping_fee, received_at, completed_at

Cột mới trong `purchase_order_items`:
- sku_id, sku_unit, to_base_rate
- amount_before_discount, discount_amount, amount_after_discount

Seed mẫu:
- suppliers: NCC-001 (Nhà cung cấp chung)
- sku_items: NVL-SUA-MLK (Sữa tươi Mlekovita → map_to: sua_tuoi)
- sku_units: ml/hộp/thùng cho Mlekovita

Quản lý:
- SKU: tab "Danh mục SKU" trong Inventory (owner only), mã tự sinh NVL-/VTU-/CCU-XXX
- Đơn vị tính SKU: thêm/xoá sku_units inline trong sheet SKU
- Nhà cung cấp & liên lạc: module Contacts riêng (xem Migration 005)

### Migration 007 — Seed SKUs thực tế (11/04/2026) ✅
Seed dữ liệu thực tế:
- `raw_materials`: thêm 11 nguyên liệu mới (cà phê robusta/phin đậm, đường trắng, bột cacao DK, milk foam, matcha cozy, sữa đặc Vinamilk/Ngôi Sao/La rosee, sữa tươi TH/Mlekovita)
- `supplies`: thêm 11 vật tư tiêu hao (ly PET98, nắp, ống hút, muỗng, túi chữ T, túi đôi, giấy lót, găng tay, khăn lau, túi rác, túi lọc) + 37 công cụ dụng cụ (category='equipment')
- `sku_items`: 60 SKU — NVL-CF/DT/CA/MF/MT/SD/ST (nguyên liệu), VTU-LY/NP/OH/MG/TT/TD/GL/GT/KL/TR/TL (vật tư), CCU-xxx (dụng cụ)
- `sku_units`: quy đổi đơn vị cho tất cả SKU

Schema đã ALTER trước khi chạy (anh tự chạy trực tiếp trên Supabase):
- `raw_materials`: thêm cột `icon`, `warn_at`, `color`
- `sku_items`: thêm cột `type`, `map_to_id`, `map_to_type`, `base_unit`
- `sku_units`: thêm cột `to_base`, `description`

### Migration 006 — Assets (10/04/2026) ✅
Bảng mới:
- `assets` — tài sản (asset_code tự sinh TS-001..., name, asset_type, status, location, assigned_to→users, purchase_date, purchase_price, supplier_id→suppliers, useful_life_months, salvage_value, note, active)
- RLS enabled, policy allow_all_assets

Tính năng:
- Khấu hao đường thẳng: (purchase_price - salvage_value) / useful_life_months
- Group by: loại tài sản hoặc trạng thái
- Lọc theo status + asset_type, tìm kiếm tên/mã/loại
- Progress bar giá trị còn lại

### Migration 005 — Contacts (cần chạy trong Supabase Dashboard)
```sql
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS contact_type text NOT NULL DEFAULT 'nha_cung_cap';
```
Sau migration, bảng `suppliers` dùng chung cho tất cả loại liên lạc:
- `nha_cung_cap` — nhà cung cấp (NCC-XXX), dùng trong Purchasing
- `khach_hang`   — khách hàng (KH-XXX), dùng cho tích điểm sau này
- `nhuong_quyen` — đối tác nhượng quyền (NQ-XXX)
- `khac`         — khác (KC-XXX)

---

## THIẾT KẾ SKU

```
Nhóm nguyên liệu (raw_materials) — dùng trong công thức pha chế
  └─ sua_tuoi (Sữa tươi) — đơn vị cơ bản: ml

    SKU Items — sản phẩm nhập kho theo thương hiệu
      └─ NVL-SUA-MLK: Sữa tươi Mlekovita → map_to: sua_tuoi
           Đơn vị: ml(×1) / hộp(×1000) / thùng(×12000)
      └─ NVL-SUA-VNM: Sữa tươi Vinamilk → map_to: sua_tuoi
           Đơn vị: ml(×1) / hộp(×1000) / thùng(×12000)
```

Khi nhập 1 thùng Mlekovita → cộng 12.000ml vào raw_stock[sua_tuoi]
Khi xem tồn kho → hiện ml + quy đổi ngược ra hộp/thùng
Khi pha chế → trừ từ raw_stock[sua_tuoi] (không phân biệt thương hiệu)

---

## LUỒNG ĐƠN NHẬP HÀNG

```
Tạo đơn → [pending: Đang giao]
    ↓ Xác nhận nhận hàng
[received: Đã nhận hàng] → tồn kho cập nhật ngay
    ↓ Thanh toán đủ + xác nhận
[completed: Hoàn tất]
```

Cấu trúc tài chính đơn:
```
Tổng thành tiền sau CK từng dòng
+ Phí ship
+ Các điều chỉnh (po_adjustments: fee/discount/other)
= Tổng tiền phải trả

Đã thanh toán (tổng po_payments)
Còn nợ = Tổng - Đã TT
```

---

## PHÂN QUYỀN

| Tính năng | staff | manager | owner |
|---|:---:|:---:|:---:|
| POS bán hàng | ✓ | ✓ | ✓ |
| Đổi mật khẩu bản thân | ✓ | ✓ | ✓ |
| Kiểm tra tồn kho từ POS | ✓ | ✓ | ✓ |
| Xem tồn kho (bán TP + vật tư) | ✓ | ✓ | ✓ |
| Xem tồn kho nguyên liệu thô | — | ✓ | ✓ |
| Nhập kho / pha bán TP | — | ✓ | ✓ |
| Nhập hàng (phiếu nhập) | — | ✓ | ✓ |
| Xem doanh thu | — | ✓ | ✓ |
| Báo cáo tài chính P&L | — | ✓ | ✓ |
| Lịch trình | — | ✓ | ✓ |
| Quản lý nguyên liệu | — | ✓ | ✓ |
| Xem & quản lý tài sản | — | ✓ | ✓ |
| Quản lý SKU & đơn vị tính | — | — | ✓ |
| Xem Liên lạc | — | ✓ | ✓ |
| Quản lý Liên lạc (CRUD) | — | — | ✓ |
| Quản lý menu & giá | — | — | ✓ |
| Quản lý công thức | — | — | ✓ |
| Tạo/sửa/xoá tài khoản | — | — | ✓ |
| Cài đặt QR & hệ thống | — | — | ✓ |

---

## ROUTING SAU ĐĂNG NHẬP
- `staff` → `src/pos/index.html`
- `manager` / `owner` → `src/home/index.html`

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

Mỗi ly: 1 ly + 1 nắp + 1 ống hút
Logic túi: lẻ → túi chữ T, chẵn → túi đôi

## BÁN THÀNH PHẨM

| BTP | Công thức | Yield |
|---|---|---|
| Cốt cà phê | 200g cà phê + 650ml nước | 500ml |
| Cốt cacao | 200g cacao + 1000ml nước | 1000ml |
| Cốt matcha | 100g matcha + 1000ml nước | 1000ml |
| Kem muối | 100g bột kem muối + 200ml sữa tươi | 300g |
| Nước đường | 600g đường + 1000ml nước | 1000ml |

---

## TÀI KHOẢN MẶC ĐỊNH (CẦN ĐỔI MẬT KHẨU)

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| admin | admin123 | owner |
| manager | manager123 | manager |
| staff | staff123 | staff |

---

## TRẠNG THÁI MODULES

| Module | File | Trạng thái |
|---|---|:---:|
| Auth | src/auth/ | ✓ |
| Home | src/home/ | ✓ |
| POS | src/pos/ | ✓ |
| Inventory | src/inventory/ | ✓ |
| Purchasing | src/purchasing/ | 🔄 Đang viết lại (v2) |
| Revenue | src/revenue/ | ✓ |
| Finance | src/finance/ | ✓ |
| Schedule | src/schedule/ | ✓ |
| Menu      | src/menu/      | ✓ Done (tách từ Settings) |
| Settings  | src/settings/  | ✓ Done (Menu → trang riêng) |
| Assets    | src/assets/    | ✓ Done — cần Migration 006 |
| Contacts  | src/contacts/  | ✓ Done (NCC · KH · NQ · Khác) — cần Migration 005 |

---

## GHI CHÚ KỸ THUẬT
- Supabase REST API qua `src/lib/supabase.js`
- localStorage chỉ dùng cho `fnb_session`
- GitHub Pages tự deploy khi push main
- Giá vốn BQ: `(Tồn cũ × Giá BQ cũ + Qty nhập × Đơn giá thực) ÷ (Tồn cũ + Qty nhập)`
- Đơn giá thực = amount_after_discount ÷ base_qty