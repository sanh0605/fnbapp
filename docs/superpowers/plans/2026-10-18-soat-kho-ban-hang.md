# Soát Kho, Đơn hàng, Món — đợt sửa 2b

Dòng `6-giao-diện-toàn-bộ` của `docs/superpowers/plans/2026-10-06-ke-hoach-chung.md`, phần (1) và (2) cho Kho, Đơn hàng, Món. Sửa thứ đã có: thiết kế rút gọn nằm ngay trong kế hoạch này. Bản sửa sau phản biện Sonnet 2026-10-18.

Nguồn: ảnh chụp lại 2026-10-18 (`.worktrees/shots/audit3/`, 61 trang × 2 cỡ, máy 8386, dữ liệu thật, chặn mọi lệnh ghi). Hai người soát độc lập đối chiếu với đợt 2026-10-17: máy tính 16 lỗi hết, 63 còn, 22 mới; điện thoại 17 hết, 50 còn, 15 mới (`.worktrees/audit-recheck-2d.md` mã `d…`, `.worktrees/audit-recheck-2p.md` mã `p…`).

Đã xem: hai bảng soát, `docs/02-rules/business-rules/screens.md` (BR-UI-001, 009, 011), `data-integrity.md` (BR-DATA-006), `components/ui/list/FilterCard.tsx`, chỗ in tên người ghi (tra 2026-10-18), tên cỡ trong `product_variants` (đo 2026-10-18: "500ml" 20, "700ml" 19, "1 phần" 8, "360ml" 5, "1000ml" 3, "1 trái" 2). Chưa xem: phần dưới màn hình đầu của mỗi trang (ảnh chỉ chụp màn đầu), Thu chi, Báo cáo (đợt 1 đã soát).

## Không sửa, vì chủ quán đã chốt hoặc là dữ liệu

| Người soát ghi | Mã | Luật | Vì sao giữ |
|---|---|---|---|
| Ngày không có giờ hiện "00:00:00"; giờ có ":00" | d4, d7, d10, p10, mới | `BR-DATA-006` (2026-09-29) | Chủ quán chọn mọi ngày cùng một dạng `dd/mm/yyyy HH:mm:ss` |
| Tiêu đề cột bên trái, số bên phải | d22, d23, d32, d50, d67, mới | `BR-UI-011` (2026-10-10) | Chủ quán chọn |
| "Topping", "Voucher", "Voucher/Giảm giá" | d41, d45, d61 | `BR-UI-001` | Từ chủ quán tự dùng |
| "Size", "Size & giá" | d60, d61, d63, d65, d67, p65 | `BR-UI-001`, cùng lý do | Chủ quán tự viết "Chọn size, độ ngọt, đá và toppings" (2026-10-17) |
| "-- Chọn hàng --", "-- Chọn --", "-- Chọn nhóm --" | d25, d80, p16, p20, p65 | `BR-UI-009` mục "Not covered" | Ô chọn là chọn, không phải gõ |
| Món "Test11" | d65, p54 | chủ quán 2026-10-18 | Là dữ liệu |
| Biểu tượng chỉ có ở 3 nhóm món; "miếng", "g" chữ thường | d70, p57, d56, p45 | — | Là dữ liệu chủ quán gõ |
| Dòng quy đổi "g x1 g" ở trang Quy đổi | mới | — | Dòng dữ liệu thật; trang danh sách hiện đủ. Chỉ cột quy đổi ở danh sách Hàng hoá bỏ dòng tự quy đổi (K3) |
| Cột Ghi chú "—" mọi dòng ở Đơn vị | d55 | — | Cột của một trường có thật; trống thì "—" như mọi nơi |
| Dòng chính đơn hàng trên điện thoại là mã đơn | p47 | — | Mã đơn là thứ nhân viên đọc cho nhau; phần cắt "08:41:00 · …" sửa ở C1 |
| Nút "Chọn" cạnh ô sắp xếp | p11 | — | Là nút chọn nhiều dòng, việc khác với lọc |
| "Lý do huỷ" bắt đầu ở mép màn đầu | d44 | — | Trang cuộn được, ô có nhãn |

## Hiện trạng

