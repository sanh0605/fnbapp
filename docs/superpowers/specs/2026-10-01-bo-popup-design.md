# Khung có ô nhập thành trang riêng: thiết kế

Trạng thái: **chủ quán đã duyệt 2026-10-01**, kèm một chỗ sửa: câu hỏi có/không và báo lỗi vẫn bật khung (*"2 cái này vẫn hiện theo kiểu bật khung nhé"*). Chưa code gì.

Nguồn:
- `BR-DATA-007` (chủ quán chốt 2026-09-30, thu hẹp 2026-10-01).
- Việc chưa xong ghi trong `app/admin/no-popups.test.ts`.

Đã xem:
- 36 file dưới `app/admin` có dùng khung bật lên (đếm 2026-10-01). Trong đó 21 file có khung ô nhập hoặc khung xem, tức là phần phải đổi.
- `components/ui/DeleteConfirmModal.tsx`, `lib/shared/dialog.ts`.
- `app/admin/users/edit/[id]/`, `app/admin/inventory/purchase-orders/new/`: lối "mở trang riêng" đã có sẵn.
- Số nhà cung cấp tạo theo tháng: 32 trong tháng 6, 1 trong tháng 7, 15 trong tháng 8, 0 trong tháng 9.
- Không có chỗ nào dùng `window.confirm` hay `window.alert`.

Chưa xem: nội dung từng form. Mỗi đợt sẽ xem lúc lên kế hoạch cho đợt đó.

## 1. Hiện trạng — năm câu

1. **Trạng thái.**
   - Khung ô nhập hiện có hai trạng thái, đang mở hoặc đang đóng, và che lên trang.
   - Sau việc này, khung ô nhập không còn trạng thái "đang mở": nó thành một trang có địa chỉ riêng.
   - Khung hỏi có/không và khung báo lỗi giữ nguyên như hiện nay.
2. **Nút.**
   - "Thêm …" và "Sửa" chuyển sang trang `…/new` và `…/[id]/edit`.
   - Mỗi trang đó có nút "← Tên trang", "Lưu" và "Bỏ". Lưu hoặc Bỏ thì quay về danh sách, bộ lọc giữ nguyên.
   - "Xoá" và "Ngừng dùng" vẫn bật khung hỏi như hiện nay.
3. **Danh sách những khung phải đổi.**
   - **Khung có ô nhập**: các form thêm và sửa, thanh lý tài sản, thêm nhà cung cấp nhanh.
   - **Khung chỉ để xem**: lịch sử giá món, lịch sử giá nhập của mặt hàng.
   - **Không đổi**:
     - Khung hỏi có/không và khung báo lỗi.
     - Ô chọn, lịch chọn ngày.
     - Máy bán hàng.
4. **Ô nhập.** Luật của từng ô không đổi, chỉ đổi chỗ đặt ô. Lỗi khi Lưu vẫn bật khung báo lỗi như hiện nay.
5. **Dữ liệu.** Không đổi bảng nào, không có migration, không đổi server action.

Câu thêm cho việc này:
- **Đang gõ dở mà rời trang thì sao?** Mất, giống hiện nay khi đóng khung. Riêng phiếu nhập khi bấm "+ Nhà cung cấp mới" thì được giữ (xem mục 5).
- **Có gì mới mà trước đây không có?** Mỗi form có một địa chỉ riêng: gửi địa chỉ đó cho người khác thì họ mở được đúng form ấy.

## 2. Khuôn trang form

