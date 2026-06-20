# Kịch bản Nhiệm vụ: Đại phẫu Kiến trúc & Giao diện (Wave 2: Operations)

## Mục tiêu (Goal)
Tiếp nối thành công của Wave 1, mục tiêu của Wave 2 là chuẩn hoá kiến trúc (Feature Colocation) và tối ưu giao diện (Sticky Filters + Shared UI Primitives) cho 4 tính năng thuộc nhóm Vận hành & Sản xuất (Operations). 
Đây là nhóm có logic tính toán và truy xuất dữ liệu cực kỳ phức tạp (Nhập kho tính trung bình giá, Nấu bếp trừ tồn kho). Cần sự cẩn trọng tuyệt đối.

## Phạm vi Wave 2 (Scope)
1. Hàng mua vào (Items): `app/admin/inventory/items`
2. Nhập hàng (Purchase Orders): `app/admin/inventory/purchase-orders`
3. Cấu hình Bán thành phẩm (Semi-products): `app/admin/semi-products`
4. Sản xuất / Nấu bếp (Production): `app/admin/production`

## Yêu cầu Kiến trúc (Architecture Requirements)
- **Colocation:** Đưa mọi Form, Client components và Server Actions vào thư mục tương ứng. VD: `app/admin/semi-products/components/SemiProductForm.tsx`.
- **Thanh Công cụ:** Sử dụng `<StickyFilterBar title="...">`. Bổ sung các bộ lọc thời gian (Date Picker), trạng thái, và dropdown (VD: Lọc PO theo nhà cung cấp) tương tự trang SalesReport.
- **Tái sử dụng UI:** Xoá bỏ Modal thủ công, sử dụng `FormModal`, `LoadingButton`, `DeleteConfirmModal`.
- **Logic CSDL:** Sử dụng `lib/shared-actions.ts` nếu là thao tác CRUD đơn giản. Các hàm phức tạp (tạo Purchase Order kéo theo Order Lines, tính trung bình giá FIFO, Nấu bếp sinh lịch sử kho) phải được giữ nguyên vẹn logic nghiệp vụ nhưng tách ra thành các Server Actions sạch sẽ. Định nghĩa Type Interfaces trong `types/db.ts` nếu thiếu.

## Nhiệm vụ của Claude CLI (Kiến trúc sư & Kiểm định)
1. **Audit:** Quét sâu (Deep Audit) mã nguồn của 4 tính năng. Chú ý đặc biệt đến luồng lưu dữ liệu của `Purchase Orders` và `Production` (vì liên đới tới `StockLedger`).
2. **Quy hoạch (Plan):** Lập Kế hoạch Thực thi (Refactoring Plan) chi tiết. Khuyến nghị tạo Sub-agent hoặc chia nhỏ bước vì code dài.
3. **Chất lượng:** Tuyệt đối không làm thay đổi luồng tính giá hay trừ kho. Chỉ cấu trúc lại mã nguồn và UI.
4. **Xuất file:** Lưu bản kế hoạch vào `docs/superpowers/plans/2026-06-13-wave2-refactoring-plan.md`. (Không viết code thực thi lúc này).
