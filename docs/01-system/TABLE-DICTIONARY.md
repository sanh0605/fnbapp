# Bảng dữ liệu <-> khái niệm kinh doanh

Cầu nối giữa tên bảng tiếng Anh trong Supabase và khái niệm kinh doanh tiếng
Việt dùng trong `docs/02-rules/GLOSSARY.md` và `docs/02-rules/business-rules/`.
Mở file này khi thấy một tên bảng trong log lỗi, trong mã nguồn, hay trong một
báo cáo kỹ thuật, và cần biết nó nói về cái gì trong thực tế quán.

**Số bảng đang sống: 34** (đếm theo file migration, 2026-09-28). Lịch sử migration từng tạo 50 bảng
(ba bảng cuối là sổ thu chi, migration `0101`: `cash_categories`,
`bank_accounts`, `cash_entries`), nhưng 16 bảng đã bị `DROP TABLE` thật sự.

Migration `0105` gỡ 10 bảng bỏ hoang, chủ quán duyệt 2026-09-28
(`docs/superpowers/specs/2026-09-28-ban-do-bang-du-lieu.md`):
- công thức, bán thành phẩm, lệnh làm mẻ: `recipes`, `semi_products`,
  `production_orders`, `production_items`
- phiếu cân bằng kho: `stock_adjustments`
- ca làm việc: `shifts`, `shift_stock_checks`
- nhật ký kỹ thuật cũ: `data_migration_runs`, `data_recovery_changes`,
  `sync_state`

Trước đó đã gỡ 6 bảng: `stock_ledger`,
`inventory_balances` (migration `0096`, Phase D — sổ kho cũ, thay bằng
`stock_issues`), `base_ingredients` (migration `0090` — nhóm nguyên liệu bậc
hai, chủ quán quyết định xoá 2026-09-01), và `backdated_ledger_events`,
`backdated_recipe_events`, `audit_baseline_locks` (migration `0054` — bộ máy
soát lùi ngày, chưa từng chạy thật, chủ quán duyệt gỡ 2026-08-05). Bảng dưới
đây chỉ liệt kê 34 bảng đang sống, xác nhận bằng cách đọc từng file migration,
không đọc theo số liệu trong bất cứ tài liệu nào khác.

Bảng plumbing (chỉ phục vụ máy chạy, không mang khái niệm kinh doanh) ghi
"hạ tầng/kỹ thuật" ở cột khái niệm, không gán ý nghĩa kinh doanh cho nó.

| Bảng | Khái niệm (VN) | Vai trò (1 dòng) |
|---|---|---|
| `asset_depreciation_bands` | Bảng khấu hao tài sản | Đơn giá tài sản trong khoảng nào thì phân bổ chi phí trong bao nhiêu tháng; chủ quán tự sửa bảng này |
| `asset_disposals` | Thanh lý tài sản | Ghi một tài sản được bán/cho/bỏ; chỉ thêm dòng mới, không sửa lịch sử cũ |
| `assets` | Tài sản/dụng cụ | Một dòng cho mỗi lần mua tài sản, không phải mỗi cái vật lý; giữ giá vốn phân bổ và thời hạn khấu hao |
| `bank_accounts` | Tài khoản ngân hàng | Tài khoản nhận/chi tiền chuyển khoản; dòng sổ thu chi chuyển khoản phải chỉ vào một tài khoản ở đây |
| `brands` | Thương hiệu | Nhãn gắn với điểm bán, ví dụ Phin Đi, Uchako |
| `cash_categories` | Nhóm thu chi | Nhóm của sổ thu chi, ví dụ Vận hành, Marketing; mỗi nhóm thuộc bên Thu hoặc Chi và có cờ tính vào lãi lỗ hay không |
| `cash_entries` | Sổ thu chi | Một khoản tiền ra/vào ngoài bán hàng và mua hàng: ngày, nhóm, số tiền, tiền mặt hay chuyển khoản |
| `issue_slips` | Phiếu xuất kho | Chứng từ nhân viên lập khi cho nguyên liệu ra khỏi kho ngoài việc bán |
| `item_categories` | Nhóm vật tư | Phân loại vật tư mua vào: nguyên liệu, vật tư tiêu hao, hoặc dụng cụ |
| `modifiers` | Topping / tuỳ chọn thêm | Món phụ thêm vào một đơn, có giá riêng |
| `order_events` | Nhật ký thao tác đơn hàng | Ghi mỗi lần một đơn được tạo, sửa, huỷ, hoặc mở lại |
| `order_lines_v2` | Dòng đơn hàng | Từng món trong một đơn: tên món, cỡ, số lượng, giá |
| `order_payments` | Chi tiết thanh toán | Từng phương thức thanh toán của một đơn, cho trường hợp trả nhiều phương thức |
| `orders_v2` | Đơn hàng | Phần đầu của một đơn: mã đơn, điểm bán, tổng tiền, trạng thái |
| `outlets` | Điểm bán | Một chỗ bán hàng thực tế; kho dùng chung, không tách theo điểm bán |
| `pos_drafts` | Giỏ hàng tạm | Giỏ hàng đang thao tác trên máy bán hàng, trước khi đặt thành đơn chính thức |
| `pos_sync_failures` | hạ tầng/kỹ thuật | Đơn từ máy bán hàng gửi lên bị lỗi đồng bộ ở lần thử ngầm, chờ admin xử lý tay |
| `product_categories` | Nhóm món | Danh mục phân loại món trong thực đơn |
| `product_price_history` | Lịch sử đổi giá | Mỗi lần đổi giá một cỡ món, kèm giá cũ/mới và lý do |
| `product_variants` | Cỡ món | Một cỡ/biến thể của một món, mỗi cỡ có giá riêng |
| `products` | Món | Một món trong thực đơn |
| `promotions` | Khuyến mãi | Chương trình giảm giá theo đơn hoặc theo món |
| `purchase_order_edits` | Nhật ký sửa đơn mua hàng | Ghi mỗi lần một đơn mua hàng đã hoàn tất bị sửa |
| `purchase_order_lines` | Dòng đơn mua hàng | Từng dòng vật tư trong một đơn mua hàng: số lượng, đơn giá |
| `purchase_orders` | Đơn mua hàng | Một lần nhập hàng từ nhà cung cấp |
| `purchase_sources` | Nguồn nhập | Kênh/nơi mua hàng cho một đơn mua, khác với nhà cung cấp |
| `purchased_items` | Vật tư mua vào | Một loại nguyên liệu/vật tư có thể mua; tồn kho tính theo từng dòng ở đây |
| `stock_issues` | Hàng rời kho | Ghi nhận nguyên liệu đã ra khỏi kho; đây là chỗ tính giá vốn |
| `stocktake_lines` | Dòng kiểm kê | Số đếm thực tế của từng mặt hàng trong một kỳ kiểm kê |
| `stocktake_sessions` | Kiểm kê | Một đợt đếm hàng thực tế trong kho, so với số máy tính ra |
| `suppliers` | Nhà cung cấp | Đơn vị bán vật tư cho quán |
| `units` | Đơn vị tính | Đơn vị đo, ví dụ kg, lít, cái |
| `uom_conversions` | Quy đổi đơn vị | Tỉ lệ quy đổi từ đơn vị mua vào sang đơn vị gốc dùng để tính tồn kho |
| `users` | Tài khoản | Tài khoản đăng nhập hệ thống, gắn vai trò nhân viên/quản lý/admin |
