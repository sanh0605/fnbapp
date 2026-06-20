# Kịch bản Nhiệm vụ: Tái cấu trúc Kiến trúc (Architecture Refactoring)

## Mục tiêu (Goal)
Toàn bộ hệ thống hiện tại đang bị phân mảnh mã nguồn:
- `app/actions/`: Chứa 17 file xử lý logic CSDL (Server Actions) gần như giống hệt nhau về CRUD.
- `components/`: Chứa 22+ file UI, trong đó có hơn 15 file `*Form.tsx` (ví dụ BrandForm, ProductForm) bị lặp lại logic Modal, DatePicker, Submit/Delete button.
- Thiếu các Interface TypeScript nghiêm ngặt (đang lạm dụng `any`).

Mục tiêu là quy hoạch lại mã nguồn theo hướng **Feature Colocation** (đặt components/actions vào đúng thư mục tính năng của nó trong `app/admin/[feature]/`) và thiết kế các UI Components dùng chung để cắt giảm mã dư thừa.

## 1. Nhiệm vụ của Claude CLI (Kiến trúc sư trưởng / Kẻ kiểm định)
- **Hành động 1:** Chạy quét (Audit) lại toàn bộ thư mục `components/` và `app/actions/` hiện tại của hệ thống để đánh giá mức độ lặp code.
- **Hành động 2:** Kết hợp với Bản thiết kế sơ bộ (Colocation + UI Blocks + Typescript) của Antigravity để vạch ra một lộ trình tái cấu trúc chi tiết, an toàn. Ưu tiên làm mẫu nghiệm thu trước một tính năng (ví dụ: `Brands`).
- **Hành động 3:** Xuất ra bản Kế hoạch Xử lý chi tiết (Refactoring Plan) vào tệp tin `docs/superpowers/plans/2026-06-11-architecture-refactoring-plan.md`.
- **Yêu cầu:** Kế hoạch phải chỉ rõ tạo folder nào, xoá file nào, tạo UI Component chung nào. **Không viết code thực thi lúc này.**

## 2. Nhiệm vụ của Gemini CLI (Lập trình viên thi công)
- Chờ Claude hoàn thành bản Refactoring Plan.
- Đọc hiểu bản Plan và bắt tay vào việc gõ code, di dời file, và cấu trúc lại các thư mục đúng như kế hoạch.

## 3. Nhiệm vụ của Antigravity (Quản lý)
- Kiểm tra TypeScript (tsc) sau khi Gemini làm xong.
- Cập nhật Walkthrough và báo cáo nghiệm thu cho User.
