# Xem thử trên điện thoại và ghi góp ý trực tiếp trên giao diện

Chỉ chạy trên máy đang sửa code. Không có trên bản đã đưa lên mạng (deploy) --
xem `docs/superpowers/plans/2026-08-26-ui-feedback-tool.md`.

## Cách mở

Trên máy đang chạy Claude Code / VS Code:

```
npm run preview
```

Lệnh này in ra hai địa chỉ:

- Trên máy tính này: `http://localhost:3000`
- Trên điện thoại (cùng wifi): `http://<địa chỉ IP>:3000`

Gõ địa chỉ thứ hai vào trình duyệt trên điện thoại (điện thoại phải nối
**cùng mạng wifi** với máy tính). Nếu máy tính có nhiều mạng (wifi + VPN...),
lệnh sẽ in ra nhiều địa chỉ -- thử lần lượt cái nào điện thoại vào được.

`npm run dev` (lệnh cũ) vẫn dùng bình thường, không đổi gì -- `npm run preview`
chỉ là thêm lựa chọn khi cần xem trên điện thoại thật.

## Cách góp ý

Ở góc dưới bên phải màn hình có nút **"Góp ý"** (chỉ hiện khi chạy bằng
`npm run preview` hoặc `npm run dev`, không hiện trên bản thật).

1. Bấm **"Góp ý"**.
2. Chọn:
   - **"Chọn phần tử để góp ý"** -- rồi bấm vào đúng chỗ trên trang bị sai
     (nút, chữ, khung...). Bấm Esc nếu đổi ý không chọn nữa.
   - **"Góp ý chung (không chọn phần tử)"** -- khi góp ý không nhắm vào một
     chỗ cụ thể.
3. Gõ vài dòng mô tả vấn đề, bấm **Lưu**.

Bấm lại nút "Góp ý" để xem lại danh sách đã ghi, hoặc bấm **Xoá** để bỏ một
mục không cần nữa.

Sửa code trong lúc đang xem thử sẽ tự tải lại trang và **giữ nguyên vị trí
đang cuộn** -- không bị nhảy về đầu trang.

## Cách nhờ sửa

Các góp ý được lưu vào file UI-FEEDBACK.md ở gốc dự án (file này chỉ tự tạo
khi có góp ý đầu tiên, của riêng máy, không đưa lên kho mã nguồn). Mở phiên
Claude Code, gõ:

```
/fix-ui-feedback
```

Claude sẽ đọc từng góp ý, tìm đúng chỗ trong code, sửa theo đúng điều đã ghi,
rồi báo lại đã sửa được bao nhiêu, còn lại bao nhiêu chưa sửa được (kèm lý
do). Góp ý đã sửa xong sẽ tự động biến mất khỏi danh sách; góp ý chưa sửa
được vẫn còn đó để hỏi lại hoặc ghi rõ thêm.
