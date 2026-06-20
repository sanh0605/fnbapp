# Yêu cầu tính năng: Nâng cấp Bộ lọc tự động & Bám dính (Sticky Auto-Submit Filters)

## Mục tiêu
Thiết kế lại và đồng bộ hệ thống bộ lọc dữ liệu cho các trang quản trị (Admin) nhằm mang lại trải nghiệm thao tác nhanh hơn, đặc biệt tối ưu cho thiết bị di động.

## Yêu cầu chi tiết (Requirements)

1. **StickyFilterBar (Thanh bộ lọc bám dính):**
   - Xây dựng một React Component dùng chung (ví dụ: `components/StickyFilterBar.tsx`).
   - Có thuộc tính bám dính trên cùng (`sticky top-0`, `z-index` phù hợp để không bị che bởi các thành phần khác).
   - Tối ưu Mobile: Các field bộ lọc phải hỗ trợ cuộn ngang (`overflow-x-auto`, ẩn thanh cuộn) trên màn hình nhỏ để tiết kiệm không gian chiều dọc.

2. **Lọc tự động (Auto-submit):**
   - Loại bỏ nút "Lọc báo cáo" (hoặc "Lọc dữ liệu").
   - Dữ liệu phải tự động được cập nhật (fetch lại hoặc update state) ngay khi người dùng thay đổi giá trị của bất kỳ tuỳ chọn nào (Ví dụ: Đổi Ngày, Đổi Danh mục).
   - *Lưu ý:* Đối với các bộ lọc gọi API hoặc đổi URL, cần áp dụng cơ chế debounce (ví dụ 300ms - 500ms) để tránh gọi API quá nhiều lần khi người dùng thao tác nhanh.

3. **Phạm vi áp dụng (Phase 1):**
   - **Báo cáo (Reports):** Áp dụng cho các trang `sales`, `pnl`, `stock`. Cập nhật component `SalesFilter.tsx` hiện tại để dùng `StickyFilterBar` và auto-submit thông qua `router.push(url)`.
   - **Đơn hàng (Orders):** Áp dụng cho trang Quản lý đơn hàng (`OrderTable.tsx`). Chuyển các bộ lọc tìm kiếm, trạng thái, ngày tháng vào `StickyFilterBar`.
   - **Sản phẩm (Products):** Thêm bộ lọc Danh mục (Category) và Trạng thái cho trang Sản phẩm (`ProductsClient.tsx`). Tự động lọc danh sách dựa trên state nội bộ.

4. **Yêu cầu kỹ thuật:**
   - Sử dụng TailwindCSS cho phần giao diện cuộn ngang và bám dính.
   - Giữ nguyên các chức năng Preset (Hôm nay, 7 ngày, 30 ngày) nhưng thiết kế lại dưới dạng các thẻ (chips) nhỏ gọn nằm trên thanh Sticky.
