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
├── index.html                  ← entry point GitHub Pages (redirect về login)
├── CONTEXT.md                  ← file này
├── src/
│   ├── lib/
│   │   └── supabase.js         ← Supabase client dùng chung
│   ├── auth/
│   │   ├── auth.js             ← session management + phân quyền
│   │   └── login.html          ← đăng nhập qua Supabase users table
│   ├── home/
│   │   └── index.html          ← dashboard theo role
│   ├── pos/
│   │   └── index.html          ← POS bán hàng
│   ├── inventory/
│   │   └── index.html          ← tồn kho + pha BTP
│   ├── revenue/
│   │   └── index.html          ← doanh thu
│   ├── finance/
│   │   └── index.html          ← P&L + chi phí + giá vốn
│   └── schedule/
│       └── index.html          ← check-in/check-out
```

---

## DATABASE SUPABASE — MIGRATION HISTORY

### Migration 001 — Bảng gốc (đã chạy)
Tạo các bảng: `users`, `orders`, `stock_receipts`, `raw_stock`, `semi_stock`, `expenses`, `schedule_logs`

### Migration Supplies & Purchase Orders (đã chạy)
Tạo các bảng: `purchase_orders`, `purchase_order_items`, `supplies`

Seed vật tư tiêu hao:
- `ly` — Ly (consumable, cái, warn: 50)
- `nap` — Nắp (consumable, cái, warn: 50)
- `ong_hut` — Ống hút (consumable, cái, warn: 50)
- `muong` — Muỗng (consumable, cái, warn: 30)
- `tui_don` — Túi chữ T (consumable, cái, warn: 30)
- `tui_doi` — Túi đôi (consumable, cái, warn: 20)

### Migration 002 — Bảng cấu hình động (đã chạy: 10/04/2026)
Tạo các bảng:
- `settings` — cài đặt hệ thống (key-value)
- `raw_materials` — nguyên liệu thô (động, thay thế hardcode)
- `semi_products` — bán thành phẩm (động)
- `semi_recipes` — công thức pha bán thành phẩm
- `products` — menu sản phẩm (động)
- `product_recipes` — công thức từng sản phẩm
- `unit_conversions` — đơn vị tính và tỷ lệ quy đổi

### Migration 003 — Seed dữ liệu mặc định (đã chạy: 10/04/2026)
Đã insert:
- settings: bank_id, account_no, account_name, transfer_content, app_name, open_hour, close_hour, late_grace_minutes
- raw_materials: ca_phe_bot, cacao_bot, matcha_bot, bot_kem_muoi, sua_dac, sua_tuoi, duong, nuoc
- semi_products: cot_ca_phe, cot_cacao, cot_matcha, kem_muoi, nuoc_duong
- semi_recipes: công thức pha 5 BTP (cốt cà phê dùng 650ml nước)
- products: 6 sản phẩm (Cà phê đen, Cà phê sữa, Cà phê sữa tươi, Cà phê kem muối, Matcha latte, Cacao latte)
- product_recipes: công thức cho 6 sản phẩm (gồm cả ly, nắp, ống hút tự động)
- unit_conversions: thùng/hộp sữa tươi, kg cà phê/đường, lon sữa đặc, lốc ly/nắp, hộp ống hút

---

## TỔNG HỢP 17 BẢNG HIỆN CÓ

| Bảng | Mô tả | Migration |
|---|---|---|
| users | Tài khoản nhân viên | 001 |
| orders | Đơn hàng từ POS | 001 |
| stock_receipts | Phiếu nhập kho cũ | 001 |
| raw_stock | Tồn kho nguyên liệu thô + giá vốn BQ | 001 |
| semi_stock | Tồn kho bán thành phẩm | 001 |
| expenses | Chi phí vận hành | 001 |
| schedule_logs | Lịch trình check-in/check-out | 001 |
| purchase_orders | Phiếu nhập hàng (header) | Supplies |
| purchase_order_items | Chi tiết phiếu nhập hàng | Supplies |
| supplies | Vật tư tiêu hao + công cụ dụng cụ | Supplies |
| settings | Cài đặt hệ thống (key-value) | 002 |
| raw_materials | Nguyên liệu thô (cấu hình động) | 002 |
| semi_products | Bán thành phẩm (cấu hình động) | 002 |
| semi_recipes | Công thức pha bán thành phẩm | 002 |
| products | Menu sản phẩm (cấu hình động) | 002 |
| product_recipes | Công thức từng sản phẩm | 002 |
| unit_conversions | Đơn vị tính và tỷ lệ quy đổi | 002 |

---

## PHÂN QUYỀN

| Tính năng | staff | manager | owner |
|---|:---:|:---:|:---:|
| POS bán hàng | ✓ | ✓ | ✓ |
| Đổi mật khẩu bản thân | ✓ | ✓ | ✓ |
| Xem tồn kho (bán TP + vật tư) | ✓ | ✓ | ✓ |
| Kiểm tra tồn kho từ POS (bottom sheet) | ✓ | ✓ | ✓ |
| Xem tồn kho nguyên liệu thô tổng | — | ✓ | ✓ |
| Nhập kho / pha bán TP | — | ✓ | ✓ |
| Xem doanh thu | — | ✓ | ✓ |
| Báo cáo tài chính | — | ✓ | ✓ |
| Lịch trình | — | ✓ | ✓ |
| Quản lý nguyên liệu (thêm/sửa) | — | ✓ | ✓ |
| Quản lý menu & giá | — | — | ✓ |
| Quản lý công thức pha chế | — | — | ✓ |
| Tạo/sửa/xoá tài khoản | — | — | ✓ |
| Phân quyền tài khoản | — | — | ✓ |
| Cài đặt thanh toán QR | — | — | ✓ |
| Cài đặt hệ thống | — | — | ✓ |

---

## ROUTING SAU ĐĂNG NHẬP
- `staff` → thẳng vào POS (`src/pos/index.html`)
- `manager` / `owner` → Home dashboard (`src/home/index.html`)

---

## MENU & CÔNG THỨC HIỆN TẠI

| Sản phẩm | Giá | Công thức chính |
|---|---|---|
| Cà phê đen | 18.000đ | 60ml cốt CF + 20ml nước đường |
| Cà phê sữa | 20.000đ | 50ml cốt CF + 20g sữa đặc |
| Cà phê sữa tươi | 22.000đ | 30ml cốt CF + 30g sữa đặc + 70ml sữa tươi |
| Cà phê kem muối | 24.000đ | 50ml cốt CF + 20g sữa đặc + 30g kem muối |
| Matcha latte | 23.000đ | 40ml cốt matcha + 30g sữa đặc + 70ml sữa tươi |
| Cacao latte | 23.000đ | 40ml cốt cacao + 30g sữa đặc + 70ml sữa tươi |

Mỗi ly tự động trừ: 1 ly + 1 nắp + 1 ống hút

---

## BÁN THÀNH PHẨM & CÔNG THỨC PHA

| BTP | Công thức | Yield |
|---|---|---|
| Cốt cà phê | 200g cà phê + 650ml nước | 500ml |
| Cốt cacao | 200g cacao + 1000ml nước | 1000ml |
| Cốt matcha | 100g matcha + 1000ml nước | 1000ml |
| Kem muối | 100g bột kem muối + 200ml sữa tươi | 300g |
| Nước đường | 600g đường + 1000ml nước | 1000ml |

---

## LOGIC TÚI

- Mỗi đơn luôn có **1 túi chữ T** (túi đơn)
- Nếu tổng số ly chia hết cho 2 → thay bằng **1 túi đôi**
- Hệ thống tự tính và trừ tồn kho túi sau mỗi đơn

---

## VẬT TƯ TIÊU HAO

| ID | Tên | Đơn vị | Cảnh báo |
|---|---|---|---|
| ly | Ly | cái | 50 |
| nap | Nắp | cái | 50 |
| ong_hut | Ống hút | cái | 50 |
| muong | Muỗng | cái | 30 |
| tui_don | Túi chữ T | cái | 30 |
| tui_doi | Túi đôi | cái | 20 |

---

## ĐƠN VỊ TÍNH QUY ĐỔI MẶC ĐỊNH

| Nguyên liệu | Đơn vị nhập | Đơn vị cơ bản | Tỷ lệ |
|---|---|---|---|
| Sữa tươi | thùng | ml | 12000 |
| Sữa tươi | hộp | ml | 1000 |
| Cà phê bột | kg | g | 1000 |
| Đường | kg | g | 1000 |
| Sữa đặc | lon | g | 380 |
| Ly | lốc | cái | 50 |
| Nắp | lốc | cái | 50 |
| Ống hút | hộp | cái | 200 |

---

## TÀI KHOẢN MẶC ĐỊNH (CẦN ĐỔI MẬT KHẨU)

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| admin | admin123 | owner |
| manager | manager123 | manager |
| staff | staff123 | staff |

---

## TRẠNG THÁI MODULES

| Module | File | Trạng thái | Ghi chú |
|---|---|:---:|---|
| Auth | src/auth/ | ✓ Done | Supabase users table |
| Home | src/home/ | ✓ Done | Dashboard theo role |
| POS | src/pos/ | 🔄 Cần update | Thêm nút Home cho admin/manager, bottom sheet tồn kho cho staff, logic túi, đọc menu từ Supabase |
| Inventory | src/inventory/ | 🔄 Cần update | Phân quyền chi tiết, đọc từ raw_materials/semi_products |
| Revenue | src/revenue/ | ✓ Done | Supabase |
| Finance | src/finance/ | ✓ Done | Supabase |
| Schedule | src/schedule/ | ✓ Done | Supabase |
| **Purchasing** | src/purchasing/ | ❌ Chưa có | Module nhập hàng riêng — phiếu nhập nhiều mặt hàng, đơn vị tính phức tạp |
| **Settings** | src/settings/ | ❌ Chưa có | Quản lý tài khoản, menu, công thức, QR, cài đặt hệ thống |

---

## PENDING — CẦN LÀM TIẾP

### 1. Cập nhật POS (`src/pos/index.html`)
- Đọc menu từ bảng `products` + `product_recipes` (không hardcode)
- Thêm nút quay về Home cho admin/manager
- Thêm bottom sheet kiểm tra tồn kho cho staff (bán TP + vật tư)
- Logic túi tự động (chữ T hoặc túi đôi)
- Trừ vật tư tiêu hao (ly, nắp, ống hút, túi) sau mỗi đơn

### 2. Cập nhật Inventory (`src/inventory/index.html`)
- Đọc dữ liệu từ `raw_materials`, `semi_products`, `semi_recipes`
- Staff: chỉ thấy bán TP + vật tư tiêu hao
- Manager/Owner: thấy toàn bộ kể cả nguyên liệu thô tổng

### 3. Tạo mới Purchasing (`src/purchasing/index.html`)
- Tạo phiếu nhập với nhiều mặt hàng cùng lúc
- Hỗ trợ đơn vị tính phức tạp (thùng → hộp → ml)
- Tự động cập nhật giá vốn BQ khi lưu phiếu
- Nhập được: nguyên liệu thô, vật tư tiêu hao, công cụ dụng cụ

### 4. Tạo mới Settings (`src/settings/index.html`) — chỉ owner
- Quản lý tài khoản: tạo/sửa/xoá, phân quyền, đổi mật khẩu
- Đổi mật khẩu bản thân (tất cả roles)
- Quản lý menu: thêm/sửa/xoá sản phẩm, giá, icon, công thức
- Quản lý nguyên liệu: thêm raw_materials, semi_products, công thức
- Quản lý đơn vị tính: thêm unit_conversions
- Cài đặt QR thanh toán: bank_id, account_no, account_name
- Cài đặt hệ thống: giờ mở/đóng, ngưỡng trễ

---

## GHI CHÚ KỸ THUẬT

- Dữ liệu lưu trên **Supabase cloud** — đồng bộ mọi thiết bị
- localStorage **không còn dùng** cho dữ liệu nghiệp vụ
- GitHub Pages deploy tự động khi push lên main branch
- Chart.js load từ cdnjs.cloudflare.com
- VietQR API: `img.vietqr.io/image/{bankId}-{accountNo}-compact2.jpg`
- Giá vốn: **Bình quân gia quyền** — tự tính lại mỗi lần nhập kho mới
- Công thức: `Giá BQ mới = (Tồn cũ × Giá BQ cũ + Số nhập × Giá nhập) ÷ (Tồn cũ + Số nhập)`