1. **Trạng thái:** không thêm trạng thái nào; chỉ đổi cách hiện. "Bán độc lập" ở trang xem tuỳ chọn đang trông như công tắc bấm được dù chỉ để xem: đổi thành chữ "Có" / "Không" (d77).
2. **Nút:**
   - "Sửa đơn" ở trang đơn hàng mở trang tên "Đổi cách trả": nút đổi tên thành "Đổi cách trả".
   - Trang xem dùng "Chỉnh sửa" (đo 2026-10-18: đa số trang xem đã dùng); "Sửa" ở loại món, nhóm tuỳ chọn, khung khấu hao đổi theo (d11, d81, p59, p66).
   - "Ngừng dùng" và "Xoá" ở mọi trang xem dùng cùng kiểu nút nguy hiểm của `Button` (d31, d73, p26, p59, p66).
   - Phiếu nhập: "Huỷ phiếu" màu đỏ ra cuối hàng nút, sau "Nhân bản" (d42, p33).
   - Lời nhắc ở trang sửa tuỳ chọn nhắc "Cập nhật", "Bỏ" không có thật: sửa theo nút thật "Lưu thay đổi", "Bỏ thay đổi" (d78).
3. **Danh sách:** không đổi cái gì vào hay ra. Đổi cách hiện:
   - Mã, trạng thái, ngày giờ, phân loại không xuống dòng khi cột tên còn chỗ.
   - Nhãn dòng tổng không xuống dòng.
   - Trên điện thoại, dòng thứ hai của `PhoneRow` được hai dòng thay vì bị cắt "…".
   - Phiếu xuất bỏ nhãn "Phiếu xuất" ở mọi dòng; chỉ phiếu đã huỷ mang nhãn "Đã huỷ" (d21, p18).
   - Đơn vị: "Tên tăng dần" xếp đúng theo chữ cái tiếng Việt, không phân biệt hoa thường (p44, d56).
   - Phiếu nhập trên điện thoại hiện đủ năm: "16/10/2026 13:00:00" (p30, `BR-DATA-006`).
4. **Ô nhập:** không đổi khoảng nhận. Chỉ đổi chữ mẫu:
   - "Ví dụ: gram, hộp" thành "Ví dụ: g, hộp".
   - Chữ mẫu "Nguồn nhập hàng" ngắn lại để ô không cao gấp đôi ô bên cạnh.
   - "INV-20231201" thành ví dụ thật ("Ví dụ: HD0012345").
   - "Ví dụ: Thùng 24 lon" cùng màu xám như chữ mẫu khác (d18).
   - "Tên nhóm món" có dấu sao bắt buộc (p58).
   - Ô "Là thức uống" to bằng các ô đánh dấu khác, vùng bấm 48 px (p67).
   - Tuỳ chọn: ô "Tên tuỳ chọn" đứng trước "Giá thêm" (p64).
5. **Loại dữ liệu:** chỉ phần hiển thị của Kho, Đơn hàng, Món, cộng tên nhân viên ở mọi chỗ đang in tên đăng nhập. Cố ý không đụng:
   - Cách tính tiền, tồn kho, giá vốn.
   - Dữ liệu đã lưu: `created_by_name` giữ nguyên tên đăng nhập, chỉ đổi lúc hiện; `resolveActor` không đổi.

Câu hỏi riêng của đợt này:

6. **Tên nhân viên lấy ở đâu, đổi tên thì sao?**
   - Bảng `users` đã có cột `name`, cho phép trống (đo 2026-10-18: `tuyen2612` → "Tài Chí Tuyền", `admin` → "ADMIN").
   - Lúc hiện, tra theo `created_by_id` trước, rồi theo tên đăng nhập; không thấy hoặc `name` trống thì hiện nguyên chữ đã lưu.
   - Đây là **tính lại theo bảng**: sửa tên nhân viên thì mọi phiếu cũ hiện tên mới.
   - Ô lọc "Nhân viên" ở Doanh số: giá trị là tên đăng nhập, chữ hiện là tên nhân viên.
   - Hiện đang hỏng: `SalesFilter.tsx:171` gửi `u.name || u.username` trong khi phép lọc so với tên đăng nhập (`report-helpers.ts:33,55`, `pnl-actions.ts:103`), nên chọn một người có tên là lọc ra 0 đơn. Sửa trong B1, kèm test.
