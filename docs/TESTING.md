# FNB App — Testing Checklist
# Cập nhật lần cuối: 21/04/2026

> **Quy ước:** ✅ Pass · ❌ Fail (ghi bug) · ⚠️ Partial · ⬜ Chưa test

---

## MODULE 1 — AUTH

| # | Test case | Kết quả | Ghi chú |
|---|---|---|---|
| 1.1 | Login đúng username/password → vào đúng trang theo role | ⬜ | staff→POS, manager/owner→Home |
| 1.2 | Login sai password → báo lỗi, không redirect | ⬜ | |
| 1.3 | Tài khoản `active=false` → báo lỗi khoá | ⬜ | |
| 1.4 | Đã login → vào login.html → auto redirect | ⬜ | |
| 1.5 | Token hết hạn → auto refresh ngầm, không logout | ⬜ | |
| 1.6 | Không dùng 48h → phải login lại | ⬜ | |
| 1.7 | Staff truy cập `/home` → redirect về login | ⬜ | |
| 1.8 | Logout → clear session → về login | ⬜ | |

---

## MODULE 2 — POS (ONLINE)

| # | Test case | Kết quả | Ghi chú |
|---|---|---|---|
| 2.1 | Load menu → hiển thị đúng sản phẩm, category | ⬜ | |
| 2.2 | Thêm món → chọn ngọt/đá/topping/ghi chú | ⬜ | |
| 2.3 | Tăng/giảm số lượng, xoá món | ⬜ | |
| 2.4 | Chiết khấu VNĐ → tính đúng | ⬜ | |
| 2.5 | Chiết khấu % → tính đúng | ⬜ | |
| 2.6 | Thanh toán Tiền mặt → tạo đơn, Telegram nhận | ⬜ | |
| 2.7 | Thanh toán Chuyển khoản → QR đúng bank, Telegram nhận | ⬜ | |
| 2.8 | Mã đơn tăng dần toàn cục (#001, #002…) | ⬜ | |
| 2.9 | Park đơn → resume lại đúng | ⬜ | |
| 2.10 | Xoá đơn nháp | ⬜ | |
| 2.11 | discountType reset về VNĐ sau mỗi đơn | ⬜ | |

---

## MODULE 3 — POS (OFFLINE)

| # | Test case | Kết quả | Ghi chú |
|---|---|---|---|
| 3.1 | Load khi offline, có cache → hiển thị menu đã lưu | ⬜ | |
| 3.2 | Load khi offline, không có cache → hiện warning, không crash | ⬜ | |
| 3.3 | Tạo đơn offline → lưu IDB, badge hiện số đơn chờ | ⬜ | |
| 3.4 | QR offline → dùng đúng bank thật (đã cache) | ⬜ | |
| 3.5 | Đơn offline có đúng outlet/brand (đã cache) | ⬜ | |
| 3.6 | Bật mạng → tự động sync, Telegram nhận | ⬜ | |
| 3.7 | Đơn offline sync lên → order_num không trùng với pending | ⬜ | |
| 3.8 | Tạo nhiều đơn offline → sync đúng thứ tự | ⬜ | |
| 3.9 | Sync thất bại 5 lần → chuyển dead-letter | ⬜ | |
| 3.10 | Dead-letter hiển thị trong Orders page | ⬜ | |

---

## MODULE 4 — ORDERS

| # | Test case | Kết quả | Ghi chú |
|---|---|---|---|
| 4.1 | Danh sách đơn → lọc đúng ngày | ⬜ | |
| 4.2 | Đơn voided không hiển thị trong list | ⬜ | |
| 4.3 | Xem chi tiết đơn → đúng thông tin | ⬜ | |
| 4.4 | Huỷ đơn (void) → biến mất khỏi list | ⬜ | |
| 4.5 | Dead-letter UI → hiển thị đúng trên thiết bị tạo | ⬜ | |

---

## MODULE 5 — REVENUE

| # | Test case | Kết quả | Ghi chú |
|---|---|---|---|
| 5.1 | Lọc theo ngày → tổng đúng | ⬜ | |
| 5.2 | Đơn voided không tính vào doanh thu | ⬜ | |
| 5.3 | Lọc theo brand → đúng | ⬜ | |
| 5.4 | Chart hiển thị đúng | ⬜ | |
| 5.5 | Export Excel → file đúng dữ liệu | ⬜ | |

---

## MODULE 6 — MENU

| # | Test case | Kết quả | Ghi chú |
|---|---|---|---|
| 6.1 | Thêm sản phẩm → hiển thị trong POS | ⬜ | |
| 6.2 | Sửa giá → POS cập nhật | ⬜ | |
| 6.3 | Ẩn sản phẩm (`active=false`) → không hiện POS | ⬜ | |
| 6.4 | Xoá sản phẩm | ⬜ | |

---

## MODULE 7 — SETTINGS

| # | Test case | Kết quả | Ghi chú |
|---|---|---|---|
| 7.1 | Owner tạo user mới → login được | ⬜ | |
| 7.2 | Owner khoá tài khoản → user bị reject khi login | ⬜ | |
| 7.3 | Owner xoá user | ⬜ | |
| 7.4 | Đổi mật khẩu sai mật khẩu cũ → báo lỗi | ⬜ | |
| 7.5 | Đổi mật khẩu đúng → login lại được bằng mật khẩu mới | ⬜ | |
| 7.6 | Cập nhật bank settings → QR POS đúng | ⬜ | |
| 7.7 | Staff vào Settings → chỉ thấy đổi mật khẩu, không thấy user CRUD | ⬜ | |

---

## LỘ TRÌNH XỬ LÝ

```
Tuần 1 — Core flows
  ├── [P0] Auth (1.1–1.8)
  ├── [P0] POS Online (2.1–2.11)
  └── [P0] POS Offline (3.1–3.8)

Tuần 2 — Business flows
  ├── [P1] Orders (4.1–4.5)
  ├── [P1] Revenue (5.1–5.5)
  └── [P1] Offline edge cases (3.9–3.10)

Tuần 3 — Admin flows
  ├── [P2] Menu CRUD (6.1–6.4)
  └── [P2] Settings (7.1–7.7)
```

---

## BUG LOG

| ID | Module | Mô tả | Trạng thái |
|---|---|---|---|
| — | — | — | — |
