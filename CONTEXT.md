# Bối cảnh kinh doanh FNB App

Trạng thái: tài liệu chính thống về bối cảnh kinh doanh

Xác minh gần nhất: 2026-07-17

## Mục đích

FNB App hỗ trợ chủ quán vận hành một điểm bán đồ uống theo mô hình xe/quầy và bán mang đi. Mục tiêu của hệ thống là giúp nhân viên bán hàng nhanh, giúp chủ quán theo dõi doanh thu và giá vốn đáng tin cậy, đồng thời giữ được dấu vết khi dữ liệu cần kiểm tra hoặc phục hồi.

Tài liệu này mô tả nhu cầu và phạm vi kinh doanh. Cách hệ thống được xây dựng nằm trong [`ARCHITECTURE.md`](ARCHITECTURE.md); các quy tắc chi tiết nằm trong [`docs/BUSINESS-RULES.md`](docs/BUSINESS-RULES.md).

## Mô hình đang vận hành

- Một thương hiệu đang hoạt động tại một điểm bán.
- Khách hàng chủ yếu mua đồ uống mang đi.
- Nhân viên sử dụng màn hình POS để tạo đơn; chủ/quản lý sử dụng khu vực quản trị để theo dõi đơn hàng, hàng hóa, tồn kho, sản xuất và báo cáo.
- Supabase Postgres là nơi lưu dữ liệu vận hành chính.
- Google Drive giữ các bản sao lưu toàn bộ dữ liệu theo lịch đã duyệt.

Hỗ trợ nhiều thương hiệu, nhiều chi nhánh hoặc nhượng quyền là phạm vi tương lai. Các mục này chỉ được xem là đang hoạt động khi có bằng chứng trong [`docs/FEATURE-CATALOG.md`](docs/FEATURE-CATALOG.md).

## Kết quả kinh doanh mong muốn

1. **Bán hàng rõ ràng:** đơn hàng, giảm giá, phương thức thanh toán và người thao tác có dấu vết phù hợp.
2. **Giá vốn đáng tin cậy:** giá vốn được chốt tại thời điểm bán; báo cáo không thay đổi lịch sử một cách âm thầm.
3. **Tồn kho có thể giải thích:** mua hàng, điều chỉnh, sản xuất và tiêu hao đều đi qua sổ kho hoặc quy trình kiểm tra tương ứng.
4. **Phát hiện sai lệch:** các công cụ kiểm tra phân biệt sai lệch đã biết với vấn đề mới cần điều tra.
5. **Có khả năng phục hồi:** dữ liệu được sao lưu đầy đủ, có kiểm tra cấu trúc và có kế hoạch phục hồi riêng trước khi dùng bản sao lưu.
6. **Dễ sử dụng:** giao diện vận hành bằng tiếng Việt, phù hợp màn hình nhỏ và công việc tại quầy.

## Phạm vi hiện tại

### Trong phạm vi

- Bán hàng tại quầy/POS.
- Quản lý đơn hàng, sản phẩm, biến thể, modifier và công thức.
- Mua hàng, sổ kho, điều chỉnh tồn kho và sản xuất bán thành phẩm.
- Báo cáo doanh thu, giá vốn và lợi nhuận theo các quy tắc đã duyệt.
- Kiểm tra dữ liệu, khóa bằng chứng lịch sử và xử lý sự kiện nhập liệu lùi ngày.
- Quản lý người dùng ở mức hiện có.
- Sao lưu toàn bộ dữ liệu hằng ngày và giữ bản tháng dài hạn.

### Chưa được xác minh hoặc chưa thuộc phạm vi hiện tại

- **Bán hàng khi mất mạng:** chưa được Pre-Audit C xác minh; không được quảng cáo là tính năng đang hoạt động.
- **Nhiều thương hiệu/nhiều chi nhánh/nhượng quyền:** để trong roadmap tương lai. Chủ quán đã xác nhận thứ tự ưu tiên (2026-07-18): đa chi nhánh trước, nhượng quyền sau, cả hai đều chờ sau khi hoàn tất audit hiện tại + hoàn thiện chức năng cốt lõi + nâng cấp UI/UX. Chi tiết trình tự: [`docs/ROADMAP.md`](docs/ROADMAP.md) mục "Future direction".
- **Quyền truy cập chi tiết theo vai trò:** mục tiêu được mô tả trong [`docs/ACCESS-MODEL.md`](docs/ACCESS-MODEL.md), nhưng việc thực thi đầy đủ được chủ quán xếp là bước cuối cùng trong lộ trình (sau khi có hình dạng cuối cùng của hệ thống, bao gồm cả đa chi nhánh/nhượng quyền), để tránh thiết kế phân quyền hai lần.
- **Tự động phục hồi từ backup:** không có. Mọi lần phục hồi cần kế hoạch và phê duyệt riêng.
- **Tự động sửa dữ liệu lịch sử:** không có. Mọi thay đổi lịch sử cần dry-run, xác minh và đường quay lui đã duyệt.

## Thuật ngữ chính

- **MAC:** giá vốn bình quân di động, chuẩn dùng cho giá vốn và báo cáo lợi nhuận.
- **Giá vốn tại thời điểm bán:** giá trị được lưu trên dòng đơn hàng để lịch sử không tự thay đổi.
- **Sổ kho:** chuỗi nghiệp vụ làm tăng hoặc giảm số lượng hàng.
- **BTP:** bán thành phẩm được sản xuất trước rồi tiêu hao khi bán sản phẩm.
- **Nhập liệu lùi ngày:** giao dịch được tạo sau nhưng có ngày hiệu lực trước thời điểm tạo.
- **Bản chụp dữ liệu:** dữ liệu nghiệp vụ được lưu tại thời điểm giao dịch để tái hiện kết quả lịch sử.

Định nghĩa đầy đủ và tên kỹ thuật chính xác nằm trong [`docs/domain-dictionary.md`](docs/domain-dictionary.md).

## Thẩm quyền quyết định

- Chủ doanh nghiệp phê duyệt phạm vi kinh doanh, quy tắc vận hành và mọi thay đổi dữ liệu sản xuất có rủi ro.
- [`docs/BUSINESS-RULES.md`](docs/BUSINESS-RULES.md) là cửa vào cho các quy tắc đã duyệt.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) là nguồn duy nhất cho việc còn chờ làm.
- [`docs/COMPLETED.md`](docs/COMPLETED.md) là mục lục kết quả đã hoàn tất.
- [`DEVELOPMENT-TRACKING.md`](DEVELOPMENT-TRACKING.md) lưu nhật ký kỹ thuật chi tiết.
- Tài liệu audit, kế hoạch phục hồi và biên bản cũ được giữ làm bằng chứng; chúng không tự động trở thành hướng dẫn hiện hành.

## Khi nào cần cập nhật tài liệu này

Cập nhật khi thay đổi mô hình kinh doanh, số thương hiệu/điểm bán đang hoạt động, kênh bán, phạm vi vận hành hoặc tiêu chí thành công. Không cập nhật chỉ vì đổi tên file hay sắp xếp lại code.
