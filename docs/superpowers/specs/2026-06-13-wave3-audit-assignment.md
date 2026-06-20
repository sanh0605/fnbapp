# Kịch bản Nhiệm vụ: Đại phẫu Kiến trúc & Giao diện (Wave 3: Administration)

## Mục tiêu (Goal)
Hoàn thành chiến dịch quy hoạch cấu trúc toàn diện bằng việc xử lý 2 tính năng cuối cùng thuộc nhóm Quản trị (Administration): `Quản lý Nhân sự` và `Khuyến Mãi`.
Tuy logic hai trang này không phức tạp như kho bãi (Wave 2), nhưng Khuyến mãi có cấu trúc JSON động (`applicable_products_json`) cần được xử lý cẩn thận trong Form.

## Phạm vi Wave 3 (Scope)
1. Quản lý Nhân sự (Users): `app/admin/users`
2. Khuyến Mãi (Promotions): `app/admin/promotions`

## Yêu cầu Kiến trúc (Architecture Requirements)
- **Colocation:** Đưa mọi Form, Client components và Server Actions vào thư mục tương ứng. VD: `app/admin/promotions/components/PromotionForm.tsx`.
- **Thanh Công cụ:** Kế thừa toàn bộ sức mạnh của `StickyFilterBar`. 
  - *Nhân sự:* Lọc theo Text, Role (Dropdown), Trạng thái (Dropdown).
  - *Khuyến mãi:* Lọc theo Text, Trạng thái (Dropdown: Đang chạy, Hết hạn), Loại KM.
- **Tái sử dụng UI:** Xoá bỏ Modal cũ, áp dụng `FormModal`, `LoadingButton`, `DeleteConfirmModal`.
- **Logic CSDL:** Sử dụng `lib/shared-actions.ts` nếu là CRUD đơn giản. Đối với `Promotions`, giữ nguyên logic parse/stringify JSON của trường `applicable_products_json`.

## Nhiệm vụ của Claude CLI (Kiến trúc sư & Kiểm định)
1. **Audit:** Quét (Audit) 2 tính năng trong Wave 3.
2. **Quy hoạch (Plan):** Lập Kế hoạch Thực thi (Refactoring Plan) dựa trên mẫu thành công của Wave 1 & 2. 
3. **Chất lượng:** Tuyệt đối không để lọt lỗi giao diện hay làm mất trường dữ liệu.
4. **Xuất file:** Lưu bản kế hoạch vào `docs/superpowers/plans/2026-06-13-wave3-refactoring-plan.md`. (Không viết code thực thi lúc này).
