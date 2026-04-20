# FNB App — CONTEXT.md
# Cập nhật lần cuối: 21/04/2026

> **QUY TẮC CHO AI:** Đọc file này trước khi làm bất cứ điều gì. Sau mỗi thay đổi, cập nhật file này và commit ngay. Sau khi code xong phải tự testing trước khi báo cáo lại.

---

## THÔNG TIN DỰ ÁN

- **Repo GitHub:** github.com/sanh0605/fnbapp (Public)
- **App live:** https://sanh0605.github.io/fnbapp
- **Supabase project:** https://zicuawpwyhmtqmzawvau.supabase.co
- **Supabase anon key:** Chỉ lưu trong `src/lib/supabase.js` — KHÔNG commit vào đây
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

- **Không backend riêng** — Supabase là tầng duy nhất (REST API + Edge Functions + Auth)
- **Không framework frontend** — Vanilla HTML/CSS/JS
- **POS offline-first** — ghi vào IndexedDB trước, sync lên Supabase khi online
- **GitHub Pages** — auto-deploy khi push `main`

---

## DATABASE

### Bảng chính

| Bảng | Mục đích |
|---|---|
| `brands` | Định nghĩa brand |
| `outlets` | Cơ sở vật lý, thuộc 1 brand |
| `users` | Tài khoản nhân viên |
| `orders` | Giao dịch bán hàng |
| `order_counters` | Counter atomic theo outlet (migration 020) |
| `settings` | Cấu hình key-value (ngân hàng, giờ mở cửa) |
| `products` | Menu sản phẩm bán tại POS |
| `product_recipes` | Công thức sản phẩm |
| `raw_materials` | Nguyên liệu thô |
| `semi_products` | Bán thành phẩm |
| `supplies` | Vật tư |

### Cột quan trọng — `users`
- `auth_id` uuid: liên kết với Supabase Auth (migration 021)
- `password_hash` text: giá trị `'supabase_auth'` (không còn dùng SHA-256 từ migration 021)
- `outlet_id`: null với manager/owner, bắt buộc với staff
- `role`: `'owner'` | `'manager'` | `'staff'`
- `active` boolean: tài khoản bị khoá nếu false

### Cột quan trọng — `orders`
- `method` text: `'Tiền mặt'` | `'Chuyển khoản'`
- `client_id` uuid: client-generated, dùng làm idempotency key
- `items` jsonb: `[{id, name, qty, price, sweet, ice, toppings, note}]`
- `voided` boolean: soft delete (null = chưa voided, false = chưa voided, true = đã huỷ)
- `order_num` text: format `{outlet_id}-{seq}` khi có outlet, `#001` khi không có
- `outlet_id`, `brand_id`: auto-attach từ POS khi confirm

---

## AUTH — SUPABASE AUTH (từ 20/04/2026)

### Flow đăng nhập
1. `AuthAPI.login(username@fnbapp.internal, password)` → Supabase Auth trả JWT (ES256)
2. Fetch profile từ `users` table dùng `SUPABASE_ANON` key (không dùng JWT do PostgREST chưa support ES256)
3. Kiểm tra `user.active` → nếu false → báo lỗi
4. `Auth.setSession(user, tokens)` → lưu vào `localStorage.fnb_session`

### Session structure (`fnb_session`)
```json
{
  "id": "db-user-uuid",
  "username": "admin",
  "name": "Nguyễn Admin",
  "role": "owner",
  "permissions": ["pos","revenue","menu","payment_settings","user_settings"],
  "access_token": "eyJ...",
  "refresh_token": "...",
  "expires_at": 1234567890,
  "loginAt": "2026-04-20T...",
  "lastActiveAt": 1234567890
}
```

### Session lifecycle
- **Access token:** hết hạn sau 1 giờ (Supabase default)
- **Inactivity timeout:** 48 giờ — nếu không dùng app quá 48h phải login lại
- **Auto-refresh:** `require()` gọi `_bgRefresh()` khi còn < 10 phút hoặc khi token đã hết hạn nhưng còn refresh token
- `lastActiveAt` được cập nhật mỗi lần `Auth.require()` chạy

### Phân quyền

| Permission | staff | manager | owner |
|---|:---:|:---:|:---:|
| `pos` | ✓ | ✓ | ✓ |
| `revenue` | — | ✓ | ✓ |
| `menu` | — | — | ✓ |
| `payment_settings` | — | — | ✓ |
| `user_settings` | — | — | ✓ |

- Staff → POS (`src/pos/index.html`)
- Manager/Owner → Home (`src/home/index.html`)
- Tất cả role đều vào được Settings (đổi mật khẩu của mình)

### Script load order (bắt buộc)
```
supabase.js → utils.js → [idb-service.js] → [revenue-service.js] → [settings-service.js] → auth.js → {page}.js
```
`auth.js` phải load SAU `supabase.js` (cần `AuthAPI`), TRƯỚC `{page}.js` (cần `Auth`).

---

## KNOWN ISSUE — ES256 JWT