7. **Chủ quán sửa tên nhân viên ở đâu?**
   - Form Nhân sự thêm ô "Tên nhân viên": bắt buộc khi tạo mới, tối đa 60 ký tự.
   - Khi sửa: ô điền sẵn tên đã lưu; nếu trống thì điền sẵn tên đăng nhập.
   - Danh sách và trang xem Nhân sự hiện cột tên.
   - Luật chủ quán 2026-09-28: thứ có thể muốn đổi phải tự sửa được.
8. **Nút "Góp ý" che chữ:**
   - Nút này chỉ có ở máy xem thử, không có trên trang thật (`app/layout.tsx:48`).
   - Dời nút lên giữa mép phải bằng một lớp vị trí, khung mở ra giữ nguyên.
9. **Trang đếm kiểm kê đổi bố cục điện thoại có làm hỏng phiên đang đếm không?**
   - Trên máy này: không, vì chỉ đổi cách hiện.
   - Lúc đẩy lên: tra máy chủ còn phiên kiểm kê chưa xác nhận không; còn thì báo chủ quán trước khi đẩy.

## Ví dụ cụ thể

- Phiếu xuất ISL-00040 (01/09/2026), cột "Người ghi" ở danh sách: trước "tuyen2612", sau "Tài Chí Tuyền".
- Doanh số, ô lọc "Nhân viên":
  - Hiện: chọn "Tài Chí Tuyền" thì lọc theo chữ "Tài Chí Tuyền" và ra 0 đơn.
  - Sau sửa: lọc theo `tuyen2612` và ra đủ đơn của người đó.
- Trang xem hàng hoá Sữa đặc, dòng quy đổi: trước "Hệ số 1000", sau "Hệ số 1,000".
- Trang xem món: dòng giá "10,000" thành "10,000đ".
- Đơn hàng 261017001027, trang Đổi cách trả: "Khách trả 20,000" thành "Khách trả 20,000đ".

## Phiếu giao việc

Mỗi phiếu một worktree trong `.worktrees/`. Phiếu không chung file với nhau. G1, G2, G3 không sửa file `*actions*.ts` (của B1). S4 chạy sau khi gộp B1.

### B1 — Tên nhân viên (backend-coder, Sonnet)

- **Hàm đọc chung trong `lib/auth/`:**
  - Trả bảng tra id → tên và tên đăng nhập → tên.
  - Đọc bảng `users` một lần mỗi lượt tải trang.
  - Không thấy, hoặc `name` trống: trả nguyên chữ đã lưu.
- **Nhân sự:**
  - `types/db.ts:180`: `DBUser` thêm `name`.
  - `app/admin/users/actions.ts`: `toClientUser` (dòng 21) trả `name`.
  - Tạo mới bắt buộc tên; cắt khoảng trắng, tối đa 60 ký tự, lời từ chối tiếng Việt.
- **Chỗ hiện tên, đổi qua hàm trên** (code server hoặc trang nạp dữ liệu; phần chữ trong component giao diện chỉ đổi trường đọc):
  - Phiếu xuất: `lib/stock/issue-slip-list.ts`, `lib/stock/issue-slip-detail.ts`. Bộ lọc người ghi ở `issue-slip-list.ts:70,84` tra tên trước khi lọc ở cả hai chỗ.
  - Kiểm kê: `app/admin/inventory/stocktake/actions.ts:287`, nơi nạp `StocktakeCountView.tsx:402`, `cancel/page.tsx:49`, `CancelStocktakeForm.tsx:198`, `StocktakeDetailView.tsx:115`.
  - Đơn hàng: `OrderDetailView.tsx:201,267,293`.
  - Phiếu nhập: `app/admin/inventory/purchase-orders/[id]/page.tsx:179`.
  - Thu chi: `lib/finance/cash-book-rows.ts:109,128` (ô tìm `CashBookClient.tsx:352` tìm được cả tên lẫn tên đăng nhập), `CashEntryDetailView.tsx:104`, `CashTransferDetailView.tsx:101`.
  - Nhật ký: `ActivityLogClient.tsx:362`.
  - Tên người đang đăng nhập: `AdminSidebar.tsx:170`, `MoreSheet.tsx:166`.
  - Doanh số: `SalesFilter.tsx:171` đổi `value={u.username}`, chữ hiện là tên.
