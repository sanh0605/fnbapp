# FNB App

Hệ thống quản lý bán hàng F&B đa brand — 2 brand, 7 outlet.

**Live:** https://sanh0605.github.io/fnbapp

---

## Stack

- **Frontend:** Vanilla HTML / CSS / JS (không framework, không build tool)
- **Database:** Supabase (PostgreSQL + RLS)
- **Auth:** Custom — SHA-256 password hash, session trong localStorage
- **Hosting:** GitHub Pages (auto-deploy on push to `main`)
- **Offline:** IndexedDB queue cho POS

## Modules

| Module | Mô tả | Role |
|---|---|---|
| POS | Bán hàng + offline queue | staff / manager / owner |
| Orders | Lịch sử đơn + void + sửa | manager / owner |
| Revenue | Báo cáo doanh thu + Excel | manager / owner |
| Menu | Quản lý sản phẩm + công thức | owner |
| Settings | Tài khoản + thanh toán | owner |

## Brands & Outlets

| Brand | Code | Outlets |
|---|---|---|
| Cà Phê Sáng | `CF_SANG` | CF_O1 → CF_O5 |
| Trà Tối | `TRA_TOI` | TRA_O1 → TRA_O2 |

## Cài đặt / Chạy

Không cần build. Mở thẳng file HTML hoặc deploy lên GitHub Pages.

Cấu hình Supabase trong `src/lib/supabase.js`.

Schema database: `migrations/019_reset_schema.sql`.

## Tài liệu

- [`docs/CONTEXT.md`](docs/CONTEXT.md) — ngữ cảnh dự án, ghi chú kỹ thuật
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — kiến trúc hệ thống chi tiết
