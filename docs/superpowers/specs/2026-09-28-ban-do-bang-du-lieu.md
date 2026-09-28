# Bản đồ 44 bảng dữ liệu: bảng nào đang dùng, bảng nào bỏ hoang

**Viết 2026-09-28 bởi Opus 5.5, theo yêu cầu của chủ quán:** tối ưu lại cơ sở
dữ liệu, bỏ phần dư thừa và phần logic rời rạc. File này là bước đầu: đo từng
bảng, chưa gộp hay bỏ bảng nào. Chủ quán quyết từng bảng một.

Cách đo, 2026-09-28:

- Số dòng và ngày ghi gần nhất: truy vấn thẳng máy chủ thật, đủ 44 bảng.
  Ngày chỉ lấy ở bảng có cột ngày tạo hoặc ngày sửa. Tên cột đọc từ bản mô tả
  của máy chủ, không đoán.
- Code còn dùng: tìm tên bảng trong `app/`, `lib/`, `components/`, bỏ qua file
  test.

Đã xem: số dòng cả 44 bảng; nội dung các bảng có từ 0 tới 2 dòng; code gọi các
bảng nghi bỏ hoang; lịch sử git của việc gỡ công thức. Chưa xem: các hàm trong
cơ sở dữ liệu đang còn sống có ghi vào các bảng này không (không phiên nào ở máy
này đọc thẳng được danh sách hàm; chỉ suy được từ chữ migration).

Việc sao lưu (`supabase/functions/backup-to-drive`) có đọc cả 44 bảng. Gỡ bảng
nào thì cũng phải gỡ nó khỏi danh sách sao lưu.

## Nhóm A — đang dùng hằng ngày, giữ nguyên (25 bảng)

| Bảng | Là gì ngoài đời | Số dòng |
|---|---|---|
| `orders_v2` | Đơn bán | 3.079 |
| `order_lines_v2` | Món trong đơn | 4.270 |
| `order_payments` | Tiền khách trả của mỗi đơn | 1.486 |
| `order_events` | Nhật ký sửa/huỷ đơn | 3.113 |
| `products` | Món | 48 |
| `product_variants` | Cỡ món | 60 |
| `product_price_history` | Lịch sử đổi giá | 53 |
| `product_categories` | Nhóm món | 7 |
| `modifiers` | Topping | 9 |
| `promotions` | Khuyến mãi | 2 |
| `purchase_orders` | Đơn nhập hàng | 191 |
| `purchase_order_lines` | Dòng hàng trong đơn nhập | 347 |
| `purchase_order_edits` | Nhật ký sửa đơn nhập | 17 |
| `purchased_items` | Nguyên liệu, vật tư mua vào | 151 |
| `uom_conversions` | Quy đổi đơn vị mua ra đơn vị tính kho | 180 |
| `stock_issues` | Hàng ra khỏi kho (chỗ tính giá vốn) | 173 |
| `issue_slips` | Phiếu xuất kho | 74 |
| `stocktake_sessions` / `stocktake_lines` | Kiểm kê | 1 / 50 |
| `assets` / `asset_disposals` / `asset_depreciation_bands` | Tài sản, thanh lý, bảng khấu hao | 84 / 2 / 3 |
| `cash_entries` / `cash_categories` / `bank_accounts` | Sổ thu chi | 38 / 6 / 1 |

## Nhóm B — danh mục ít đổi, hoặc trống mà vẫn cần, giữ nguyên (9 bảng)

`units` (24), `item_categories` (3), `suppliers` (48), `purchase_sources` (3),
`brands` (2), `outlets` (2), `users` (2). Tất cả đều có màn hình dùng tới.

Hai bảng trống nhưng vẫn phải giữ:

- `pos_sync_failures` (0 dòng): hộp chờ xử lý tay khi máy bán hàng gửi đơn lỗi.
  Trống là tốt.
- `pos_drafts` (0 dòng): giỏ hàng lưu tạm trên máy bán hàng. Giỏ bị xoá khi chốt
  thành đơn, nên lúc không ai treo giỏ thì bảng trống.

## Nhóm C — bỏ hoang, đề xuất gỡ (10 bảng)

| Bảng | Là gì ngoài đời | Số dòng | Vì sao coi là bỏ hoang |
|---|---|---|---|
| `recipes` | Công thức món | 1 | Chủ quán đã quyết gỡ công thức và bán thành phẩm (2026-08-27). Màn hình đã gỡ. Dòng còn lại là một công thức rỗng, tạo 31/08. Code chỉ còn đọc chứ không có chỗ nào nhập. |
| `semi_products` | Bán thành phẩm | 0 | Cùng đợt gỡ trên. Còn 3 chỗ trong code đọc bảng này và luôn nhận về rỗng. |
| `production_orders` | Lệnh làm mẻ bán thành phẩm | 0 | Chưa từng chạy lần nào. Không còn code nào dùng. |
| `production_items` | Nguyên liệu của mẻ | 0 | Như trên. Chỉ còn phần kiểm "đơn vị này đã có ai dùng chưa" khi xoá đơn vị. |
| `stock_adjustments` | Phiếu cân bằng kho | 0 | Chưa từng có cách tạo phiếu. Menu vẫn còn mục "Điều chỉnh Tồn kho", mở ra trang trống. Kiểm kê đã làm thay việc này. |
| `shifts` | Ca làm việc | 1 | Dòng duy nhất là dòng chạy thử ("smoke test - safe to delete", 23/07). Không code nào dùng. |
| `shift_stock_checks` | Đếm hàng đầu/cuối ca | 2 | Hai dòng chạy thử của ca trên. Không code nào dùng. |
| `data_migration_runs` | Nhật ký chuyển dữ liệu cũ | 1 | Một lần chuyển dữ liệu tháng 7, đã xong. Không code nào dùng. |
| `data_recovery_changes` | Nhật ký khôi phục dữ liệu | 0 | Không code nào dùng. |
| `sync_state` | Mốc đồng bộ sang Google Sheets | 1 | Mốc cuối là 13/07/2026: việc đồng bộ sang Google Sheets đã ngừng từ đó. Việc sao lưu hiện tại chạy sang Google Drive, không dùng bảng này. |

**Gỡ nhóm C không làm đổi con số nào.** Không bảng nào trong nhóm này góp vào
doanh thu, giá vốn, tồn kho hay báo cáo tài chính. Số dòng thật đều bằng 0 hoặc
là dòng chạy thử.

## Chỗ logic rời rạc thấy được khi đo

1. **Hai đường ghi hàng hao hụt.** Kiểm kê và phiếu xuất kho cùng ghi vào
   `stock_issues`. Đợt 27/09 cho thấy nhân viên đã dùng phiếu xuất "Khác" để ghi
   phần thiếu khi kiểm. Phần hao hụt vì thế bị tính thành giá vốn. Đây là việc
   nghiệp vụ, không phải việc gộp bảng.
2. **Tài liệu luật còn nói về công thức.** `BR-INV-006` ghi "công thức vẫn giữ".
   `cogs.md` ghi "96 công thức phủ 3.988 ly". Thực tế máy chủ chỉ còn 1 công thức
   rỗng. Sửa theo quyết định chủ quán chốt ở nhóm C.
3. **Code chết nhỏ.** `lib/db/tables.ts` còn nhắc bảng `base_ingredients`, đã xoá
   từ 01/09. Chỉ ghi lại, chưa sửa.