- **Không đổi:** `resolveActor`, `actor.name`, `auth.ts:143`, `lib/finance/audit-columns.ts` (chỉ ghi). Không ghi vào dữ liệu thật.
- **Test trước:**
  - Tra "tuyen2612" ra "Tài Chí Tuyền"; tên không có trong bảng hiện nguyên chữ.
  - Danh sách phiếu xuất trả tên nhân viên; lọc người ghi theo tên vẫn ra phiếu.
  - Doanh số lọc theo tên đăng nhập ra đúng đơn.

### G1 — Kho (Gemini Flash)

Chỉ `app/admin/inventory/**`, trừ `*actions*.ts`.

- **K1 Phiếu xuất:**
  - Tạo mới: chữ mẫu ô số lượng "Ví dụ: 1,250.5" vừa ô (p21); nút chính không xuống dòng ("Ghi phiếu xuất (1 dòng)" vừa một dòng ở 360 px).
  - Danh sách: bỏ nhãn "Phiếu xuất" ở dòng thường.
  - Trang huỷ: khung phải không hẹp, hai nút cạnh nhau (d23); dòng đầu không gãy giữa "Người ghi:" và tên (mới).
- **K2 Phiếu nhập:**
  - Tạo mới: chữ mẫu "Nguồn nhập hàng" ngắn (một dòng); "INV-" thành "Ví dụ: HD0012345".
  - Danh sách:
    - Tiêu đề cột "Nhà cung cấp", "Nguồn mua", "Hình thức thanh toán" và giá trị "Mua ngoài" không xuống dòng; có dòng nhỏ "KHO" trên tiêu đề như danh sách khác (d37, d40, p31).
    - Điện thoại: ngày có năm; dòng hai không cắt mã phiếu; "Không rõ" (thiếu nhà cung cấp) thay bằng nguồn mua (p29).
  - Trang xem:
    - Tiêu đề "Phiếu nhập PO-207", mã không gãy; bỏ vạch kẻ trống trên "Hình thức thanh toán".
    - "Ngày tạo" và "Ngày giao dịch" mỗi thứ một dòng (p34); "Huỷ phiếu" ra cuối hàng nút.
  - Trang huỷ: "0đ" không tô đỏ; dòng hàng viết "5 kg × 15,000đ" như trang xem (p35).
- **K3 Quy đổi, Hàng hoá:**
  - Hệ số qua `formatNumber` ("1,000"), chữ thường không đơn cách (d15).
  - Một tên cho một khái niệm: cột và trang xem "Hệ số", ô nhập "Hệ số quy đổi" (d16).
  - Danh sách Hàng hoá:
    - Không hiện dòng tự quy đổi "1 g = 1 g"; không có quy đổi nào khác thì hiện "—".
    - "SPM-151", "Không theo dõi tồn" không xuống dòng.
    - Điện thoại viết "Không theo dõi" cho gọn (p25).
  - Trang tạo Phân loại: tên nhóm cha dài không bị cắt (p12).
  - Quy đổi: lọc gập như các danh sách khác (xem C6).
- **K4 Tồn kho, Kiểm kê:**
  - "Phân loại hàng" và "Chưa kiểm lần nào" không xuống dòng.
  - Trang đếm, máy tính: cột "Số đếm" không rộng 340 px cho ô 110 px; "Sổ lúc đếm", "Chênh lệch", "Trạng thái" không xuống dòng.
  - Trang đếm, điện thoại: mỗi hàng là một dòng gọn hai tầng (tên + ô đếm một hàng, "Sổ sách …" dòng dưới), thay thẻ ~190 px (`BR-UI-018`).
  - Chip "Chưa đếm" khác màu nút "Xem trước"; ô tìm có nhãn.
  - Danh sách kiểm kê: "STK-002" chữ thường; ngày giờ không gãy hai dòng (p40).
  - Tồn kho: lọc gập (C6).
  - Giữ xanh toàn bộ `StocktakeCountView.test.tsx`. Thêm test: ô đếm vẫn tự lưu (`BR-INV-023`), cao ≥ 48 px, `inputMode` số.
