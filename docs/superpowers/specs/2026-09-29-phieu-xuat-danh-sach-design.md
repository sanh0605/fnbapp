# Bước 4a — Phiếu xuất theo khuôn chung: thiết kế

Chủ quán chọn làm Phiếu xuất trước trong bước 4 (2026-09-29). Nguồn:
- Biên bản cải tổ: `docs/superpowers/specs/2026-09-28-cai-to-he-thong.md`, mục 6, dòng bước 4.
- Khuôn danh sách: `docs/superpowers/specs/2026-09-29-menu-va-khuon-trang-design.md`, mục 3.5.
- Luật: `BR-INV-013` (xoá dòng, chỉnh sửa, chặn trước kiểm kê), `BR-INV-012` (dòng "Kiểm kê" trong danh sách), `BR-INV-009` (cách trả hàng về kho), `BR-DATA-006` (ngày giờ).

## 0. Chủ quán đã chốt (2026-09-29)

| Câu | Chốt |
|---|---|
| Bấm "Phiếu xuất" trên menu mở ra đâu | Danh sách, nút "Tạo phiếu xuất" to ở trên cùng, như Phiếu nhập |
| "Xoá" một dòng nghĩa là gì | Trả hàng về kho ngày bấm; dòng biến khỏi phiếu (`BR-INV-013`). Chủ quán chọn cách 2 (xoá thật) trước, rồi đổi sang cách này |
| Ai sửa, xoá được | Chủ quán và quản lý, như hiện nay |
| Phiếu nằm trước lần kiểm kê gần nhất | Không sửa, không huỷ được |
| "Chỉnh sửa" làm được gì | Xoá dòng, sửa số lượng, thêm dòng |
| Nút "Huỷ phiếu" | Giữ. Xoá hết dòng thì phiếu hỏi có huỷ không; không huỷ thì phải có ít nhất 1 dòng mới lưu |
| Lý do huỷ phiếu | Vẫn bắt buộc |
| Danh sách lý do (đang viết cứng 3 lý do) | Để bước sau; ghi vào việc chưa xong. Không có ô lọc theo lý do |
| Cột Giá trị | Có |
| Ô lọc Loại (Tất cả, Phiếu xuất, Kiểm kê, Đã huỷ) | Có |
| Phiếu đã huỷ trong danh sách | Ẩn khi lọc "Tất cả"; chỉ hiện khi chọn Loại = "Đã huỷ" (chủ quán 2026-09-29, sau khi xem bản mẫu) |
| Ô lọc Người ghi | Có |
| Cột mặt hàng trên danh sách | Không. Ô tìm vẫn tìm theo tên mặt hàng |

Opus tự quyết (chủ quán không đồng ý thì sửa): xoá từng dòng trong lúc chỉnh sửa không bắt gõ lý do. Máy tự ghi chú "Sửa phiếu ISL-…".

## 1. Hiện trạng

1. **Trạng thái.**
   - Phiếu xuất chỉ có một trạng thái: đã ghi.
   - Một dòng có thể đã bị đảo: có dòng khác trỏ về nó qua `reverses_issue_id`.
   - Sau bước này, nhìn từ màn hình, một phiếu mang một trong hai trạng thái:
     - **Còn hiệu lực:** còn ít nhất 1 dòng chưa bị trả về kho.
     - **Đã huỷ:** mọi dòng đã được trả về kho. Mặc định ẩn khỏi danh sách; chọn Loại = "Đã huỷ" mới thấy, có nhãn "Đã huỷ".
   - Một lần kiểm kê hiện trong danh sách khi nó ở trạng thái `CONFIRMED`.
2. **Nút.**
   - Danh sách có "Tạo phiếu xuất", "Lọc", "Xoá lọc".
   - Chi tiết phiếu có "Chỉnh sửa" và "Huỷ phiếu". Cả hai ẩn khi phiếu đã huỷ, hoặc khi ngày xuất nằm vào hoặc trước ngày xác nhận của lần kiểm kê gần nhất; khi đó hiện một câu giải thích thay cho nút.
   - Trong chế độ chỉnh sửa có "Xoá dòng đã chọn", "Thêm dòng", "Lưu", "Bỏ".
