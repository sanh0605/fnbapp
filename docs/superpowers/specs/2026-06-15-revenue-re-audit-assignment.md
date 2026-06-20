# Đề bài Audit lại Logic Doanh thu và Frontend (Dành cho Claude & Gemini)

**Bối cảnh:**
Sau khi Antigravity chạy script phục hồi `line_discount` cho các đơn hàng cũ (đưa `order.discount_amount` về 0), User đã phát hiện 3 vấn đề:
1. **Báo cáo P&L:** Doanh thu của món "Sữa dâu sấy giòn" đã bị thay đổi (từ 1.820.526đ lên 1.906.257đ). User nghi ngờ logic tính toán doanh thu vẫn đang sai.
2. **Chi tiết đơn hàng:** User báo cáo không thể xem được chi tiết đơn hàng (click vào không lên Modal).
3. **Submenu bị liệt:** User báo cáo không thể tương tác được với các chức năng có submenu ở Sidebar.
*Lưu ý từ Antigravity:* Hiện tượng liệt Submenu và Modal không hiển thị đang đi kèm với lỗi màn hình đỏ `ChunkLoadError: Loading chunk app/admin/layout failed` trên trình duyệt của User.

---

## Nhiệm vụ 1: Dành cho Claude (Senior Architect & Frontend)
1. **Kiểm tra lỗi Frontend (ChunkLoadError & Submenu/Modal):**
   - Xác minh xem lỗi `ChunkLoadError` và việc liệt JS (submenu không click được, Modal chi tiết đơn hàng không mở được) có phải do lỗi code (như vòng lặp vô hạn, syntax error, React hydration) hay đơn thuần là do bộ nhớ đệm (cache) của Next.js Dev Server khi bị khởi động lại.
   - Kiểm tra xem component `OrderDetailModal.tsx` có lỗi logic nào khi render với dữ liệu có `order.discount_amount = 0` và `line.line_discount > 0` không.
   - Hướng dẫn User cách khắc phục lỗi liệt JS này (ví dụ: Ctrl + F5, xoá `.next`).

2. **Dọn dẹp TypeScript Errors:**
   - Hiện tại đang có một vài lỗi TypeScript tồn đọng từ các đợt Wave trước làm rác console:
     - `app/admin/reports/stock/page.tsx: Property 'role' does not exist on type...`
     - `components/SupplierForm.tsx(187,32): Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`
   - Hãy fix nhanh các lỗi này để đảm bảo Dev Server chạy mượt mà nhất.

---

## Nhiệm vụ 2: Dành cho Gemini (Data & Report Specialist)
1. **Audit lại công thức Doanh thu trong `report-utils.ts`:**
   - Tính toán thủ công lại một đơn hàng ví dụ: 
     - Item A (giá 35k), bị áp mã giảm giá `PRODUCT_DISCOUNT` 10k. 
     - Lúc trước: `subtotal=25k`, `order.discount_amount=10k`, `line_discount=10k` (Bị lưu kép). Doanh thu lúc đó là bao nhiêu?
     - Hiện tại (Sau khi Antigravity fix): `subtotal=25k`, `order.discount_amount=0`, `line_discount=10k`. Doanh thu hiện tại là bao nhiêu?
   - Chứng minh cho User thấy con số doanh thu nào là con số **chính xác nhất về mặt toán học và tài chính**, và giải thích cặn kẽ vì sao con số của "Sữa dâu sấy giòn" lại tăng từ 1.820.526đ lên 1.906.257đ trong báo cáo.
   - Rà soát lại xem `order_discount_ratio` có đang hoạt động đúng khi `order.discount_amount = 0` không.

2. **Kiểm tra lại dữ liệu Orders và Order_Lines:**
   - Xác nhận rằng các đơn hàng lịch sử đã được phân bổ `line_discount` chính xác và không còn bị double-counting.

---
**Quy trình làm việc:**
1. Claude sẽ chạy trước để lo phần Frontend và Typescript. 
2. Gemini sẽ theo sau để làm toán, Audit dữ liệu và đưa ra báo cáo giải trình chi tiết cho User.
3. Cả hai Agent cần giao tiếp qua Terminal hoặc ghi log ra file để trao đổi kết quả.
