---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
---

# Dựng giao diện: thiết bị nào ra thiết bị đó

Luật gốc nằm ở `CLAUDE.md`, mục "Viết code". File này là phần chi tiết, chỉ nạp khi đang
mở file giao diện.

**Cùng một dữ liệu, hai bố cục viết riêng** — không phải một bố cục co giãn cho
vừa cả hai. Không bản nào là "bản chính".

## Trên điện thoại

- **Không dùng bảng ngang.** Mỗi dòng là một thẻ xếp dọc.
- `inputMode="numeric"` cho **mọi** ô nhập số.
- Vùng bấm vừa ngón cái.
- Việc dài phải **hiện tiến độ** và **lưu từng bước lên máy chủ**, không giữ
  trong bộ nhớ trình duyệt rồi lưu một lần ở cuối.

Lý do (chủ quán nêu 2026-08-08): đếm hàng là đứng trước kệ, hàng vỡ thì ghi tại
chỗ. Không ai chạy về bàn mở máy tính để ghi một hộp sữa đổ.

## Trên máy tính

- Dữ liệu nhiều cột thì dùng **bảng thật**, so sánh được bằng mắt theo cột.
- Đừng bày thẻ rời giữa khoảng trắng.

Luật cũ *"điện thoại trước, máy tính được phép còn thô"* (08/08–25/08) đã sinh ra
đúng thứ nó cho phép: bảng thống kê theo điểm bán dựng toàn thẻ dọc, mở trên máy
tính thành vài cái thẻ trôi giữa khoảng trắng. Chủ quán phải bảo mới sửa.

## Bắt buộc khác

- **Màn hình mới phải có lối vào menu.** Có phép kiểm tự động canh; quên gắn thì
  `npx vitest run` đỏ.
- Chữ hiển thị cho người dùng bằng **tiếng Việt**; code và chú thích tiếng Anh.
- **Trang chỉ xong khi cả hai thiết bị đều dùng được.**