3. **Danh sách.**
   - Chứa mọi phiếu xuất tay (`issue_slips`) còn hiệu lực. Phiếu đã huỷ chỉ hiện khi lọc Loại = "Đã huỷ".
   - Chứa thêm mỗi lần kiểm kê đã xác nhận thành một dòng "Kiểm kê" (`BR-INV-012`), giá trị là số tiền hao hụt của lần đó.
   - Dòng trả hàng về kho (`reverses_issue_id` khác rỗng) không hiện thành phiếu riêng.
   - Mỗi trang 20 dòng. Thứ tự: ngày xuất mới nhất ở trên; cùng ngày giờ thì dòng tạo sau đứng trên.
4. **Ô nhập.**
   - Ô tìm nhận chữ bất kỳ, tìm trong mã phiếu và tên mặt hàng.
   - Hai ô ngày theo `BR-DATA-006`, giống Phiếu nhập: ngày sai báo "Ngày không hợp lệ"; từ ngày sau đến ngày thì báo lỗi và không lọc.
   - Ô số lượng lúc chỉnh sửa phải lớn hơn 0, và không được xuất quá số đang có trong kho tính tới ngày của phiếu. Máy chủ quyết định chuyện này, như lúc tạo phiếu.
   - Lý do huỷ phiếu: bắt buộc, không được để trống.
5. **Phục vụ dữ liệu nào.**
   - Phục vụ phiếu xuất tay và dòng hao hụt của kiểm kê.
   - Cố ý không phục vụ: đơn bán (bán hàng không trừ kho từ 2026-08-07), và hàng thiết bị (ra khỏi quán qua Sổ tài sản).

Đã xem:
- `app/admin/inventory/issue-slips/` (trang, actions, `IssueSlipClient.tsx` phần lý do).
- `lib/stock/manual-issue-transaction.ts` (qua actions).
- Migration `0058`, `0062`.
- `BR-INV-009`, `BR-INV-012`, `BR-COGS-007`.
- Dữ liệu thật, đếm ngày 2026-09-29.

Chưa xem:
- Nội bộ `lib/costing/issue-costing.ts`: giá trị từng dòng sẽ lấy thế nào.
- Chi tiết `IssueSlipClient.tsx` ngoài phần lý do.
- Trang kiểm kê khi có hơn một lần kiểm kê đã xác nhận.

## 2. Số đo (2026-09-29)

- 78 phiếu xuất tay; theo tháng: 1 phiếu tháng 7, 38 phiếu tháng 8, 39 phiếu tháng 9. tuyen2612 ghi 57 phiếu, admin ghi 21 phiếu.
- Lý do ghi trên phiếu: 72 phiếu "Khác", 6 phiếu "Hao hụt / hư hỏng", 0 phiếu "Dùng nội bộ".
- `stock_issues`: 198 dòng, gồm 149 dòng xuất tay và 49 dòng kiểm kê.
  - 4 dòng xuất tay không có phiếu, cả 4 đều là dòng trả hàng về kho (ISS-00121, ISS-00122, ISS-00135, ISS-00141).
- 1 lần kiểm kê đã xác nhận: STK-001, 09/08/2026 22:02 giờ Việt Nam. Chỉ ISL-00041 (tháng 7) nằm trước lần này.
- Phiếu nhiều dòng nhất có 16 dòng (ISL-00075).

## 3. Trang danh sách — `/admin/inventory/issue-slips`

Khuôn giống hệt Phiếu nhập (spec 2026-09-29, mục 3.5), trừ những chỗ dưới đây.

