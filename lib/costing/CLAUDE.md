# lib/costing — máy tính giá vốn

Luật chi tiết: `docs/02-rules/business-rules/cogs.md` (mã `BR-COGS-*`).

- Giá vốn đo **lúc hàng rời kho** (phiếu xuất, chênh lệch kiểm kê), không đo lúc bán. Đừng thêm bất kỳ đường trừ kho hay tính giá vốn nào vào luồng bán hàng.
- Nguyên liệu tính theo bình quân gia quyền của các lần mua (`purchase-ledger-rebuild.ts`, `purchase-order-cost-allocation.ts`).
- `stock_ledger` và `inventory_ledger` đã bị xoá (migration `0096`). Không đọc, không ghi, không viết test nhắc tới chúng như bảng đang có.
- Làm tròn: đo bằng JavaScript, không nháp bằng Python — hai ngôn ngữ làm tròn 0,5 ngược nhau. Làm tròn hiển thị nằm ở `lib/reports/display-rounding.ts`, không nằm ở đây.
- **`scripts/verify-cogs.ts`** (từ 2026-09-08) kiểm hai cửa: mỗi đơn mua hàng khớp số tiền đã trả (`BR-COGS-006`), và giá vốn báo cáo khớp con số tính lại độc lập, không import từ `lib/costing` (`BR-COGS-005`). Hao hụt kiểm kê chỉ in ra, không chặn cửa. Chạy: `npx vite-node scripts/verify-cogs.ts`. Sửa gì ở đây thì chạy lại script này, đồng thời báo chủ quán mở báo cáo "Giá trị hàng đã xuất" đối chiếu bằng mắt.
