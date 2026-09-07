# app/pos — máy bán hàng

Nhân viên chỉ dùng màn hình này; quán ngừng bán nếu nó hỏng.

- **Phải chạy khi mất mạng:** hàng đợi ngoại tuyến `lib/pos/pos-offline-queue.ts`, service worker `public/pos-sw.js` (test ở `tests/public/`). Sửa gì cũng phải giữ đường ngoại tuyến.
- **Thanh toán idempotent** (`lib/pos/pos-checkout-idempotency.ts`): bấm hai lần không ra hai đơn.
- **Bán không trừ kho, không tính giá vốn** (từ 2026-08-07). Đừng thêm.
- Điểm bán lấy từ đường dẫn; mã đơn đánh theo điểm bán + ngày (`BR-SALE-006`). Số điểm bán là dữ liệu, không phải hằng số.
- Việc có thể làm POS ngừng nhận đơn dù vài phút: **nói với chủ quán trước khi làm**, kèm mức rủi ro.
- Giao diện: luật thiết bị ở `.claude/rules/ui-devices.md`; POS chủ yếu mở trên máy tính bảng và điện thoại, nhưng phải dùng được trên máy tính.