- **Đầu trang:** chữ nhỏ "Kho", tên trang "Phiếu xuất", nút "Tạo phiếu xuất" bên phải (trên điện thoại chiếm hết bề ngang).
- **Thanh lọc:**
  - Tìm: mã phiếu, tên mặt hàng.
  - Loại: Tất cả, Phiếu xuất, Kiểm kê, Đã huỷ. "Tất cả" không gồm phiếu đã huỷ.
  - Người ghi: Tất cả, cộng với mọi người từng ghi phiếu, lấy từ dữ liệu.
  - Từ ngày, Đến ngày.
  - Có nút Lọc và Xoá lọc; Enter cũng lọc.
- **Bảng trên máy tính:** Mã phiếu · Ngày xuất · Loại · Người ghi · Giá trị (canh phải).
  - Loại là nhãn: "Phiếu xuất" kèm lý do, ví dụ "Khác"; hoặc "Kiểm kê"; hoặc "Đã huỷ".
  - Bấm bất kỳ đâu trên dòng là mở ra.
- **Thẻ trên điện thoại:**
  - Dòng 1: mã phiếu và giá trị.
  - Dòng 2: ngày giờ · người ghi, và nhãn loại.
- **Chân bảng:** "1–20 trên 75 phiếu" (ví dụ đo sáng 2026-09-29: 74 phiếu còn hiệu lực và 1 lần kiểm kê; 4 phiếu đã huỷ ẩn), có nút trước, sau và số trang.
- **Dòng Kiểm kê:**
  - Mã là mã lần kiểm kê (STK-001), người ghi là người xác nhận, ngày là ngày xác nhận.
  - Bấm vào mở `/admin/inventory/stocktake`.
  - Không sinh phiếu ISL riêng cho phần thiếu; dòng STK chính là phần thiếu. Chỉ biến mất khi lần kiểm kê được hoàn tác (chủ quán 2026-09-29, "1A").
  - Lần kiểm kê chỉ có hàng thừa, không thiếu món nào: không hiện trong danh sách ("2A").
  - Lần kiểm kê vừa thiếu vừa thừa: giá trị chỉ là tiền phần thiếu, không trừ phần thừa ("3A").
- **Giá trị** của phiếu là tổng giá trị các dòng còn hiệu lực, mỗi dòng tính theo giá vốn lúc xuất, cùng cách tính với báo cáo "Hàng đã xuất". Phiếu đã huỷ hiện 0đ.

Ví dụ trang 1 (năm dòng đầu, số ngày 2026-09-29; cột giá trị sẽ đo trong kế hoạch):

| Mã | Ngày xuất | Loại | Người ghi | Số dòng |
|---|---|---|---|---|
| ISL-00077 | 29/09/2026 10:22:00 | Phiếu xuất · Khác | tuyen2612 | 1 (Sữa đặc La rosee 1000 g) |
| ISL-00076 | 28/09/2026 18:20:00 | Phiếu xuất · Khác | tuyen2612 | 7 |
| ISL-00078 | 27/09/2026 10:22:00 | Phiếu xuất · Khác | tuyen2612 | 1 (Sữa chua không đường Vinamilk 5600 g) |
| ISL-00075 | 27/09/2026 10:13:00 | Phiếu xuất · Khác | tuyen2612 | 16 |
| ISL-00074 | 26/09/2026 10:16:00 | Phiếu xuất · Khác | tuyen2612 | 1 (Sữa tươi Mlekovita 1000 ml) |

Cột "Số dòng" ở đây chỉ để đối chiếu; trang thật không có cột này.

## 4. Trang chi tiết — `/admin/inventory/issue-slips/[id]`

- **Đầu trang:**
  - Mã phiếu, ngày xuất, lý do (kèm ghi chú nếu có), người ghi, tổng giá trị.
  - Nhãn "Đã huỷ" nếu phiếu đã huỷ, kèm lý do huỷ và ngày huỷ.