- Hai địa chỉ: `…/new` và `…/[id]/edit`. Đầu trang có `BackLink`. Nội dung trang là chính form cũ, gỡ ra khỏi `FormModal` hoặc `ModalPortal`.
- Lưu xong thì `router.push` về danh sách, kèm bộ lọc cũ (cùng cách các nút quay lại đang giữ bộ lọc).
- Mỗi trang mới phải có lối vào: nút trên danh sách. Phép kiểm menu không đòi trang `new` hay `edit` nằm trên menu; nếu nó đòi thì sửa danh sách cho phép, không thêm vào menu.
- Đợt cuối:
  - `app/admin/no-popups.test.ts` thành phép kiểm thật: quét `app/admin`, thấy `FormModal` hoặc `ModalPortal` là đỏ.
  - `FormModal` và `ModalPortal` vẫn giữ trong `components/ui`, vì `DeleteConfirmModal` và máy bán hàng còn dùng.

## 3. Ví dụ: Nhà cung cấp

- Hiện nay: bấm "Thêm nhà cung cấp" thì một khung che danh sách.
- Sau việc này:
  - Bấm "Thêm nhà cung cấp" thì sang trang `/admin/suppliers/new`, đầu trang có "← Nhà cung cấp". Lưu xong thì quay về danh sách.
  - Bấm "Sửa" trên dòng ABC thì sang `/admin/suppliers/<mã>/edit`.
  - Bấm "Xoá" thì vẫn bật khung "Xác nhận xoá" như hiện nay.

## 4. Chia đợt

Mỗi đợt làm trên một nhánh, có một kế hoạch, và chủ quán duyệt một lần.

1. **Nhà cung cấp** (làm mẫu).
2. **Thu chi**: sổ thu chi, nhóm thu chi, tài khoản ngân hàng.
3. **Kho**: mặt hàng (form và lịch sử giá nhập), nhóm hàng, đơn vị, quy đổi.
4. **Tài sản**: khung giá trị, thanh lý.
5. **Món**: món, lịch sử giá, nhóm món, tuỳ chọn.
6. **Khuyến mãi, thương hiệu, điểm bán, nhân viên.**
7. **Phiếu nhập**: thêm nhà cung cấp nhanh theo cách B ở mục 5. Sau đợt này, bật phép kiểm canh.

## 5. Thêm nhà cung cấp trong lúc nhập phiếu nhập

Chủ quán chọn cách B (2026-10-01). Hai cách không chọn:
- A: giữ khung, coi là ngoại lệ.
- C: bỏ nút thêm nhanh. Lúc hỏi, Opus khuyên cách này vì tháng 9 không ai tạo nhà cung cấp mới.

Cách làm:
- **Trước khi rời phiếu:** máy lưu bản nháp phiếu (nhà cung cấp, ngày, mọi dòng) vào bộ nhớ trình duyệt trên máy đó.
- **Chuyển trang:** sang `/admin/suppliers/new?from=po`. Nếu đang sửa một phiếu cũ thì thêm mã phiếu vào địa chỉ.
- **Quay về phiếu:**
  - Bấm Lưu: nhà cung cấp vừa tạo được chọn sẵn, thay cho nhà cung cấp đã chọn trước đó nếu có. Chủ quán xác nhận: *"chỗ nhà cung cấp sẽ tự chọn nhà cung cấp vừa tạo"*.
  - Bấm Bỏ: quay về phiếu, không chọn thêm gì.
- **Khôi phục:** mở lại phiếu thì máy điền lại từ bản nháp, rồi xoá bản nháp.
- **Khi không khôi phục được:**
  - Bản nháp chỉ nằm trên máy đó. Đổi máy, hoặc trình duyệt chặn bộ nhớ, thì trang báo "Không khôi phục được phiếu đang nhập dở".
  - Bản nháp cũ hơn 1 ngày thì bỏ, không điền lại.

## 6. Phân công

- **Gemini** (bản mới nhất, mạnh nhất qua `agy`): toàn bộ, vì đây là việc giao diện.
- **Sonnet:** chỉ làm khi một đợt lộ ra việc phía máy chủ.
- **Opus:**
  - Viết kế hoạch cho từng đợt.
  - Chạy test trên bản cũ để chứng minh test đỏ trước khi sửa.
  - Soát lại.
