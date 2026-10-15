# Máy bán hàng và Đăng nhập: một cách xử lý mất mạng, trang đăng nhập tiếng Việt, ô giảm giá có chặn, tìm không dấu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** máy bán chỉ có một cách xử lý khi mất mạng (không bán, `BR-SALE-015`); mỗi thu ngân một tài khoản và có nút Đăng xuất (`BR-SALE-016`); trang đăng nhập tiếng Việt, không vòng lặp; ô giảm giá chặn số sai; tìm món không cần dấu; biểu tượng nhóm món là dữ liệu.

**Spec:** `docs/superpowers/specs/2026-10-15-may-ban-hang-de-xuat.md` (Q1, Q2 chủ quán trả lời 2026-10-15; R1–R8 chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15). "Technical work" là danh sách việc, "Order of work" là thứ tự.

## Global Constraints

- Mọi lần đẩy ở mảng này có thể làm máy bán ngừng nhận đơn: báo chủ quán trước, đẩy ngoài 06–09h, nhắc tải lại máy bán.
- C10 đi trước ở các file chung (`app/pos/actions.ts`, `POSScreen.tsx`, `CartPanel.tsx`, `ItemConfigModal.tsx`): phiếu ở đây chạy sau S7 và G7.
- Hai migration (bỏ bảng lỗi đồng bộ và `cart_payload_json` sau khi trang đã gỡ; thêm cột `icon`): số trống kế tiếp lúc viết, duyệt riêng.
- Ponytail: xoá trước, thêm sau. Năm cửa kiểm. Test viết trước.

## Hiện trạng

Số đo ở spec mục "Hiện trạng" (đo 2026-10-15). Tóm lại:

1. **Trạng thái.** Giỏ nằm trong bộ nhớ trình duyệt; nháp là một dòng `POS_Drafts` (0 dòng), xoá hẳn sau khi thanh toán. Đơn ghi `COMPLETED` trong một hàm Postgres. Mất mạng hôm nay có ba cách cư xử (băng báo hứa lưu, nút từ chối, Enter vẫn gửi) — sau: một cách, không bán, nút và Enter cùng tắt, băng báo nói thật. Lỗi đường truyền khi đang có mạng: giữ giỏ, hiện "Gửi lại" với cùng mã chống gửi trùng.
2. **Nút.** Thêm "Đăng xuất" trên máy bán; thêm bước Khách đưa / Tiền thừa khi bấm TIỀN MẶT (không lưu gì). Bỏ: dải thử lại ghi sai "Tiền mặt" cho Nhiều hình thức (ghi đúng phương thức). Trang Đồng bộ máy bán và lối vào ở Tổng quan bỏ.
3. **Danh sách.** Tìm món không cần dấu (dùng `stripDiacritics` có sẵn ở `lib/shared/duplicate-name-guard.ts`). Tab bán chạy trống ghi "Chưa có món bán chạy ở điểm bán này". Biểu tượng nhóm món đọc cột `icon` của nhóm; trống thì không hiện.
4. **Ô nhập.** Giảm tay: số tiền 0 ≤ x ≤ tạm tính của dòng hoặc đơn, phần trăm 0–100, chặn ngay khi gõ, `inputMode="numeric"`, tính bằng hàm chung `price-cart.ts`. Đăng nhập sai: "Sai tên đăng nhập hoặc mật khẩu". Khách đưa: số tiền ≥ 0, ít hơn tổng thì báo thiếu.
5. **Phục vụ dữ liệu nào.** Đơn bán, nháp, mã chống gửi trùng, tài khoản. Cố ý không: bán khi mất mạng, in hoá đơn, bàn, khách, ca, két tiền, tồn kho trên thẻ món.

Thêm cho việc này:

6. **Ai đọc thứ bị gỡ?** Hàng đợi `lib/pos`, `public/pos-sw.js` (đăng ký ở đâu), trang `app/admin/pos-sync`, lối vào Tổng quan (`BR-CASH-009`), bảng lỗi đồng bộ và `cart_payload_json` (0 chỗ đọc ngoài `actions.ts`): Sonnet grep từng thứ trước khi gỡ, kể cả bản sao lưu và `docs/generated/system-map.md`.
7. **Chặn đăng nhập sai nhiều lần.** Dự án chưa có cấu hình tường lửa trên Vercel (đo 2026-10-15: không có bản cấu hình nào). Khuyến nghị: một luật giới hạn tần suất của Vercel cho đường đăng nhập, không viết code; đổi cấu hình dự án cần chủ quán duyệt. Nếu gói Vercel không có, làm bảng đếm lần sai (bảng mới → đủ bốn bước).

Ví dụ: thu ngân gõ "bac xiu" → hiện Bạc xỉu. Đơn 100.000, thu ngân gõ giảm cả đơn 150.000 → ô tự về 100.000, tổng 0. Khách đưa 200.000 cho đơn 81.000 → Tiền thừa 119.000.

Đã xem: spec Máy bán hàng đủ; cấu hình tường lửa Vercel (không có). Chưa xem: thân `resolveActor`, máy bán trên điện thoại thật.

## Bước 1 — sau S7 (C10)

- [ ] **S-MB1 (Sonnet):** R8 phần máy chủ (gỡ `summarizePosCheckoutRequestIds`, đường `outOfStockProductIds`, ánh xạ `"SPLIT" ? "CASH" : "CASH"`), R6 máy chủ (STAFF không có điểm bán thấy chọn điểm bán thay vì vòng lặp; tên thương hiệu cho trang đăng nhập đọc từ bảng thương hiệu), R7 nháp kiểm điểm bán. Test `proxy.ts`, nháp sai điểm bán bị từ chối.
- [ ] **G-MB1 (Gemini):** trang đăng nhập tiếng Việt, bỏ hai dòng chân tiếng Anh, tôn trọng `callbackUrl`; chữ tiếng Anh trên máy bán (`BR-UI-001`); `loading.tsx` cột giỏ có `md:`.
- [ ] **Opus:** sửa `docs/03-workflows/sales.md` (máy bán có ghi `orders_v2` qua `create_pos_order_atomic`).

## Bước 2 — R1, một lần đẩy riêng, báo trước

- [ ] **S-MB2:** gỡ hàng đợi, service worker (lần tải đầu sau khi đẩy tự huỷ đăng ký), trang Đồng bộ máy bán, lối vào Tổng quan; `submitOrderV2` trả `{ success:false, retry:true }` khi lỗi ném ra, `retry:false` khi từ chối theo luật. Migration bỏ bảng lỗi đồng bộ và `cart_payload_json`, chạy sau khi đẩy.
- [ ] **G-MB2:** băng báo "Mất kết nối — chưa bán được, kiểm tra mạng rồi bấm lại"; nút và Enter cùng tắt khi mất mạng; "Gửi lại" khi `retry:true`.

## Bước 3

- [ ] **G-MB3:** R5 tìm không dấu, tab bán chạy trống có câu riêng.
- [ ] **S-MB3 + G-MB3b:** R4 cột `icon` trên nhóm món (migration), ô nhập ở trang nhóm món, `ProductGrid` đọc cột; xoá `lib/pos/pos-category-icons.ts`.

## Bước 4 — sau C10

- [ ] **G-MB4:** R3 chặn ô giảm giá, một hàm chung, xoá năm bản sao và `calculateCartBaseTotal` thừa; R2 bước Khách đưa / Tiền thừa.

## Bước 5

- [ ] **G-MB5:** nút Đăng xuất trên máy bán. Chủ quán tự tạo tài khoản STAFF ở Nhân sự cho từng thu ngân.

## O-MB (Opus)

- [ ] Soát mỗi bước (tìm cả chỗ thừa); xem máy bán trên 8386 ở 1568 và 390 px, không bấm thanh toán; tắt máy chủ; năm cửa kiểm; commit; gộp hỏi đẩy (ngoài 06–09h) và migration.