- **Bảng dòng:** Mặt hàng · Số lượng kèm đơn vị gốc · Giá trị. Trên điện thoại mỗi dòng là một thẻ.
- **Dòng đã trả về kho** không hiện, theo `BR-INV-013`.
- **Nút:** Chỉnh sửa, Huỷ phiếu, và nút quay lại danh sách đúng trang đang xem.
- **Phiếu nằm trước lần kiểm kê gần nhất:** không có hai nút sửa và huỷ. Thay bằng câu "Phiếu nằm trước lần kiểm kê ngày 09/08/2026 nên không sửa được. Sai lệch sẽ được bù ở lần kiểm kê sau."
- **Chế độ chỉnh sửa:**
  - Mỗi dòng có ô đánh dấu, cộng với một ô "chọn tất cả".
  - Có nút "Xoá dòng đã chọn". Dòng bị xoá mờ đi cho tới lúc bấm Lưu; bấm Bỏ thì hiện lại.
  - Mỗi dòng có ô **Đơn vị** và ô **Số lượng** theo đơn vị đó; cột **Quy ra** tự tính số lượng gốc = số lượng × hệ số của đơn vị (chủ quán 2026-09-29, góp ý trên bản mẫu). Ví dụ thật: Sữa yến mạch Oatside, quy cách Hộp = 1.000 ml; gõ 2 Hộp → Quy ra 2.000 ml.
    - Danh sách đơn vị lấy từ bảng quy đổi của mặt hàng (như trang tạo phiếu), cộng thêm đơn vị gốc lẻ (g, ml…) với hệ số 1 (chủ quán chốt 2026-09-29: "Có"). Trang tạo phiếu cũng thêm lựa chọn đơn vị lẻ này, để hai nơi giống nhau. Ví dụ: xuất nửa túi Bột cà phê truyền thống Phin Đậm (Túi 500 g) → chọn "g (lẻ)", gõ 250 → Quy ra 250 g.
    - Mặt hàng mà quy cách trùng đơn vị gốc (Giấy lót chống tràn: 1 Xấp = 1 Xấp) chỉ hiện một lựa chọn.
    - Dòng cũ mở ra với quy cách đầu tiên, số lượng = số gốc ÷ hệ số, có thể lẻ (454 g với Túi 454 g → 1 Túi).
    - Máy chỉ lưu số lượng gốc, như hiện nay; không lưu đơn vị đã chọn.
  - "Thêm dòng" dùng đúng ô chọn mặt hàng của trang tạo phiếu. Chỉ hiện hàng còn trong kho.
    - Lối thêm là một dòng chữ "+ Thêm dòng" nằm ở cuối bảng, bấm vào là có dòng mới ngay tại đó; không có nút thêm ở đầu bảng (chủ quán 2026-09-29, góp ý trên bản mẫu).
  - **Một ô nút chính ở góc dưới, đổi theo tình huống** (chủ quán 2026-09-29, góp ý trên bản mẫu):
    - Có ít nhất 1 dòng được tick → nút thành "Xoá N dòng đã chọn". Bấm là bỏ các dòng đó khỏi bản nháp, chưa ghi gì.
    - Không tick dòng nào, và chưa có gì khác bản gốc → "Lưu thay đổi" mờ, không bấm được.
    - Không tick dòng nào, và đã có thay đổi (xoá, sửa số lượng, thêm dòng có mặt hàng) → "Lưu thay đổi" bấm được.
    - Nút "Bỏ thay đổi" luôn ở cạnh.
  - **Lưu** ghi mọi thay đổi trong một lần, hoặc không ghi gì nếu có lỗi:
    - Mỗi dòng bị xoá tạo một dòng trả về kho, ngày hôm nay (`BR-INV-009`).
    - Sửa số lượng là trả dòng cũ về kho rồi ghi dòng mới, cả hai vào ngày của phiếu (chủ quán chọn "1", 2026-09-29, `BR-INV-013`; bản đầu ghi phần trả vào hôm nay).
    - Dòng thêm mới lấy ngày của phiếu.
  - Nếu sau khi xoá phiếu không còn dòng nào, máy hỏi "Phiếu không còn dòng nào. Huỷ phiếu này?":
    - **Có:** hỏi tiếp lý do huỷ (bắt buộc), rồi huỷ phiếu.
    - **Không:** quay lại chế độ chỉnh sửa; nút Lưu bị khoá cho tới khi có ít nhất 1 dòng.
