# Kịch bản Nhiệm vụ: Đại phẫu Kiến trúc & Giao diện (Wave 1: Master Data)

## Mục tiêu (Goal)
Tiến hành chuẩn hoá kiến trúc (Feature Colocation) và tối ưu giao diện (Sticky Filters + Shared UI Primitives) cho 5 tính năng cốt lõi (Master Data) của hệ thống. 
**Tiêu chí Tối cao:** "Code chuẩn, chậm mà chắc, không được code ẩu gây lỗi hệ thống."

## Phạm vi Wave 1 (Scope)
1. Nhà cung cấp (Suppliers): `app/admin/suppliers`
2. Nhóm nguyên liệu (Base Ingredients): `app/admin/inventory/base-ingredients`
3. Danh mục nhóm món (Categories): `app/admin/products/categories`
4. Bảng quy đổi (Conversions): `app/admin/inventory/conversions`
5. Tuỳ chọn (Modifiers): `app/admin/products/modifiers`

## Yêu cầu Kiến trúc (Architecture Requirements)
- **Colocation:** Mọi components (Form, Button) và logic CSDL (actions) phải được dời vào trong thư mục con của từng tính năng. Vd: `app/admin/suppliers/components/SupplierForm.tsx` và `app/admin/suppliers/actions.ts`.
- **Thanh Công cụ:** Sử dụng `<StickyFilterBar title="...">` thay thế cho các tiêu đề rời rạc. Tích hợp luôn bộ lọc (Tìm kiếm bằng Text, Lọc theo Trạng thái) vào trong StickyFilterBar này.
- **Tái sử dụng UI:** Xoá bỏ code Modal và Button tự chế. Bắt buộc dùng `FormModal`, `LoadingButton`, và `DeleteConfirmModal` từ `components/ui/`.
- **Logic CSDL:** Thay thế các hàm CRUD lặp lại bằng `lib/shared-actions.ts`. Đảm bảo Type safety bằng các interface từ `types/db.ts`.

## Nhiệm vụ của Claude CLI (Kiến trúc sư & Kiểm định)
1. **Audit:** Quét toàn bộ mã nguồn của 5 tính năng trên. Rà soát logic render, logic thêm/sửa/xoá hiện tại.
2. **Quy hoạch (Plan):** Lập Kế hoạch Thực thi (Refactoring Plan) chi tiết từng bước. Trong kế hoạch phải chỉ rõ file nào tạo mới, file nào xoá bỏ, cần định nghĩa Interface TypeScript nào.
3. **Chất lượng:** Đảm bảo bản kế hoạch an toàn tuyệt đối, không phá vỡ logic nghiệp vụ hiện có.
4. **Xuất file:** Lưu bản kế hoạch vào `docs/superpowers/plans/2026-06-13-wave1-refactoring-plan.md`. (Chưa được phép viết code thi công lúc này).
