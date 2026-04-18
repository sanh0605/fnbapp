# FNB App — CONTEXT.md
# Cập nhật lần cuối: 18/04/2026 (audit fixes D2–D7)

> **QUY TẮC CHO AI:** Đọc file này trước khi làm bất cứ điều gì. Sau mỗi thay đổi, cập nhật file này và commit ngay.

---

## THÔNG TIN DỰ ÁN

- **Repo GitHub:** github.com/sanh0605/fnbapp (Public)
- **App live:** https://sanh0605.github.io/fnbapp
- **Supabase project:** https://zicuawpwyhmtqmzawvau.supabase.co
- **Supabase key:** Chỉ lưu trong `src/lib/supabase.js` — KHÔNG commit vào đây
- **Môi trường:** VSCode + Claude CLI + GitHub Pages + Supabase

---

## BỐI CẢNH KINH DOANH

Hệ thống quản lý bán hàng FnB đa brand:

| | Brand 1 — Cà Phê Sáng | Brand 2 — Trà Tối |
|---|---|---|
| Khung giờ | 6:00–10:00 AM | Buổi tối |
| Hình thức | Take-away only | Take-away + Dine-in |
| Số outlet | 5 (CF_O1–CF_O5) | 2 (TRA_O1–TRA_O2) |

---

## KIẾN TRÚC

- **Không backend riêng** — Supabase RLS là tầng bảo mật duy nhất
- **Không framework frontend** — Vanilla HTML/CSS/JS
- **POS offline-first** — ghi vào IndexedDB trước, sync lên Supabase khi online
- **GitHub Pages** — auto-deploy khi push `main`

---

## DATABASE — 10 BẢNG (schema duy nhất: `migrations/019_reset_schema.sql`)

| Bảng | Mục đích |
|---|---|
| `brands` | Định nghĩa brand (CF_SANG, TRA_TOI) |
| `outlets` | Cơ sở vật lý, thuộc 1 brand |
| `users` | Tài khoản nhân viên (username/password_hash/role/outlet_id) |
| `orders` | Giao dịch bán hàng |
| `settings` | Cấu hình key-value (ngân hàng, giờ mở cửa) |
| `raw_materials` | Nguyên liệu thô |
| `semi_products` | Bán thành phẩm (BTP) |
| `supplies` | Vật tư (ly, nắp, ống hút...) |
| `products` | Menu sản phẩm bán tại POS |
| `product_recipes` | Công thức cho từng sản phẩm |

### Cột quan trọng — `orders`
- `method` text: `'Tiền mặt'` | `'Chuyển khoản'`
- `client_id` uuid: client-generated, unique partial index `WHERE client_id IS NOT NULL`
- `items` jsonb: `[{id, name, qty, price}]`
- `voided` boolean: soft delete

### Cột quan trọng — `users`
- `password_hash` text: SHA-256 hex, hash client-side bằng Web Crypto API
- `outlet_id`: null với manager/owner, bắt buộc với staff

---

## CẤU TRÚC THƯ MỤC

```
fnbapp/
├── index.html
├── docs/
│   ├── CONTEXT.md          ← file này
│   ├── ARCHITECTURE.md
│   └── TASK.md
├── migrations/
│   └── 019_reset_schema.sql  ← schema duy nhất
└── src/
    ├── lib/
    │   ├── supabase.js         ← DB helpers + hashPassword(); key chỉ ở đây
    │   ├── utils.js            ← fmt(), fmtDate(), toast()
    │   ├── idb-service.js      ← IndexedDB offline queue + menu cache
    │   ├── revenue-service.js  ← fetchOrders(from, to, brandFilter)
    │   └── settings-service.js ← fetchInitData, fetchUsers, saveUser, changePassword, saveSettings
    ├── auth/
    │   ├── auth.js             ← Auth singleton, permissions, session
    │   ├── login.html
    │   └── login.js            ← staff→POS, manager/owner→Home
    ├── home/
    │   ├── index.html
    │   └── home.js             ← navigation hub, stats hôm nay, feature cards
    ├── pos/
    │   ├── index.html
    │   └── pos.js              ← 1 màn bán hàng, bottom-sheet cart, offline IDB
    ├── orders/
    │   ├── index.html
    │   ├── orders.js
    │   ├── edit.html
    │   └── edit.js
    ├── revenue/
    │   ├── index.html
    │   └── revenue.js
    ├── menu/
    │   ├── index.html
    │   └── menu.js
    └── settings/
        ├── index.html
        └── settings.js
```

---

## ROUTING SAU ĐĂNG NHẬP

- `staff` → `src/pos/index.html`
- `manager` / `owner` → `src/home/index.html`

---

## PHÂN QUYỀN

| Tính năng | staff | manager | owner |
|---|:---:|:---:|:---:|
| POS bán hàng | ✓ | ✓ | ✓ |
| Void đơn (POS tab Hôm nay) | — | ✓ | ✓ |
| Xem lịch sử đơn | — | ✓ | ✓ |
| Sửa đơn | — | ✓ | ✓ |
| Xem doanh thu | — | ✓ | ✓ |
| Quản lý menu & công thức | — | — | ✓ |
| Quản lý tài khoản | — | — | ✓ |
| Cài đặt thanh toán | — | — | ✓ |