- **Huỷ phiếu:** hỏi lý do (bắt buộc), rồi trả mọi dòng còn hiệu lực về kho hôm nay, như `cancel_issue_slip_atomic` đang làm.

Ví dụ: ISL-00076 (28/09/2026) có 7 dòng. Sửa phiếu, bỏ dòng Giấy lót chống tràn (1 cái) và đổi Sữa yến mạch Oatside từ 2000 ml thành 1000 ml, rồi Lưu vào ngày 30/09. Máy ghi:
- 30/09: trả về kho 1 cái Giấy lót chống tràn và 2000 ml Sữa yến mạch Oatside.
- 28/09: xuất 1000 ml Sữa yến mạch Oatside, ghi thêm vào ISL-00076.

Phiếu còn 6 dòng.

## 5. Trang tạo phiếu — `/admin/inventory/issue-slips/new`

- Giữ nguyên cách ghi đang có: ngày giờ, lý do, ghi chú, nhiều dòng.
- Ô quy cách thêm lựa chọn đơn vị gốc lẻ (g, ml…, hệ số 1), giống chế độ chỉnh sửa (chủ quán 2026-09-29). Máy vẫn chỉ gửi số lượng gốc, nên hàm ghi phiếu không đổi.
- Lưu xong thì mở trang chi tiết của phiếu vừa tạo.
- Danh sách "phiếu gần đây" dưới ô ghi hiện nay bị bỏ; trang danh sách thay nó.

## 6. Ảnh hưởng chéo

- **Thanh dưới đáy điện thoại:** nút "Phiếu xuất" vẫn trỏ `/admin/inventory/issue-slips`, giờ mở danh sách. Nhân viên ghi phiếu phải bấm thêm 1 lần, chủ quán đã biết cái giá này.
- **Báo cáo "Hàng đã xuất", báo cáo Lãi lỗ:** không đổi cách tính. Sửa phiếu thì dùng đúng cách trả hàng về kho sẵn có.
- **Hàm máy chủ mới** ghi một lần cả việc sửa phiếu: gồm trả về kho, ghi dòng mới, và kiểm chặn trước kiểm kê.
  - Đây là hàm mới trong migration, **không tạo bảng mới**.
  - Chặn trước kiểm kê phải đặt ở máy chủ, không chỉ giấu nút. Cả hàm đảo dòng (`0058`) và hàm huỷ phiếu (`0062`) cũng phải thêm phép chặn này.
- **Migration** lên cùng lúc với code đọc nó, chủ quán duyệt riêng.
- **Việc chưa xong mới:** danh sách lý do xuất do chủ quán tự quản (hiện đang viết cứng 3 lý do; 72 trên 78 phiếu chọn "Khác").

## 7. Ai làm

| Phần | Ai |
|---|---|
| Hàm máy chủ sửa phiếu, chặn trước kiểm kê, lấy một trang danh sách có giá trị, lấy một phiếu | Sonnet 5.5 |
| Trang danh sách, trang chi tiết và chế độ sửa, dời trang tạo phiếu | Gemini qua `agy --model gemini-3.1-pro-high` |
| Bản mẫu bấm thử, kế hoạch, soát, cửa kiểm | Opus |

Phần máy chủ làm trước, vì các trang cần nó.

## 8. Xong khi

- Chủ quán mở Phiếu xuất trên máy tính và điện thoại, lọc theo loại, theo người ghi và theo ngày, rồi mở một phiếu.
- Chủ quán sửa một phiếu thử: xoá một dòng, đổi một số lượng, thêm một dòng, lưu; rồi huỷ hẳn một phiếu thử.
- Mở ISL-00041 thì không thấy nút sửa.
- `npx vitest run`, `npm run build` xanh; `scripts/verify-cogs.ts` 0 lệch.
