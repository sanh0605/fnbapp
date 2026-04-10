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
├── index.html                  ← entry point (redirect về login)
├── CONTEXT.md
├── src/
│   ├── lib/
│   │   └── supabase.js         ← Supabase REST client dùng chung
│   ├── auth/
│   │   ├── auth.js             ← session + phân quyền
│   │   └── login.html          ← đăng nhập, routing theo role
│   ├── home/
│   │   └── index.html          ← dashboard (manager/owner)
│   ├── pos/
│   │   └── index.html          ← POS bán hàng (tất cả roles)
│   ├── inventory/
│   │   └── index.html          ← tồn kho + pha BTP
│   ├── purchasing/
│   │   └── index.html          ← phiếu nhập hàng
│   ├── revenue/
│   │   └── index.html          ← doanh thu
│   ├── finance/
│   │   └── index.html          ← P&L + chi phí + giá vốn
│   ├── schedule/
│   │   └── index.html          ← check-in/check-out
│   └── settings/
│       └── index.html          ← cài đặt hệ thống
```

---

## DATABASE — 17 BẢNG HIỆN CÓ

### Migration 001 — Bảng gốc
`users`, `orders`, `stock_receipts`, `raw_stock`, `semi_stock`, `expenses`, `schedule_logs`

### Migration Supplies & PO
`purchase_orders`, `purchase_order_items`, `supplies`

Seed supplies: `ly`, `nap`, `ong_hut`, `muong`, `tui_don`, `tui_doi`

### Migration 002 — Bảng cấu hình động (10/04/2026)
`settings`, `raw_materials`, `semi_products`, `semi_recipes`, `products`, `product_recipes`, `unit_conversions`

### Migration 003 — Seed dữ liệu mặc định (10/04/2026)
- settings: bank_id, account_no, account_name, transfer_content, app_name, open_hour(6), close_hour(10), late_grace_minutes(15)
- raw_materials: ca_phe_bot, cacao_bot, matcha_bot, bot_kem_muoi, sua_dac, sua_tuoi, duong, nuoc
- semi_products: cot_ca_phe, cot_cacao, cot_matcha, kem_muoi, nuoc_duong
- semi_recipes: công thức pha 5 BTP (cốt cà phê: 200g + 650ml nước → 500ml)
- products: 6 sản phẩm
- product_recipes: công thức gồm cả ly, nắp, ống hút tự động
- unit_conversions: thùng/hộp sữa, kg cà phê/đường, lon sữa đặc, lốc ly/nắp, hộp ống hút

---

## TRẠNG THÁI MODULES (tất cả đã hoàn thành)

| Module | File | Trạng thái | Ghi chú |
|---|---|:---:|---|
| Auth | src/auth/ | ✓ | Supabase, routing theo role |
| Home | src/home/ | ✓ | Dashboard manager/owner |
| POS | src/pos/ | ✓ | Menu từ DB, logic túi, bottom sheet tồn kho, nút Home |
| Inventory | src/inventory/ | ✓ | Phân quyền chi tiết, dynamic data |
| Purchasing | src/purchasing/ | ✓ | Phiếu nhập nhiều mặt hàng, đơn vị tính phức tạp |
| Revenue | src/revenue/ | ✓ | Supabase |
| Finance | src/finance/ | ✓ | P&L, chi phí, giá vốn BQ |
| Schedule | src/schedule/ | ✓ | Check-in/out, thống kê |
| Settings | src/settings/ | ✓ | Tài khoản, menu, QR, hệ thống |

---

## ROUTING SAU ĐĂNG NHẬP
- `staff` → `src/pos/index.html`
- `manager` / `owner` → `src/home/index.html`

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
| Lịch trình check-in/out | — | ✓ | ✓ |
| Quản lý nguyên liệu (thêm/sửa) | — | ✓ | ✓ |
| Quản lý menu & giá | — | — | ✓ |
| Quản lý công thức pha chế | — | — | ✓ |
| Tạo/sửa/xoá tài khoản | — | — | ✓ |
| Phân quyền tài khoản | — | — | ✓ |
| Cài đặt thanh toán QR | — | — | ✓ |
| Cài đặt hệ thống | — | — | ✓ |

---

## MENU & CÔNG THỨC

| Sản phẩm | Giá | Công thức chính |
|---|---|---|
| Cà phê đen | 18.000đ | 60ml cốt CF + 20ml nước đường |
| Cà phê sữa | 20.000đ | 50ml cốt CF + 20g sữa đặc |
| Cà phê sữa tươi | 22.000đ | 30ml cốt CF + 30g sữa đặc + 70ml sữa tươi |
| Cà phê kem muối | 24.000đ | 50ml cốt CF + 20g sữa đặc + 30g kem muối |
| Matcha latte | 23.000đ | 40ml cốt matcha + 30g sữa đặc + 70ml sữa tươi |
| Cacao latte | 23.000đ | 40ml cốt cacao + 30g sữa đặc + 70ml sữa tươi |

Mỗi ly tự động trừ: 1 ly + 1 nắp + 1 ống hút

## BÁN THÀNH PHẨM

| BTP | Công thức | Yield |
|---|---|---|
| Cốt cà phê | 200g cà phê + 650ml nước | 500ml |
| Cốt cacao | 200g cacao + 1000ml nước | 1000ml |
| Cốt matcha | 100g matcha + 1000ml nước | 1000ml |
| Kem muối | 100g bột kem muối + 200ml sữa tươi | 300g |
| Nước đường | 600g đường + 1000ml nước | 1000ml |

## LOGIC TÚI
- Mỗi đơn có 1 **túi chữ T** (tui_don)
- Nếu tổng số ly chia hết cho 2 → thay bằng 1 **túi đôi** (tui_doi)

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

## GHI CHÚ KỸ THUẬT
- Dữ liệu lưu trên **Supabase cloud** — đồng bộ mọi thiết bị
- localStorage chỉ dùng cho `fnb_session` (session đăng nhập)
- GitHub Pages tự deploy khi push lên main
- VietQR API: `img.vietqr.io/image/{bankId}-{accountNo}-compact2.jpg`
- Giá vốn BQ: `(Tồn cũ × Giá BQ cũ + Số nhập × Giá nhập) ÷ (Tồn cũ + Số nhập)`
- Supabase REST API dùng qua `src/lib/supabase.js` — không dùng SDK

---

## VIỆC CẦN LÀM SAU KHI DEPLOY

1. **Đổi mật khẩu** — vào Settings → đổi mật khẩu admin, manager, staff
2. **Điền thông tin QR** — Settings → Thanh toán QR → điền số tài khoản ACB thật
3. **Nhập giá vốn nguyên liệu** — Finance → Tab Giá vốn
4. **Nhập tồn kho ban đầu** — Nhập hàng → Tạo phiếu nhập đầu tiên
5. **Pha bán thành phẩm** — Nguyên liệu → Pha BTP cho ca đầu tiên
6. **Lưu app vào iPhone** — Safari → sanh0605.github.io/fnbapp → Share → Add to Home Screen