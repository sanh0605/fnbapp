# supabase — migration và edge function

- **Không sửa migration đã chạy.** Thêm file mới, số kế tiếp.
- Trước khi viết migration đụng một bảng: liệt kê trigger của bảng đó và nói rõ mỗi trigger làm gì với các dòng bị đụng; kiểm tên trigger có nhầm với tên hàm không (sự cố 2026-07-31). Skill: `fnbapp-bulk-data-change`.
- Migration đổi **kết quả trả về** của một hàm phải lên **cùng lúc** với code đọc hàm đó. Không bao giờ chạy migration trước (sự cố `0076`, 2026-08-30: bốn tiếng mỗi phiếu xuất ghi thành công nhưng báo lỗi đỏ).
- `npx supabase migration list` **không phải hiện trạng**: bảng theo dõi dừng ở `0064`, còn máy chủ đã chạy tới `0096` (đo 2026-09-07). Muốn biết migration đã chạy chưa thì truy vấn bảng hoặc cột nó tạo/xoá.
- Chạy migration lên máy chủ thật: chủ quán duyệt **từng lần**, tách khỏi duyệt push.
- Test đọc chữ migration nằm ở `tests/migrations/`; test edge function ở `tests/edge-functions/`. Không đặt test trong thư mục này.
- `functions/`: chạy trên Deno, import qua URL, `tsc` của dự án không kiểm; `backup-to-sheets` có `node_modules` riêng, không mở.
