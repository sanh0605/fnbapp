# Hệ thống này là gì

Tài liệu này chỉ nói **quán là gì** và **hệ thống làm việc theo lối nào ở mức
khái niệm**. Nó cố ý **không liệt kê tính năng** — muốn biết từng màn hình thật
sự làm gì thì đọc `docs/03-workflows/`. Bản đồ file nào ghi bảng nào nằm ở
`docs/01-system/SYSTEM-MAP.md`. Nghĩa của các từ hay gặp nằm ở
`docs/02-rules/GLOSSARY.md`.

## Quán

Một quán đồ uống, bán mang đi và bán qua xe/quầy. Quán có **hai điểm bán**, mã
`001` và `002`. Mỗi điểm bán gắn với một thương hiệu riêng — Phin Đi và Uchako.

**Kho dùng chung.** Dù có hai điểm bán, kho nguyên liệu là **một kho duy nhất**,
không tách theo điểm bán. Khi đọc tồn kho hay giá vốn, đừng tìm cách chia số
liệu theo từng điểm bán — hệ thống không lưu theo lối đó.

## Đường đi của tiền vào

Ở mức khái niệm: khách mua hàng trên máy bán hàng (POS), và giao dịch đó trở
thành một **đơn hàng** trong hệ thống. Đây là nền của mọi báo cáo doanh thu.

Cần biết một đơn được ghi qua những bước nào, ai ghi bản đơn hoàn tất, và cách
sửa đơn tạo ra bản mới thay vì đè bản cũ — đọc luồng bán hàng trong
`docs/03-workflows/`, và cách tính doanh thu trong `docs/02-rules/business-rules/`.

## Đường đi của tiền ra — chỗ dễ hiểu sai nhất

Điểm mấu chốt cần nắm ở mức khái niệm: **giá vốn được đo lúc hàng RỜI KHO, không
đo lúc bán.** Từ mốc chuyển đổi ngày 2026-08-07, một lần bán **không** trừ tồn
kho và không tính giá vốn ngay tại lúc đó. Hàng chỉ được coi là tiêu hao khi nó
thực sự ra khỏi kho — qua phiếu xuất, hoặc qua chênh lệch khi đóng một kỳ kiểm
kê.

Giá vốn của nguyên liệu tính theo **bình quân gia quyền** của các lần mua vào.

Đây chỉ là bức tranh khái niệm. Công thức chính xác, các mã luật, và lý do chọn
cách này nằm trong `docs/02-rules/business-rules/`; các bước thao tác thật nằm trong
`docs/03-workflows/`. Tài liệu này cố ý không chép lại công thức.

## Hai cái bẫy khi đọc mã nguồn

Người mới đọc mã nguồn sẽ vấp hai chỗ đặt tên, cả hai đều vô hại một khi đã biết:

**Bẫy thứ nhất — tên nói Google Sheets, ruột là Supabase.** Lớp trung gian đọc
ghi dữ liệu nằm ở `lib/sheets_db.ts`. Cái tên có chữ "sheets" là dấu vết thời
đầu dùng Google Sheets; thực chất bây giờ nó nói chuyện với cơ sở dữ liệu
Supabase. Rất nhiều file trong mã nguồn đang gọi tới nó — cứ đọc tên mà tưởng
đây là Google Sheets là hiểu sai ngay ngày đầu.

**Bẫy thứ hai — một bảng, hai lối viết hoa.** Trong bản đồ hệ thống, cùng một
bảng dữ liệu có thể hiện ra dưới hai kiểu viết hoa khác nhau, ví dụ `Products`
và `products`, hay `Stock_Adjustments` và `stock_adjustments`. Đó **vẫn là một
bảng** — một lối viết đến từ lời gọi qua `lib/sheets_db.ts`, lối kia đến từ thân
một hàm RPC. Đừng đếm chúng thành hai bảng.

## Web chạy ở đâu

Máy chủ dữ liệu đặt tại Singapore, nên máy chạy web cũng **phải đặt ở Singapore**
(vùng `sin1`) — cùng vùng với cơ sở dữ liệu. Để chỗ khác thì mỗi lần mở trang bị
chậm hẳn và có trang hỏng. Đây là một dòng cài đặt của dự án, không nằm trong mã
nguồn, nên dựng lại hay đổi chỗ chạy là dễ mất — cần nhớ đặt lại.

## Thành phần chạy ngoài luồng màn hình

Ba Supabase Edge Function và bốn route API của Next.js không thuộc một màn
hình nào — chạy nền hoặc phục vụ máy khác gọi tới. Liệt kê ở đây cho đủ, đọc
mã nguồn trực tiếp nếu cần chi tiết.

**Edge Function** (`supabase/functions/`):

- `backup-to-drive` — dựng một bản chụp toàn bộ dữ liệu (theo danh sách bảng
  cho phép) khi có request kèm token đúng, dùng cho sao lưu định kỳ lên Google
  Drive. Chi tiết vận hành: `docs/04-operations/INCIDENT-RESPONSE.md`.
- `backup-to-sheets` — mỗi ngày đồng bộ một chiều `orders_v2` +
  `order_lines_v2` sang Google Sheets để xem/đối chiếu bằng mắt, chạy tiếp từ
  mốc đã lưu trong `sync_state`.
- `user-admin` — tạo/sửa/xoá tài khoản đăng nhập, cầu nối giữa Supabase Auth
  và bảng `users`; chỉ vai trò `owner` gọi được, trừ nhánh `/migrate` một lần
  dùng khoá service-role để đưa tài khoản cũ sang Supabase Auth.

**Route API** (`app/api/`):

- `app/api/auth/[...nextauth]/route.ts` — cổng đăng nhập/phiên làm việc của
  chính ứng dụng (NextAuth), tách biệt với Supabase Auth mà `user-admin` dùng.
- `app/api/client-errors/route.ts` — nhận lỗi JavaScript xảy ra trên trình
  duyệt của người dùng đã đăng nhập, ghi vào log server để theo dõi.
- `app/api/dev-feedback/route.ts` — chỉ chạy khi phát triển (chặn hẳn ở môi
  trường production), lưu góp ý "trỏ và ghi chú" của chủ quán vào một tệp
  Markdown ở gốc repo, không nằm trong git (`lib/ui-feedback-store.ts` đọc/ghi
  tệp này).
- `app/api/revalidate/route.ts` — chỉ admin gọi được, buộc Next.js tính lại
  cache của các trang đọc dữ liệu Sheets khi cache cũ.

## Đọc tiếp ở đâu

| Cần gì | Mở file nào |
|---|---|
| Từng khu vực màn hình thật sự làm gì | `docs/03-workflows/` |
| Bản đồ file nào ghi vào bảng nào | `docs/01-system/SYSTEM-MAP.md` |
| Nghĩa của các từ hay gặp | `docs/02-rules/GLOSSARY.md` |
| Công thức tính, mã luật, lý do | `docs/02-rules/business-rules/` |
| Thêm chi nhánh đụng tới đâu (hiện trạng, chưa phải thiết kế) | `docs/01-system/MULTI-BRANCH-IMPACT.md` |
