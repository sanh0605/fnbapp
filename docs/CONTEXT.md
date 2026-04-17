# FNB App — CONTEXT.md
# Cập nhật lần cuối: 17/04/2026 (session 7 — home page + POS tabs + routing fix)

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

### ✅ P1 — Hoàn thành 17/04/2026
- [x] **Migration 017** — bảng `brands` + `outlets`, `brand_id`/`outlet_id` trên `orders` + `users`, RLS, seed 2 brands + 7 outlets
- [x] **Migration 018** — cột `client_id uuid` + UNIQUE INDEX trên `orders` (idempotent offline sync)
- [x] **Password hashing** — cột DB là `password_hash` (SHA-256). `login.html` và `settings/index.html` đã hash client-side bằng Web Crypto API trước khi query
- [x] **IDB offline queue** — `src/lib/idb-service.js` (singleton, pending_orders store, retry ≤5). POS: `confirmPay()` → IDB trước, sync khi online. Badge hiển thị count pending khi offline
- [x] **Brand filter** — `initBrandFilter()` có trong `home`, `revenue`. Manager chỉ thấy brand của outlet mình (`users.outlet_id → outlets.brand_id`)
- [x] **PO Edit** — Owner có thể sửa đơn nhập hàng mọi trạng thái. Sửa được `received_at`, `completed_at`, ngày thanh toán. Danh sách sản phẩm có scroll

### ✅ P2 — Hoàn thành 17/04/2026
1. ✅ **`src/lib/utils.js`** — `fmt()` locale `vi-VN`, `fmtDate()`, `toast()`. 14 file đã dùng
2. ✅ **Service files** — toàn bộ DB logic đã tách ra khỏi HTML:
   - `finance-service.js` — fetchCogsCtx, fetchOrders, fetchExpenses, fetchExpenseById, saveExpense, deleteExpense, calcCOGS, calcExpenseAmount
   - `purchasing-service.js` — fetchInitData, fetchPOs, fetchPODetail, fetchPOWithPayments, createPO, updatePO, updatePOStatus, receiveInventory, createPayment, updatePaymentDate
   - `revenue-service.js` — fetchOrders
   - `settings-service.js` — fetchInitData, fetchUsers, saveUser, deleteUser, changePassword, saveSettings
3. ✅ **Menu cache offline** — `cacheMenu()` / `getMenu()` trong `idb-service.js`. POS online → cache menu vào IDB sau mỗi lần tải. POS offline → load từ cache; nếu chưa có cache thì báo lỗi rõ ràng
4. ✅ **Tách HTML/JS** — 15 file HTML đã thuần markup; toàn bộ logic đã chuyển sang file `.js` riêng (xem cấu trúc thư mục)

### ✅ P3 — Hoàn thành 17/04/2026 (scope refactor + home page)
- [x] **Thu hẹp scope** — Xoá: inventory, purchasing, finance, schedule, supplies, assets, contacts, finance-service.js, purchasing-service.js
- [x] **Giữ lại:** POS, Orders, Revenue, Menu, Settings, Auth, Home
- [x] **POS đơn giản hoá** — Bỏ deductIngredients + stockSheet. Chỉ giữ: ghi đơn + thanh toán + offline IDB
- [x] **POS 3 tab** — Bán hàng / Hôm nay (danh sách đơn hôm nay + void) / Tổng kết (count/total/avg/by-method)
- [x] **Home page** — `src/home/` navigation hub, stats card hôm nay cho manager/owner, feature cards theo role
- [x] **Routing sau login** — staff → POS, manager/owner → Home
- [x] **Back buttons** — revenue, menu, settings đều về Home; orders dùng history.back()
- [x] **Permissions rút gọn** — owner: pos/revenue/menu/payment_settings/user_settings; manager: pos/revenue; staff: pos

### 🗂 Backlog
- [ ] RLS thực sự — migrate sang Supabase Auth để `auth.uid()` dùng được trong policy
- [ ] Brand 2: dine-in + table management
- [ ] KDS — màn hình bếp/pha chế
- [ ] Pre-order / tích hợp app giao hàng
- [ ] Loyalty / tích điểm khách hàng