---

## POS UI — THIẾT KẾ HIỆN TẠI (18/04/2026)

- **Màu accent:** `#E03C31` (đỏ)
- **Layout menu:** 1 cột, mỗi card hàng ngang — ảnh 25% trái, tên/giá/ctrl phải
- **Category pills:** scroll ngang, active = đỏ, min-height 40px
- **Bottom cart:** fixed bottom, height 84px collapsed / `min(640px,88dvh)` expanded
  - Collapsed: pill badge đỏ (qty + icon ly nhựa) + tổng tiền `clamp(18px,6vw,28px)` + trash btn + toggle btn
  - Expanded: divider hiện, tổng tiền ẩn, list món + footer thanh toán
  - Swipe up (bottom 120px) → mở; swipe down khi đang mở → đóng
- **Buttons:** touch target 48×48, visual circle 24×24 (SVG embed circle bg)
- **Confirm button:** loading state (spinner) → success state (xanh ✓ 1s) → reset
- **Skeleton loading:** 4 card shimmer khi chờ menu load
- **Chiết khấu:** collapsed mặc định, tap "Chiết khấu ›" để mở (`#discBlock`). `actualRow` chỉ hiện khi có chiết khấu
- **Performance:** `add()`/`chg()` chỉ update card bị chạm, không re-render toàn menu. QR chỉ reload khi amount thay đổi (`lastQRAmount` cache)
- **Haptic:** `navigator.vibrate(20)` khi thêm món
- **Collapsed bar:** pill badge đỏ (qty + icon ly) + tổng tiền + trash btn — KHÔNG có nút TM/CK hay toggle
- Tap bất kỳ vào collapsed bar (trừ trash) → mở cart; tap backdrop → đóng cart
- Ghi chú ẩn mặc định → hiện khi bấm "+ Ghi chú" (`notesOpen` Set)
- Tap số lượng trong cart → inline input chỉnh trực tiếp (`editQty`)

---

## BẢO MẬT & DATA INTEGRITY (18/04/2026)

- **RLS:** `migrations/020_rls_tighten.sql` — orders/users không thể DELETE, orders INSERT yêu cầu `method` hợp lệ và `total >= 0`, orders UPDATE chỉ cho phép void, brands/outlets read-only
- **Offline sync:** `syncing` flag ngăn race condition khi 2 trigger cùng lúc. Dead-letter (retry ≥ 5) tự xoá sau khi hiện toast cảnh báo
- **Order number:** format `{outlet_id}-{seq}` (vd: `CF_O1-001`) khi có outlet, `#001` khi không có. Counter filter theo outlet khi init
- **BACKLOG còn lại:** Auth client-side only — cần migrate sang Supabase Auth để RLS có thể filter theo user

---

## GHI CHÚ KỸ THUẬT

- `fnb_session` trong localStorage **không** lưu `outlet_id` — POS phải query `users` table khi init
- **Brand filter:** `initBrandFilter()` async, set `brandFilter = '&brand_id=eq.{id}'` nếu role=manager. Owner/staff không filter. Có trong: `home.js`, `revenue.js`
- **POS init:** `users?id=eq.{session.id}` → `outlet_id` → `outlets?id=eq.{outletId}` → `brand_id`
- **Offline POS:** `idb-service.js` — stores: `pending_orders` (keyPath=`local_id`), `cached_menu` (keyPath=`id`). Max retry=5. HTTP 409 = đã sync → xóa khỏi queue
- **Password:** cột DB là `password_hash` (SHA-256). Hash client-side bằng `crypto.subtle.digest`
- **Mã đơn:** `order_num` format `#001`, `#002`... POS đọc max từ DB khi init
- **SheetJS (CDN):** dùng trong revenue để xuất Excel
- Supabase đã migrate sang ECC P-256 asymmetric JWT (15/04/2026)

---

## TRẠNG THÁI MODULES

| Module | File | Trạng thái |
|---|---|:---:|
| Auth | src/auth/ | ✅ |
| Home | src/home/ | ✅ brand filter + stats + feature cards |
| POS | src/pos/ | ✅ 1-col menu + bottom-sheet cart + brand/outlet auto-attach + offline IDB + rush-hour UX |
| Orders | src/orders/ | ✅ |
| Revenue | src/revenue/ | ✅ brand filter |
| Menu | src/menu/ | ✅ |
| Settings | src/settings/ | ✅ |

---

## SCOPE HIỆN TẠI

App chỉ tập trung vào 2 luồng cốt lõi:
1. **Bán hàng** — POS (offline-first, multi-outlet)
2. **Báo cáo** — Doanh thu theo ngày/tuần/tháng/năm, lọc theo brand

Các tính năng khác (inventory, purchasing, KDS, loyalty) sẽ được xây dựng lại từ đầu theo kiến trúc mới khi cần.

---

## BACKLOG

- [ ] **[P0]** Auth: migrate sang Supabase Auth để RLS filter theo user (`auth.uid()`)
- [ ] Brand 2 (Trà Tối): dine-in + quản lý bàn
- [ ] KDS — màn hình bếp/pha chế
- [ ] Loyalty / tích điểm khách hàng
