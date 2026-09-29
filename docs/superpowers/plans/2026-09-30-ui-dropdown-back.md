# Sửa giao diện: ô chọn tràn khung, lịch lọc ngày, nút quay lại, cột Giá trị khi sửa phiếu xuất

Nguồn: chủ quán nhắn 2026-09-30 sau khi dùng thử Phiếu xuất (bản 5510ac2).

Đã xem: `components/ui/SearchableSelect.tsx`, `components/ui/DayInput.tsx`, `components/ui/CustomDatePicker.tsx`, `app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx`, `app/admin/inventory/purchase-orders/[id]/page.tsx`, `app/admin/inventory/purchase-orders/new/page.tsx`, `app/admin/inventory/issue-slips/new/page.tsx`, `app/admin/users/edit/[id]/page.tsx`. Chưa xem: từng màn trong 9 file đang dùng `SearchableSelect` ngoài hai màn Phiếu xuất; `DateRangeFilter.tsx`.

## Hiện trạng

1. **Trạng thái.** Ô chọn có tìm (`SearchableSelect`) có hai trạng thái, mở và đóng, do biến `isOpen` trong component. Lịch chọn ngày (`react-datepicker` trong `CustomDatePicker`) mở khi bấm biểu tượng lịch. Bảng Phiếu xuất có chế độ xem và chế độ sửa (`mode`).
2. **Nút.**
   - Nút quay lại:
     - Phiếu xuất chi tiết: `router.back()` khi có lịch sử, nếu không thì về danh sách (R6).
     - Phiếu nhập chi tiết, Phiếu nhập tạo mới, Phiếu xuất tạo mới: link cứng về danh sách, nên mất bộ lọc.
     - Sửa nhân sự: đường dẫn "Nhân sự" dạng breadcrumb, không phải nút quay lại, giữ nguyên.
   - Không nút nào ẩn theo trạng thái trong phạm vi này.
3. **Danh sách.**
   - Danh sách thả của `SearchableSelect` là khối `absolute` nằm trong khung cha. Khung bảng có `overflow-x-auto` nên danh sách bị cắt, phải cuộn trong bảng mới thấy hết.
   - Lịch của `react-datepicker` bật ra cạnh biểu tượng. Với ô "Từ ngày" nằm sát menu trái, lịch mở sang trái nên bị menu che.
4. **Ô nhập.** Không đổi giá trị nào được nhận; chỉ đổi chỗ hiển thị.
5. **Dữ liệu.** Không đụng dữ liệu, không đụng máy chủ. Cố ý không đổi ô `<select>` gốc của trình duyệt, vì trình duyệt đã tự vẽ nó ra ngoài khung.

## Thiết kế rút gọn

- **A. `SearchableSelect` tràn khung.**
  - Danh sách thả vẽ qua portal vào `document.body`, vị trí `fixed`, tính từ `getBoundingClientRect()` của ô bấm.
  - Tính lại khi cuộn (bắt ở pha capture) và khi đổi cỡ cửa sổ.
  - Chỗ dưới không đủ chiều cao `max-h-72` thì mở lên trên.
  - Bấm ra ngoài: coi cả ô bấm lẫn danh sách (nằm trong portal) là "bên trong".
  - `z-index` cao hơn menu trái và hộp thoại đang dùng (`z-[80]` giữ nguyên hoặc cao hơn nếu hộp thoại cao hơn). Áp cho mọi màn dùng component này.
- **B. Lịch lọc ngày không bị menu che.**
  - `CustomDatePicker` truyền `portalId` để lịch vẽ ở `body`, kèm `popperPlacement="bottom-start"`.
  - Lớp chứa lịch có `z-index` cao hơn menu trái.
  - Điện thoại vẫn `withPortal` như cũ.
- **C. Nút quay lại dùng chung.**
  - Component `components/ui/BackLink.tsx`, là client component, nhận `href` và `label`.
  - Bấm thì `router.back()` nếu `window.history.length > 1`, không thì đi `href`. Hiện chữ "← {label}".
  - Thay nút quay lại ở Phiếu nhập chi tiết, Phiếu nhập tạo mới, Phiếu xuất tạo mới (cả `loading.tsx`) và Phiếu xuất chi tiết.
  - Giữ đúng hành vi R6, nhưng chỉ còn một chỗ viết.
- **D. Cột Giá trị trong chế độ sửa Phiếu xuất.**
  - Bảng sửa (máy tính) có lại cột "Giá trị".
  - Dòng cũ chưa đổi hiện giá trị hiện có.
  - Dòng đã đổi số lượng, dòng mới, dòng bị xoá: hiện "Tính khi lưu" (dòng bị xoá gạch ngang giá trị cũ), vì giá trị xuất do máy chủ tính theo giá nhập (`BR-COGS-005`), trình duyệt không tự tính.
  - Thẻ điện thoại hiện cùng thông tin đó.

## Việc

- [ ] Gemini (`agy --model gemini-3.1-pro-high`): A, B, C, D kèm test. Test A: mở ô chọn trong khung `overflow-x-auto`, danh sách nằm dưới `document.body`; bấm vào một lựa chọn trong danh sách vẫn chọn được (không bị coi là bấm ngoài). Test C: có lịch sử thì gọi `router.back`. Test D: chế độ sửa có cột "Giá trị"; đổi số lượng thì dòng đó hiện "Tính khi lưu".
- [ ] Opus chạy đủ năm lệnh kiểm, soát, commit.