Supabase đã migrate sang ECC P-256 asymmetric JWT (15/04/2026). PostgREST **chưa** hỗ trợ ES256:
- `sb()` trong `supabase.js` dùng `SUPABASE_ANON` làm Authorization bearer cho mọi DB query
- RLS policies tạm thời `USING(true)` — mọi user đều đọc/ghi được (chưa có per-user filter)
- Khi Supabase update PostgREST hỗ trợ ES256: re-enable policies từ `migrations/021_supabase_auth_rls.sql`

---

## EDGE FUNCTION — `notify-order`

URL: `{SUPABASE_URL}/functions/v1/notify-order`

- Nhận POST với order payload → gửi Telegram message đến owner
- Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (set qua Supabase CLI)
- **Verify JWT: TẮT** (`--no-verify-jwt`) — gọi từ POS với ANON key
- Vietnamese encoding: toàn bộ non-ASCII được escape thành `\uXXXX` trước khi gửi Telegram (workaround Deno UTF-8 3-byte bug)
- Fire-and-forget từ `pos.js` sau khi sync đơn lên Supabase thành công

---

## EDGE FUNCTION — `user-admin`

URL: `{SUPABASE_URL}/functions/v1/user-admin`

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/` | Danh sách users | owner JWT |
| POST | `/` | Tạo user mới | owner JWT |
| PATCH | `/:id` | Sửa user (name/role/active/password) | owner JWT |
| DELETE | `/:id` | Xoá user | owner JWT |
| POST | `/migrate` | One-time migration (đã chạy xong) | service_role JWT |

- Edge Function tự verify JWT via `admin.auth.getUser(token)`
- "Verify JWT with legacy secret" toggle: **TẮT** (vì HS256 legacy đã bị revoke)

---

## ORDER COUNTER

- Bảng `order_counters` (outlet_id PK, last_num int)
- RPC `next_order_num(p_outlet_id uuid)` → atomic increment, trả về số tiếp theo
- POS gọi RPC khi online và có `posOutletId`, fallback về local counter khi offline
- Format: `{outlet_id}-{seq.padStart(3,'0')}` hoặc `#001` nếu không có outlet

---

## OFFLINE / DEAD-LETTER

- IndexedDB stores: `pending_orders` (keyPath=`local_id`), `cached_menu` (keyPath=`id`)
- Retry tối đa 5 lần; vượt ngưỡng → chuyển vào dead-letter (localStorage `fnb_pos_deadletter_{userId}`)
- Dead-letter UI hiển thị trong `orders/index.html` — chỉ thấy trên thiết bị tạo đơn
- HTTP 409 khi sync = đã tồn tại → xoá khỏi queue (idempotent)

---

## CẤU TRÚC THƯ MỤC

```
fnbapp/
├── index.html
├── CONTEXT.md              ← file này
├── docs/
│   ├── ARCHITECTURE.md
│   └── TASK.md
├── migrations/
│   ├── 019_reset_schema.sql
│   ├── 020_order_counter.sql
│   └── 021_supabase_auth_rls.sql
├── supabase/functions/
│   └── user-admin/index.ts
└── src/
    ├── lib/
    │   ├── supabase.js         ← DB + AuthAPI; ANON key dùng cho mọi DB query
    │   ├── utils.js            ← fmt(), fmtDate(), toast()
    │   ├── idb-service.js      ← IndexedDB offline queue + menu cache
    │   ├── revenue-service.js  ← fetchOrders(from, to, brandFilter) — filter voided=not.is.true
    │   └── settings-service.js ← fetchInitData, fetchUsers, saveUser, changePassword, saveSettings
    ├── auth/
    │   ├── auth.js             ← Auth singleton, 48h inactivity, auto-refresh
    │   ├── login.html
    │   └── login.js
    ├── home/
    │   ├── index.html
    │   └── home.js             ← stats hôm nay (voided=not.is.true), feature cards (settings visible to all)
    ├── pos/
    │   ├── index.html
    │   └── pos.js
    ├── orders/
    │   ├── index.html + orders.js
    │   └── edit.html + edit.js
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

## TRẠNG THÁI MODULES (21/04/2026)

| Module | Trạng thái | Ghi chú |
|---|:---:|---|
| Auth | ✅ | Supabase Auth, 48h timeout, auto-refresh |
| Home | ✅ | Stats hôm nay, brand filter, feature cards |
| POS | ✅ | Offline-first, order counter RPC, parked orders, dead-letter |
| Orders | ✅ | List, edit, void, dead-letter UI |
| Revenue | ✅ | Brand filter, chart, Excel export, voided excluded |
| Menu | ✅ | CRUD sản phẩm + công thức |
| Settings | ✅ | User CRUD qua Edge Function, đổi mật khẩu |

---

## BACKLOG

- [ ] RLS per-user: chờ Supabase update PostgREST hỗ trợ ES256 → enable lại policies từ migration 021
- [ ] Brand 2 (Trà Tối): dine-in + quản lý bàn
- [ ] KDS — màn hình bếp/pha chế
- [ ] Loyalty / tích điểm khách hàng
