# Bỏ khung bật lên ở trang quản trị: thiết kế

Trạng thái: **chờ chủ quán duyệt bản viết** (viết 2026-10-01; câu ở mục 6 đã trả lời B). Chưa code gì.

Nguồn: `BR-DATA-007` (chủ quán chốt 2026-09-30); việc chưa xong trong `app/admin/no-popups.test.ts`.

Đã xem:
- Danh sách 36 file dưới `app/admin` có dùng khung bật lên: `FormModal`, `DeleteConfirmModal`, `ModalPortal`, `confirm()` và `alert()` của `lib/shared/dialog.ts`. Đếm 2026-10-01.
- `components/ui/DeleteConfirmModal.tsx`, `lib/shared/dialog.ts`.
- `app/admin/users/edit/[id]/` và `app/admin/inventory/purchase-orders/new/`: hai trang có sẵn đi theo lối "mở trang riêng".
- Số nhà cung cấp tạo theo tháng: 32 tháng 6, 1 tháng 7, 15 tháng 8, 0 tháng 9.

Chưa xem:
- Nội dung từng form. Mỗi đợt sẽ xem lúc lên kế hoạch cho đợt đó.
- `components/ui/Dialog.tsx` có còn chỗ nào dùng không.

## 1. Hiện trạng — năm câu

1. **Trạng thái.**
   - Hiện nay một khung bật lên có hai trạng thái: đang mở hoặc đang đóng. Nó che lên trang đang xem.
   - Sau việc này không còn trạng thái "đang mở" nữa:
     - Ô nhập nằm trên một trang có địa chỉ riêng.
     - Câu hỏi có/không hiện ngay chỗ cái nút vừa bấm.
2. **Nút.**
   - "Thêm …" và "Sửa" chuyển sang trang `…/new` và `…/[id]/edit`.
   - Trang đó có nút quay lại kiểu "← Tên trang", "Lưu" và "Bỏ". Lưu hoặc Bỏ thì quay về danh sách, giữ nguyên bộ lọc.
   - "Xoá" và "Ngừng dùng" thì hiện ngay tại chỗ một dòng "Xoá nhà cung cấp ABC?" kèm hai nút Có / Không.
3. **Danh sách.** 17 nhóm màn hình, chia đợt ở mục 4. Máy bán hàng (`app/pos`) không làm. Ô chọn và lịch chọn ngày không tính là khung bật lên.
4. **Ô nhập.** Ô nhập không đổi luật, chỉ đổi chỗ đặt. Lỗi trước đây báo bằng `alert()` thì hiện thành dòng báo đỏ (`components/ui/Alert`) ngay trên trang.
5. **Dữ liệu.** Không đổi bảng nào, không có migration, không đổi server action.

Câu thêm cho việc này:
- **Đang gõ dở mà bấm sang trang khác thì sao?** Mất, giống hiện nay khi đóng khung. Riêng phiếu nhập khi bấm "+ Nhà cung cấp mới" thì được giữ (mục 6).
- **Trang nào trước đây không có địa chỉ riêng?** Mọi form thêm và sửa. Sau việc này, mỗi form có một địa chỉ, gửi cho người khác mở được.

## 2. Ba khối dùng chung

- **`InlineConfirm`**: thay `DeleteConfirmModal` và `confirm()`.
  - Bấm nút thì chính chỗ nút đó đổi thành câu hỏi kèm "Có" và "Không".
  - Bấm "Không" thì nút cũ hiện lại.
  - Lúc đang chạy thì nút "Có" quay vòng chờ.
- **Trang form**: khuôn `…/new` và `…/[id]/edit`.
  - Đầu trang có `BackLink`.
  - Nội dung là chính form cũ, gỡ khỏi `FormModal`.
  - Lưu xong thì `router.push` về danh sách, kèm bộ lọc cũ.
- **Dòng báo trên trang**: thay `alert()`. Lỗi hiện bằng `Alert` đỏ phía trên form hoặc phía trên danh sách.

Khi đợt cuối xong:
- Xoá `FormModal`, `DeleteConfirmModal`, `ModalPortal` và `lib/shared/dialog.ts`, nếu máy bán hàng không còn dùng. Phải kiểm trước khi xoá.
- `app/admin/no-popups.test.ts` thành phép kiểm thật: quét `app/admin`, thấy một trong các tên trên là đỏ.

## 3. Ví dụ: Nhà cung cấp

