# Phân công nhiệm vụ: Kiểm định (Audit) tính năng Sticky Filters

Tính năng "Bộ lọc tự động & Bám dính (Sticky Filters)" vừa được Antigravity xây dựng. Tuy nhiên, để đảm bảo chất lượng cao nhất, đội ngũ AI sẽ tiến hành audit chéo mã nguồn.

## Các tệp tin cần Audit:
1. `components/StickyFilterBar.tsx` (Component dùng chung mới tạo)
2. `components/SalesFilter.tsx` (Đã nâng cấp auto-submit và sticky)
3. `app/admin/orders/OrderTable.tsx` (Đã nâng cấp sticky)
4. `app/admin/products/page.tsx` (Tách Client Component)
5. `app/admin/products/ProductsClient.tsx` (Component mới)

## Phân công chi tiết:

### 1. Claude CLI (Vai trò: Kiến trúc sư / Người kiểm định)
- **Nhiệm vụ:** Đọc mã nguồn của các tệp tin trên.
- **Tiêu chí kiểm tra:**
  - Lỗi logic về React Hooks (Thiếu dependencies trong `useMemo`, `useEffect`...).
  - Tính hợp lý của kỹ thuật `debounce` khi auto-submit (đặc biệt trong `SalesFilter.tsx`).
  - Lỗi giao diện (CSS Tailwind) khi sử dụng `sticky`, `z-index`, và `overflow-x-auto` trên thiết bị di động.
- **Đầu ra mong đợi:** Báo cáo lỗi và Đề xuất tối ưu (Refactoring Plan) được lưu tại `docs/superpowers/plans/2026-06-11-sticky-filters-audit-plan.md`. (Nếu code đã hoàn hảo, ghi rõ là không cần sửa đổi).

### 2. Gemini CLI (Vai trò: Lập trình viên sửa lỗi)
- **Nhiệm vụ:** Đọc bản kế hoạch `2026-06-11-sticky-filters-audit-plan.md` do Claude vừa lập.
- **Hành động:** Trực tiếp thực thi các đề xuất thay đổi code (nếu có) trên các tệp tin.

### 3. Antigravity (Vai trò: Quản lý / Reviewer)
- Điều phối chạy nền (background) cho Claude và Gemini CLI.
- Kiểm tra chéo lại trạng thái build (lỗi TypeScript).
- Báo cáo kết quả nghiệm thu cuối cùng cho User.