- **K5 Tài sản, Thời hạn khấu hao, Đơn vị:**
  - Nhãn tổng không xuống dòng; "Còn / Đã mua", "Đã thanh lý", "30 / 30 cái" không xuống dòng (d3, d5).
  - Trang thanh lý:
    - Dòng "Mua … · còn 2" bỏ "· còn 2" vì dòng dưới đã ghi "Còn lại: 2 cái" (d10).
    - Hộp hồng không bị thanh nút che đáy (d8).
  - Khung khấu hao:
    - Sửa chú thích "khi lưu -- tài sản", không lặp phụ đề (d2).
    - Trang xem: Ghi chú không hiện lời nhắc của trang (p4).
    - Form trên điện thoại: bỏ lớp thẻ trong (p6).
  - Đơn vị: chữ mẫu "Ví dụ: g, hộp"; xếp tên đúng chữ cái (`localeCompare` tiếng Việt, không phân biệt hoa thường).
- **K6 Hàng hoá xem, sửa:**
  - Banner "Đây là nhóm Hàng hoá chế biến." chỉ hiện khi đúng nhóm đó (d35, p28).
  - Trên điện thoại, "Quy đổi đơn vị mua" và "+ Thêm đơn vị mua" không xuống dòng.
- **K7 Trang xem trong Kho** (tài sản, quy đổi, hàng hoá, khung khấu hao, phân loại):
  - Bỏ dòng "Mã", "Tên" lặp lại đúng tiêu đề và dòng mã ngay trên.
  - "Chỉnh sửa", "Ngừng dùng", "Xoá" theo mục Hiện trạng 2.
- **K8 Kho mở trang "Tồn kho"** thay "Phân loại hàng" (d1, p2); menu tô đúng mục.

### G2 — Đơn hàng và Món (Gemini Flash)

Chỉ `app/admin/orders/**`, `app/admin/products/**`, trừ `*actions*.ts`.

- **S1 Đơn hàng:**
  - Danh sách: ngày giờ không xuống dòng; nhãn tổng một dòng.
  - Trang xem:
    - Nút "Đổi cách trả".
    - Cột "Tuỳ chọn", "Giảm" ẩn khi mọi dòng trống (d60).
  - Đổi cách trả:
    - Tiền có "đ"; "20,000" dưới ô chọn có nhãn; "(bắt buộc)" thành dấu sao như form khác (d61, d62).
    - "Thêm cách trả" cùng cỡ chữ; ô lý do có nhãn.
  - Huỷ đơn:
    - Tiền có "đ"; "Thông tin đơn hàng" và ngày tách nhau (p51).
    - Hai nút cạnh nhau trên điện thoại (p52).
- **S2 Món:**
  - Giá ở trang xem, lịch sử giá, trang xem tuỳ chọn có "đ" (mới, p62).
  - "PROD-049" không xuống dòng; tên dài không gãy khi cột còn chỗ.
  - Dòng nhỏ trên tiêu đề danh sách "BÁN HÀNG" như Đơn hàng (d65).
  - Trang xem món: "Đã bán: Đã có đơn" thành "Đã bán: Có".
  - Form món:
    - Ô "Tên size" thẳng hàng với "Giá bán".
    - Trên điện thoại bỏ lớp thẻ trong (p55); "Các size" và "+ Thêm size" không xuống dòng.
  - Lịch sử giá: ngày cùng kiểu chữ như nơi khác (mới).
- **S3 Tuỳ chọn, nhóm tuỳ chọn, loại món, nhóm món:**
  - Trang xem tuỳ chọn: "Bán độc lập" là chữ "Có" / "Không".
  - Trang sửa tuỳ chọn: lời nhắc theo nút thật; "Tên tuỳ chọn" trước "Giá thêm".
  - Nhóm tuỳ chọn:
    - Danh sách: tiêu đề cột không xếp 3 dòng; "Đang dùng", "35 món", "Thêm Topping" không xuống dòng (d72).
    - Trang xem có dòng mã dưới tiêu đề như trang khác.
    - Form: ô đánh dấu nằm ngang dòng đầu của nhãn (p60).
  - Trang tạo tuỳ chọn, loại món có dòng phụ đề như trang tạo ở Kho.
  - Nhóm món: "Tên nhóm món" có sao; cột "Số món" như cột số khác.
  - Loại món: ô "Là thức uống" 24 px, vùng bấm 48 px.
  - Danh sách tuỳ chọn, nhóm tuỳ chọn, loại món, nhóm món: lọc gập (C6).
  - Trang xem: "Chỉnh sửa", "Ngừng dùng", "Xoá" theo mục Hiện trạng 2; bỏ dòng "Mã", "Tên" lặp tiêu đề.
