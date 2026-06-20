# Kịch bản Nhiệm vụ: Audit & Fix Lỗi Kép Doanh thu (POS & Reports)

## Tình trạng (Problem Statement)
Hệ thống đang gặp lỗi kép (Double-counting) liên quan đến chiết khấu và doanh thu:
1. **Lỗi POS (`components/POSScreen.tsx`):** Khi áp dụng Khuyến mãi (CTKM), POS đang lưu số tiền giảm giá vào **CẢ 2 NƠI**: `order.discount_amount` (giảm tổng đơn) VÀ phân bổ đè vào `order_line.line_discount` (giảm trên từng món). Việc này làm hỏng dữ liệu gốc trong DB và vô tình xoá mất các khoản chiết khấu thủ công trên từng món của thu ngân.
2. **Lỗi Reports (`app/admin/reports/sales/page.tsx` & `app/actions/reports.ts`):** Báo cáo hiện tại chỉ dựa vào `line_discount` để tính doanh thu, hoàn toàn bỏ qua `order.discount_amount`.

## Yêu cầu sửa chữa (Requirements)

### Phần 1: Chuẩn hoá POS (`components/POSScreen.tsx`)
- Tách bạch rõ 2 loại chiết khấu:
  - **Giảm tổng đơn (Order-Level):** Manual Order Discount hoặc Promo `ORDER_DISCOUNT` -> Chỉ lưu vào `orderData.discount_amount`.
  - **Giảm từng món (Item-Level):** Manual Line Discount hoặc Promo `PRODUCT_DISCOUNT` -> Cộng dồn vào `item.discount_amount`.
- Tuyệt đối **KHÔNG** tự động phân bổ (prorate) Order-Level discount vào `line_discount` trong lúc Checkout nữa.
- Trả lại giá trị `item.discount_amount` gốc nếu thu ngân nhập tay.

### Phần 2: Chuẩn hoá Báo cáo (`lib/report-utils.ts`, `app/admin/reports/sales/page.tsx`, `app/actions/reports.ts`)
- Do POS không còn phân bổ Order-Level discount vào line nữa, các Báo cáo **PHẢI** tự phân bổ.
- Cập nhật `computeLineRevenue` trong `lib/report-utils.ts` để nhận thêm tham số `order_discount_ratio`.
- Áp dụng tỷ lệ này `(1 - order_discount_ratio)` vào doanh thu món và topping.
- Tính toán `orderDiscountRatio = order.discount_amount / order.subtotal_amount` trong cả Báo cáo Bán hàng và Báo cáo P&L, rồi truyền vào `computeLineRevenue`.

---

## Phân chia nhiệm vụ (Agent Workload)

### Nhiệm vụ của Claude CLI (Kiến trúc sư)
1. Đọc và phân tích kỹ file assignment này.
2. Audit lại các file: `components/POSScreen.tsx`, `lib/report-utils.ts`, `app/admin/reports/sales/page.tsx`, `app/actions/reports.ts`.
3. Viết ra một Refactoring Plan từng bước một, ghi chú rõ dòng code nào cần đổi logic. 
4. Lưu kế hoạch vào `docs/superpowers/plans/2026-06-15-revenue-refactoring-plan.md`.

### Nhiệm vụ của Gemini CLI (Thi công)
1. Đọc Refactoring Plan do Claude vừa tạo.
2. Thực thi sửa code theo đúng plan, đảm bảo Type-safe và không làm hỏng giao diện hay logic kế toán hiện có.
