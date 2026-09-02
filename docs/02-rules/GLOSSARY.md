# Từ điển thuật ngữ

Bảng tra nhanh những từ hay gặp khi đọc tài liệu và mở màn hình quản trị.
Mỗi dòng: thuật ngữ, nghĩa nói theo tiếng thường, và chỗ nó xuất hiện.

Chú thích cách viết: chữ trong ô nền xám như `orders_v2` là **tên bảng dữ
liệu** máy dùng, đặt ở đây để khi cần tra sâu thì biết mở đúng chỗ. Người
dùng bình thường không cần nhớ tên này.

| Thuật ngữ | Nghĩa nói cho dễ hiểu | Gặp ở đâu |
|---|---|---|
| Đơn hàng (`orders_v2`) | Phần đầu của một đơn: mã đơn, điểm bán, tổng tiền, trạng thái. Một đơn là một dòng ở đây. | Màn hình Đơn hàng, mọi báo cáo bán hàng |
| Dòng đơn (`order_lines_v2`) | Từng món trong một đơn. Một đơn ba món thì có ba dòng, mỗi dòng ghi tên món, cỡ, số lượng, giá. | Chi tiết một đơn hàng |
| COMPLETED | Trạng thái "bản đơn đang có hiệu lực". Khi đếm doanh thu chỉ tính các đơn ở trạng thái này. | Trạng thái của đơn hàng |
| SUPERSEDED | Trạng thái "bản đơn đã bị thay". Sửa một đơn không xoá bản cũ mà tạo bản mới; bản cũ chuyển sang trạng thái này và không được đếm nữa. Bản cũ và bản mới dùng chung một mã đơn. | Lịch sử sửa đơn |
| Hàng rời kho (`stock_issues`) | Ghi nhận nguyên liệu đã ra khỏi kho. Đây là chỗ tính giá vốn, chứ không tính lúc bán. | Nền của báo cáo giá vốn |
| Nguồn MANUAL | Một loại hàng rời kho: do nhân viên bấm **phiếu xuất kho** (ví dụ đổ bỏ một hộp sữa hỏng). | Trong `stock_issues`, cột nguồn |
| Nguồn STOCKTAKE | Một loại hàng rời kho: **chênh lệch khi đóng một kỳ kiểm kê**. Không được cộng chung với MANUAL rồi gọi là giá vốn của tháng, vì kỳ kiểm kê đầu gánh nhiều tháng dồn lại. | Trong `stock_issues`, cột nguồn |
| Bình quân gia quyền | Cách tính đơn giá vốn của một nguyên liệu: gộp mọi lần mua vào rồi lấy giá trung bình theo số lượng. Ví dụ Trứng gà mua hai đợt giá khác nhau thì giá vốn là mức trung bình chung, không phải giá đợt cuối. | Cách tính giá vốn khi hàng rời kho |
| Phiếu xuất kho (`issue_slips`) | Chứng từ nhân viên lập khi cho nguyên liệu ra khỏi kho ngoài việc bán (hỏng, biếu, dùng nội bộ). Mỗi phiếu tạo ra các dòng hàng rời kho nguồn MANUAL. | Màn hình Phiếu xuất kho |
| Kiểm kê (`stocktake_sessions`, `stocktake_lines`) | Đợt đếm hàng thực tế trong kho rồi so với số máy tính ra. Chỉ đếm gói còn nguyên, gói đã bóc không đếm. Một đợt gồm phiên đếm và các dòng đếm từng mặt hàng. | Màn hình Kiểm kê |
| Thanh lý tài sản (`asset_disposals`) | Ghi nhận một dụng cụ, thiết bị được bán, cho, hoặc bỏ đi. Chỉ ghi thêm dòng thanh lý, không sửa lùi giá trị cũ. | Màn hình Tài sản |
| Bảng khấu hao (`asset_depreciation_bands`) | Bảng quy định: tài sản trong khoảng giá nào thì phân bổ chi phí trong bao nhiêu tháng. Chủ quán tự sửa được bảng này. | Màn hình Bảng khấu hao tài sản |
| BTP — bán thành phẩm (`semi_products`) | Thứ tự làm ra rồi dùng làm nguyên liệu cho món bán (ví dụ cốt trà ủ sẵn, siro tự nấu). Không bán trực tiếp cho khách. | Công thức món, tồn kho |
| Điểm bán / outlet (`outlets`) | Một chỗ bán hàng thực tế. Quán có hai điểm bán, mã `001` và `002`. Kho dùng chung, không tách theo điểm bán. | Màn hình Điểm bán, mã đơn hàng |
| Thương hiệu / brand (`brands`) | Nhãn gắn với điểm bán (Phin Đi, Uchako). Mỗi điểm bán thuộc một thương hiệu. | Màn hình Thương hiệu, món và khuyến mãi |
| sheets_db (`lib/sheets_db.ts`) | Lớp phần mềm trung gian để đọc/ghi dữ liệu. Tên có chữ "sheets" gợi nhớ Google Sheets thời đầu, nhưng thực chất giờ nói chuyện với cơ sở dữ liệu Supabase. Chỉ là chuyện đặt tên cũ còn giữ lại. | Bên trong mã nguồn |
