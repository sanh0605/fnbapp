---
description: Read UI-FEEDBACK.md, locate and fix each item, clear only what was actually fixed, report in Vietnamese.
---

Đọc `UI-FEEDBACK.md` ở gốc repo. File này do công cụ "Góp ý" trên bản xem trước
tạo ra khi chủ quán bấm vào một phần tử trên trang và gõ ghi chú -- xem
`docs/superpowers/plans/2026-08-26-ui-feedback-tool.md`.

Nếu file không tồn tại hoặc không có mục nào, báo ngắn gọn bằng tiếng Việt là
không có góp ý nào đang chờ, rồi dừng.

Với **mỗi mục** trong file, theo thứ tự:

1. **Tìm đúng chỗ trong mã nguồn.** Mỗi mục có thể có:
   - `Nguồn: file:dòng:cột` -- vị trí chính xác nhất, dùng trực tiếp nếu có.
   - `Selector` -- đường dẫn CSS selector từ `<body>`.
   - `Class` -- chuỗi class Tailwind, thường đủ riêng biệt để `grep` trực tiếp
     ra đúng file.
   - `Text` -- đoạn `textContent`, tiếng Việt nên grep rất hiệu quả.

   Ưu tiên `Nguồn` nếu có. Nếu không, thử `Class` rồi `Text`, đối chiếu với
   `Route` (đường dẫn trang) để chắc đúng file/trang.

2. **Sửa đúng theo ghi chú (`Ghi chú:`) của chủ quán.** Không tự suy diễn thêm
   ngoài điều được yêu cầu. Nếu ghi chú không đủ rõ để sửa chắc chắn, đừng đoán.

3. **Quyết định giữ hay xoá mục đó khỏi file:**
   - Sửa xong, chắc chắn đúng chỗ → xoá mục này khỏi `UI-FEEDBACK.md`.
   - Không tìm được đúng chỗ, hoặc ghi chú không đủ rõ để sửa → **giữ nguyên
     mục đó trong file**, thêm một dòng `Ghi chú xử lý:` ngay dưới ghi chú gốc
     giải thích vì sao chưa sửa được. Không được tự ý xoá một mục chưa thực sự
     xử lý -- mất lời chủ quán đã gõ là mất luôn, không phục hồi được.

4. **Đừng gộp sửa nhiều mục không liên quan vào một chỗ.** Mỗi mục sửa đúng
   phạm vi của nó -- theo `CLAUDE.md` mục 7, "chỉ chạm đúng chỗ cần".

Sau khi xử lý xong tất cả các mục:

- Ghi lại `UI-FEEDBACK.md`, chỉ xoá những mục đã thực sự sửa xong.
- Chạy `npx tsc --noEmit` và `npx vitest run` trên các file đã đổi.
- Báo cáo ngắn gọn bằng **tiếng Việt**: đã sửa bao nhiêu mục, sửa ở file nào,
  còn lại bao nhiêu mục chưa xử lý được và vì sao.
