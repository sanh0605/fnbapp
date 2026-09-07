# scripts — chạy tay và cửa kiểm

- Script ghi dữ liệu thật: **mặc định chạy thử**, `--apply` mới ghi; in số dòng và đối tượng trước khi ghi; chủ quán duyệt từng lần ghi. Skill: `fnbapp-bulk-data-change`.
- Tiền tố tên quyết định quyền: `audit-`, `verify-`, `check-`, `inspect-`, `investigate-`, `diagnose-` là chỉ đọc; các tiền tố khác phải hỏi. Đặt tên đúng bản chất.
- Tên cột lấy từ `information_schema` rồi tra bản đó; câu truy vấn sai tên cột nằm lại trong nhật ký lỗi của chủ quán.
- Báo kết quả kèm mẫu số: "0 lệch trên 3.364 dòng", không nói trống "0 lệch".
- `doc-checks/run-blocking.ts` là lối vào duy nhất của các cửa tài liệu; `check-rules-current.ts` là cửa luật; pre-commit gọi cả hai. Thêm cửa mới thì thêm vào `run-blocking.ts`, không tạo lối vào thứ hai.
- `system-map/generate.ts` sinh `docs/generated/system-map.md`; sửa tay file sinh là vô ích.