---

## CẤU TRÚC THƯ MỤC

```
fnbapp/
├── index.html
├── CONTEXT.md               ← file này — commit sau mỗi session
├── migrations/              ← SQL 001–018
├── src/
│   ├── lib/
│   │   ├── supabase.js          ← DB helper + hashPassword(); key chỉ để ở đây
│   │   ├── utils.js             ← fmt(), fmtDate(), toast()
│   │   ├── idb-service.js       ← IndexedDB offline queue + menu cache
│   │   ├── revenue-service.js
│   │   └── settings-service.js
│   ├── auth/
│   │   ├── auth.js              ← Auth singleton; permissions: owner/manager/staff
│   │   ├── login.html
│   │   └── login.js             ← staff→POS, manager/owner→Home
│   ├── home/
│   │   ├── index.html           ← navigation hub; stats card cho manager/owner
│   │   └── home.js              ← brand filter + loadStats + renderCards (role-based)
│   ├── pos/
│   │   ├── index.html
│   │   └── pos.js               ← ghi đơn + thanh toán + 3 tab (Bán hàng/Hôm nay/Tổng kết)
│   ├── orders/
│   │   ├── index.html
│   │   ├── orders.js
│   │   ├── edit.html
│   │   └── edit.js
│   ├── revenue/
│   │   ├── index.html
│   │   └── revenue.js
│   ├── menu/
│   │   ├── index.html
│   │   └── menu.js
│   └── settings/
│       ├── index.html
│       └── settings.js
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

### Migration 017 — Multi-brand/outlet ✅ ĐÃ CHẠY 17/04/2026
- Bảng `brands` + `outlets`, `brand_id`/`outlet_id` trên `orders` + `users`
- RLS enabled, policy `USING (true)` cho cả hai bảng
- Seed: CF_SANG (5 outlets CF_O1–O5), TRA_TOI (2 outlets TRA_O1–O2)

**POS logic:**
- `init()` → `users?id=eq.{session.id}&select=outlet_id` → `posOutletId`
- Nếu có `outlet_id` → `outlets?id=eq.{posOutletId}&select=brand_id` → `posBrandId`
- `confirmPay()` → `{..., outlet_id: posOutletId, brand_id: posBrandId}`

### Migration 018 — Offline idempotency ✅ ĐÃ CHẠY 17/04/2026
- `orders.client_id uuid` + UNIQUE INDEX `WHERE client_id IS NOT NULL`
- POS tạo UUID per order, 409 khi sync = đã tồn tại → bỏ qua, xoá khỏi IDB queue

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
- **Password:** cột DB là `password_hash` (SHA-256, không phải `password`). Hash client-side bằng `crypto.subtle.digest` trước khi query
- **Offline POS:** `idb-service.js` — `addPendingOrder()` / `syncPendingOrders()` / `cacheMenu()` / `getMenu()`. Stores: `pending_orders` (keyPath=`local_id`), `cached_menu` (keyPath=`id`). Max retry=5. 409=already synced. Menu cache: online→tự cập nhật sau mỗi init; offline→load cache, nếu trống→báo lỗi
- **Brand filter pattern:** `initBrandFilter()` async, set `brandFilter = '&brand_id=eq.{id}'` nếu role=manager. Owner/staff = không filter. Có trong: home.js, revenue.js
- **PO Edit:** không có cột `updated_at` trong `purchase_orders` — không được thêm vào UPDATE payload

---

## TRẠNG THÁI MODULES

| Module | File | Trạng thái |
|---|---|:---:|
| Auth | src/auth/ | ✅ |
| Home | src/home/ | ✅ brand filter + stats + feature cards |
| POS | src/pos/ | ✅ 3 tab + brand/outlet filter + offline IDB |
| Orders | src/orders/ | ✅ |
| Revenue | src/revenue/ | ✅ brand filter done |
| Menu | src/menu/ | ✅ |
| Settings | src/settings/ | ✅ |

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