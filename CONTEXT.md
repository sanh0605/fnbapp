# CONTEXT.md — FNB App

## Tổng quan dự án
Ứng dụng quản lý kinh doanh F&B, bắt đầu với mô hình xe cà phê lưu động.
Tầm nhìn dài hạn: mở rộng ra nhiều brand và mô hình kinh doanh khác trong ngành F&B.

## Thông tin kỹ thuật
- Repository: github.com/[username]/fnbapp
- Platform: PWA (Progressive Web App) — offline-first
- Ngôn ngữ: HTML, CSS, JavaScript thuần (nâng lên framework sau nếu cần)
- Lưu trữ: GitHub (code) + Google Drive (tài liệu, CONTEXT.md)
- Môi trường: vscode.dev kết nối thẳng vào GitHub

## Quyết định thiết kế đã chốt
- UI mobile-first, tối ưu thao tác một tay
- Giỏ hàng dạng bottom sheet — ghim dưới cùng
- Hiển thị tổng tiền khi chưa mở, chi tiết khi mở rộng lên
- Ghi chú theo từng món (không phải ghi chú chung cho cả đơn)
- Offline-first: bán được khi mất mạng, tự sync khi có mạng
- Thanh toán: tiền mặt + chuyển khoản QR
- Trạng thái mạng hiển thị trên status bar

## Cấu trúc thư mục
fnbapp/
├── CONTEXT.md
├── README.md
├── docs/
└── src/
├── pos/            ← màn hình bán hàng (đã hoàn thành v3)
├── inventory/      ← quản lý nguyên liệu
├── revenue/        ← theo dõi doanh thu
├── finance/        ← báo cáo P&L, bảng cân đối kế toán
└── schedule/       ← lịch trình địa điểm

## Tiến độ modules

### [x] POS — Màn hình bán hàng (hoàn thành)
- File: `src/pos/index.html`
- Phiên bản: v2
- Tính năng: chọn món theo danh mục, thêm/bớt số lượng,
  bottom sheet giỏ hàng, ghi chú từng món,
  chọn hình thức thanh toán (tiền mặt / chuyển khoản),
  QR động VietQR ACB (cần điền số tài khoản),
  badge trạng thái mạng offline/online
- TODO: điền số tài khoản ACB và tên chủ tài khoản vào PAYMENT_CONFIG

### [x] Auth — Đăng nhập & phân quyền (hoàn thành)
- Files: `src/auth/login.html`, `src/auth/auth.js`
- 3 vai trò: Chủ (owner) / Quản lý (manager) / Nhân viên (staff)
- Đăng nhập bằng tài khoản + mật khẩu
- Tự điều hướng đúng theo vai trò sau đăng nhập
- TODO: đổi mật khẩu mặc định trước khi dùng thật

### [ ] Inventory — Quản lý nguyên liệu
- Tồn kho theo nguyên liệu
- Cảnh báo khi gần hết
- Tự động trừ khi bán món

### [ ] Revenue — Theo dõi doanh thu
- Doanh thu theo ngày, tuần, tháng
- Biểu đồ trực quan

### [ ] Finance — Báo cáo tài chính
- Báo cáo P&L (lãi lỗ)
- Bảng cân đối kế toán
- Chi phí, vốn, khấu hao xe

### [ ] Schedule — Lịch trình địa điểm
- Lịch bán theo địa điểm
- Bản đồ
- Thông báo cho khách hàng thân thiết

## Cách làm việc với Claude
1. Đính kèm file `CONTEXT.md` này vào đầu mỗi cuộc trò chuyện mới
2. Đính kèm thêm file code cần chỉnh sửa nếu có
3. Mô tả yêu cầu — Claude sẽ trả về file hoàn chỉnh đã sửa
4. Paste code mới vào vscode.dev, commit lên GitHub

## Lịch sử thay đổi
- 2025-04: Khởi tạo dự án, hoàn thành màn hình POS v3

## Hệ thống phân quyền

### Đăng nhập
- Tất cả vai trò dùng: tài khoản + mật khẩu
- Sau đăng nhập: tự điều hướng theo vai trò

### Vai trò và quyền hạn

| Tính năng                      | Nhân viên | Quản lý | Chủ |
|-------------------------------|:---------:|:-------:|:---:|
| POS bán hàng                  | ✓ | ✓ | ✓ |
| Xem tồn kho                   | ✓ | ✓ | ✓ |
| Nhập / cập nhật tồn kho       | — | ✓ | ✓ |
| Xem doanh thu trong ngày      | — | ✓ | ✓ |
| Báo cáo doanh thu & tài chính | — | ✓ | ✓ |
| Lịch trình địa điểm           | — | ✓ | ✓ |
| Quản lý công thức pha chế     | — | — | ✓ |
| Quản lý menu & giá            | — | — | ✓ |
| Cài đặt tài khoản thanh toán  | — | — | ✓ |

### Ghi chú
- Phân quyền có thể mở rộng thêm trong tương lai
- Hệ thống thiết kế linh hoạt, dễ thêm vai trò mới