- **S4 Nhân sự** (`app/admin/users/**` trừ `actions.ts`; chạy sau khi gộp B1):
  - Ô "Tên nhân viên" trên form tạo, sửa (theo Hiện trạng 7).
  - Danh sách và trang xem hiện tên.

### G3 — Phần dùng chung (Gemini Flash)

Chỉ `components/ui/**`, `components/dev-feedback/UiFeedbackTool.tsx`, `app/admin/components/**` trừ hai dòng tên ở `AdminSidebar.tsx:170`, `MoreSheet.tsx:166` (của B1).

- **C1 `PhoneRow`:**
  - Dòng thứ hai được hai dòng (`line-clamp-2`), không cắt một dòng.
  - Sửa `PhoneRow.test.tsx:31-32, 49-50` (đang đòi `truncate`) theo hành vi mới.
- **C2 `DataList`:**
  - Nhãn dòng tổng không xuống dòng trên máy tính.
  - Ô lọc lẻ không rơi một mình xuống hàng hai (d19, mới).
  - Ô sắp xếp dùng `Select` chung thay ô gốc của trình duyệt (p16).
- **C3 `PageHeader` trên điện thoại:**
  - Tiêu đề và nút không vỡ chữ ("Hàng / hoá", "Kiểm / kê", "Thời hạn / khấu hao").
  - Nút xuống hàng dưới tiêu đề nếu không vừa.
- **C4 "Góp ý":** một lớp vị trí, nút ở giữa mép phải.
- **C5 `FormActionBar`:** form ngắn (Phiếu xuất tạo mới, Đổi cách trả) cũng có thanh nút sát đáy, không trôi giữa trang (mới).
- **C6 `FilterCard`:**
  - Mọi danh sách có lọc dùng một kiểu trên điện thoại: ô tìm + nút "Bộ lọc" gập (p8).
  - G3 không sửa trang. Nếu `FilterCard` cần trang truyền `search`/`activeCount`, G1 và G2 truyền cho các danh sách đang hiện "Lọc" ở dưới: Quy đổi, Tồn kho, nhóm món, tuỳ chọn, nhóm tuỳ chọn, loại món.
- **C7 Menu:** trang Quy đổi tô mục "Hàng hoá" và mở nhóm Kho (d13, d17).

## Kiểm

- **Mỗi phiếu:**
  - `npx tsc --noEmit` và test vùng của nó.
  - Test mới đỏ trên bản chưa sửa.
  - Guard `phone-size` (48 px), `placeholder`, `list-rows`, `phone-rows` xanh.
- **Gộp:** từng phiếu vào main; soát độc lập (Opus `reviewer`) mỗi phiếu.
- **Sau khi gộp hết:**
  - Năm lệnh kiểm ở main (build lúc 8386 tắt).
  - Playwright chụp lại 61 trang × 2 cỡ (`.worktrees/audit3.js`), có cuộn xuống chụp cả phần dưới. Mở từng ảnh, báo bằng bảng bước | mong đợi | thực tế | ảnh | đạt.
  - Mọi lỗi còn lại sửa tiếp trong cùng đợt.

## Review focus

- Tên nhân viên:
  - Phiếu của một người đã bị xoá khỏi `users`, hoặc `name` trống, vẫn hiện chữ đã lưu, không trống.
  - Lọc người ghi và lọc Doanh số vẫn ra đúng phiếu.
- Đổi chữ mẫu không làm hỏng test đang tìm chữ cũ: test sửa theo chữ mới, không bỏ.
- Trang đếm kiểm kê trên điện thoại: ô đếm vẫn tự lưu, ≥ 48 px, `inputMode` số; ~1.300 dòng test cũ xanh.
- `PhoneRow` hai dòng không làm dòng nào cao hơn ~72 px.
- Thẻ "Góp ý" không che thanh nút cuối form hay menu đáy điện thoại.
