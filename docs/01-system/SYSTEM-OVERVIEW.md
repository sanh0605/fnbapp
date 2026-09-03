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

## Đọc tiếp ở đâu

| Cần gì | Mở file nào |
|---|---|
| Từng khu vực màn hình thật sự làm gì | `docs/03-workflows/` |
| Bản đồ file nào ghi vào bảng nào | `docs/01-system/SYSTEM-MAP.md` |
| Nghĩa của các từ hay gặp | `docs/02-rules/GLOSSARY.md` |
| Công thức tính, mã luật, lý do | `docs/02-rules/business-rules/` |
