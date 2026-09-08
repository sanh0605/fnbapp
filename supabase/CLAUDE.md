# supabase — migration và edge function

- **Không sửa migration đã chạy.** Thêm file mới, số kế tiếp.
- Trước khi viết migration đụng một bảng: liệt kê trigger của bảng đó và nói rõ mỗi trigger làm gì với các dòng bị đụng; kiểm tên trigger có nhầm với tên hàm không (sự cố 2026-07-31). Skill: `fnbapp-bulk-data-change`.
- Migration đổi **kết quả trả về** của một hàm phải lên **cùng lúc** với code đọc hàm đó. Không bao giờ chạy migration trước (sự cố `0076`, 2026-08-30: bốn tiếng mỗi phiếu xuất ghi thành công nhưng báo lỗi đỏ).
- `npx supabase migration list --linked` **đã khớp lại**: đo 2026-09-08, máy chủ ghi nhận đủ `0001`–`0098`, chỉ `0099` còn ở máy. Nhưng bảng theo dõi từng lệch (dừng ở `0064` trong khi máy chủ đã chạy tới `0096`, đo 2026-09-07), nên vẫn đo lại trước khi tin: cách chắc nhất là truy vấn bảng hoặc cột mà migration đó tạo/xoá.
- **Không phiên nào ở máy này truy vấn thẳng được Postgres.** PostgREST không đọc `pg_catalog`, schema không có hàm chạy SQL tuỳ ý, `supabase db dump --linked` cần Docker (không chạy), và không có `psql`. Nên phần liệt kê trigger trong đầu file migration phải ghi đúng nguồn: suy ra từ chữ migration (grep toàn bộ `create trigger`/`drop trigger`), **không được viết "đã kiểm trực tiếp trên máy chủ"**. Mẫu đúng: `0062`, và `0099` (đã sửa lại 2026-09-08). `0097` và `0098` còn câu ghi nguồn sai nhưng đã chạy rồi nên không sửa — nội dung trigger của chúng vẫn đúng, chỉ câu ghi nguồn là không có căn cứ.
- Chạy migration lên máy chủ thật: chủ quán duyệt **từng lần**, tách khỏi duyệt push.
- Test đọc chữ migration nằm ở `tests/migrations/`; test edge function ở `tests/edge-functions/`. Không đặt test trong thư mục này.
- `functions/`: chạy trên Deno, import qua URL, `tsc` của dự án không kiểm; `backup-to-sheets` có `node_modules` riêng, không mở.
