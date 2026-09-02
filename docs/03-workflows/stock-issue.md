# Luồng xuất kho

```flow-decl
routes: /admin/inventory/issue-slips
files: lib/manual-issue-transaction.ts
tables: issue_slips, stock_issues
brCodes: BR-COGS-005
```

Luồng phiếu xuất kho: nhân viên ghi một phiếu xuất vật tư ra khỏi kho. Phiếu ghi
xong sẽ tạo bản ghi hàng rời kho, và đây là một trong hai đường làm phát sinh giá
vốn (`BR-COGS-005`). Toàn bộ việc ghi chạy qua một hàm nguyên tử trong cơ sở dữ
liệu, gọi từ `lib/manual-issue-transaction.ts`.

## Năm câu hỏi mô tả hiện trạng

1. **Trạng thái.** Một phiếu xuất chỉ có một trạng thái: đã ghi. Ghi xong là cố
   định; không có nháp, không có duyệt. Muốn huỷ tác dụng thì ghi một phiếu đảo
   ngược, không sửa phiếu cũ.
2. **Nút/điểm vào.** Màn hình phiếu xuất tại `/admin/inventory/issue-slips` có
   nút tạo phiếu mới. Không có nút sửa hay xoá phiếu đã ghi.
3. **Danh sách.** Bảng liệt kê các phiếu xuất đã ghi, mỗi dòng là một lần xuất.
   Chênh lệch kiểm kê không nằm ở đây — đó là một đường ghi giá vốn khác.
4. **Ô nhập.** Mỗi dòng phiếu cần một vật tư và một số lượng dương. Số lượng bằng
   0 hoặc âm không hợp lệ.
5. **Phục vụ dữ liệu nào.** Phục vụ vật tư mua vào rời kho theo thao tác tay. Cố
   ý không phục vụ chênh lệch kiểm kê (đường riêng) và không phục vụ bán hàng
   (bán hàng không trừ tồn tại thời điểm bán).

## Ghi vào đâu

Hàm ghi nguyên tử ghi vào hai bảng: `issue_slips` (đầu phiếu) và `stock_issues`
(từng dòng hàng rời kho). Bản đồ máy sinh ra tại `docs/generated/system-map.md`
xác nhận đúng hai quan hệ ghi này từ `lib/manual-issue-transaction.ts`.