- Hiện nay:
  - Bấm "Thêm nhà cung cấp" thì một khung bật lên che danh sách.
  - Bấm thùng rác thì một khung khác hỏi "Xác nhận xoá".
- Sau việc này:
  - Bấm "Thêm nhà cung cấp" thì sang trang `/admin/suppliers/new`, đầu trang có "← Nhà cung cấp". Lưu xong quay về danh sách.
  - Bấm "Sửa" trên dòng ABC thì sang `/admin/suppliers/ABC-id/edit`.
  - Bấm "Xoá" trên dòng ABC thì chính dòng đó hiện "Xoá nhà cung cấp ABC? Có / Không".

## 4. Chia đợt

Mỗi đợt một nhánh, một kế hoạch, một lần duyệt. Thứ tự đi từ màn dễ làm mẫu tới màn khó:

1. **Khối dùng chung và Nhà cung cấp** (làm mẫu).
2. **Thu chi**: sổ thu chi, nhóm thu chi, tài khoản ngân hàng.
3. **Kho**:
   - Mặt hàng, nhóm hàng, đơn vị, quy đổi.
   - Kiểm kê (3 câu hỏi có/không).
   - Phiếu xuất (câu hỏi "ghi lùi ngày").
4. **Tài sản**: khung giá trị, thanh lý.
5. **Món**:
   - Món, nhóm món, tuỳ chọn, topping.
   - Lịch sử giá: đang là khung xem, sẽ thành trang.
6. **Khuyến mãi, thương hiệu, điểm bán, nhân viên.**
7. **Phiếu nhập**: thêm nhà cung cấp nhanh theo cách B ở mục 6, cùng các `alert()` của form phiếu nhập.
8. Nút "Mở máy bán hàng" (hỏi khi điểm bán ngoài giờ) và phép kiểm canh cuối cùng.

## 5. Phân công

- Gemini (bản mới nhất, mạnh nhất qua `agy`): toàn bộ, vì đây là việc giao diện.
- Sonnet: không có phần nào, trừ khi một đợt lộ ra việc phía máy chủ.
- Opus: kế hoạch từng đợt, chứng minh test đỏ trước, soát lại.

## 6. Câu hỏi chờ chủ quán

**Thêm nhà cung cấp ngay trong lúc nhập phiếu nhập.** Hiện nay đang nhập phiếu nhập dở, bấm "+ Nhà cung cấp mới" thì một khung bật lên. Thêm xong thì quay lại phiếu, các dòng đã gõ vẫn còn. Nếu đổi thành trang riêng thì phải chọn một trong ba cách:

- **A.** Cho đây làm ngoại lệ, giữ khung bật lên.
- **B.** Sang trang thêm nhà cung cấp. Máy tự giữ phiếu đang gõ dở trên máy đó, thêm xong quay lại phiếu thì mọi dòng vẫn còn.
- **C.** Bỏ nút thêm nhanh. Phải vào màn Nhà cung cấp tạo trước rồi mới nhập phiếu.

Khuyến nghị lúc hỏi: **C**. Tháng 9 không ai tạo nhà cung cấp mới. Cách B làm thêm cơ chế giữ phiếu dở chỉ để phục vụ một việc hiếm.

**Chủ quán chọn B (2026-10-01).** Cách làm, đợt 7:
- Trước khi rời phiếu, máy lưu bản nháp phiếu (nhà cung cấp, ngày, mọi dòng) vào bộ nhớ của trình duyệt trên máy đó.
- Sang trang `/admin/suppliers/new?from=po` (hoặc `?from=po-<mã phiếu>` khi đang sửa phiếu cũ). Lưu xong thì quay về phiếu, và nhà cung cấp vừa tạo được chọn sẵn. Bấm Bỏ thì quay về phiếu, không chọn gì.
- Mở lại phiếu thì máy đọc bản nháp, điền lại, rồi xoá bản nháp.
- Bản nháp chỉ nằm trên máy đó. Đổi máy, hoặc trình duyệt chặn bộ nhớ, thì mất, và trang báo một dòng "Không khôi phục được phiếu đang nhập dở".
- Bản nháp cũ hơn 1 ngày thì bỏ, không điền lại.
- Phiếu đã chọn sẵn một nhà cung cấp khác thì nhà cung cấp vừa tạo thay vào (chủ quán xác nhận 2026-10-01: *"chỗ nhà cung cấp sẽ tự chọn nhà cung cấp vừa tạo"*).
