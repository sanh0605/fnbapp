# Kế hoạch chung — mọi việc chưa làm, theo thứ tự

Chủ quán, 2026-10-06: *"Anh cần em tổng hợp tất cả những việc chưa làm và dự định sẽ làm
thành một kế hoạch chung rồi xoá các file dư thừa đi để không bị đọc nhầm file rồi bắt đầu
xử lý."*

**Đây là file duy nhất nói còn việc gì và làm theo thứ tự nào.** Kế hoạch con của từng phần
viết riêng khi bắt đầu phần đó, đặt cạnh file này, và **xoá khi phần đó xong** (git giữ lịch
sử). Xong một phần thì gạch nó ở đây trong cùng lần lưu. Việc đã chốt nằm ở
`docs/02-rules/business-rules/`; thiết kế còn dùng nằm ở `docs/superpowers/specs/`.

Đo ngày 2026-10-06, trên nhánh `feat/no-popups` (trùng `main` đã đẩy, `e85314c9`).

## Hiện trạng

1. **Trạng thái.** Mỗi phần dưới đây ở một trong ba trạng thái: chưa làm, đang làm, xong.
   Trạng thái ghi tay ngay trong file này, không có bảng dữ liệu nào.
2. **Nút.** Không áp dụng, vì file này không dựng màn hình; nút của từng trang ghi trong
   kế hoạch con của phần đó.
3. **Danh sách.** Gồm mọi việc chưa xong lấy từ: bản cải tổ
   `docs/superpowers/specs/2026-09-28-cai-to-he-thong.md` mục 6–7, khuôn trang
   `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md` mục 4,
   `docs/04-operations/OPEN-ITEMS.md`, `docs/02-rules/business-rules/unresolved.md`, lời chủ
   quán ngày 2026-10-06, và các lỗ hổng tìm thấy trong phiên 2026-10-05/06. Loại ra: việc đã
   có code chạy trên `main` (đã kiểm bằng git log và mã nguồn, không dựa vào checkbox).
4. **Ô nhập.** Không áp dụng, vì không có ô nhập.
5. **Dữ liệu.** Không áp dụng, vì file này không đọc hay ghi dữ liệu; phần nào đụng dữ liệu
   thật thì kế hoạch con của nó kèm ví dụ tính bằng số thật.

Đã xem: 44 kế hoạch và 14 bản thiết kế cũ (đã xoá 44 + 10, xem cuối file), `app/admin/nav-items.ts`,
danh sách 92 trang `page.tsx`, độ dài các file lớn. Chưa xem: từng trang ở cỡ 1024px trên
trình duyệt (làm ở mỗi đợt).

## Luật chung cho mọi phần giao diện (chủ quán, 2026-10-06)

*"Khi anh yêu cầu tạo lại trang hay điều chỉnh lại trang hoặc cụ thể một giao diện … thì em
đều phải làm luôn cả phần responsive."* Trang huỷ phiếu nhập bị chê *"rất trống rỗng và chưa
tối ưu được diện tích sử dụng"*.

- Mỗi phiếu giao việc giao diện ghi riêng bố cục máy tính (cái gì lấp bề ngang: bảng, cột,
  khối bên) và bố cục điện thoại; dùng lại mảnh chung trong `components/ui/`.
- Mở bằng mắt ở ba cỡ trước khi báo xong: 1568px (màn của chủ quán), 1024px (iPad ngang,
  laptop nhỏ), 390px (điện thoại). Đây là luật mục 7 của khuôn trang, áp dụng cho **mọi**
  trang, kể cả những trang khuôn trang từng để ngoài.

## Thứ tự

**Chủ quán chốt 2026-10-16:** *"ưu tiên làm 2 việc lớn cho xong"*. Hai việc đó là (1) số tiền thu khi thanh lý tài sản (mục 4) và (2) soát cấu trúc cơ sở dữ liệu (6d), làm song song. Ba việc **gác lại, không làm cho tới khi chủ quán yêu cầu lại**:
- bảng chữ viết tắt (mục 4);
- trả phiếu nhập bằng nhiều hình thức (mục 4);
- lộ trình dài hạn (mục 8: nhiều chi nhánh, bảo mật, nhượng quyền).

Kiểm tra toàn hệ thống bằng Playwright trên bản thật: chủ quán hoãn cùng ngày ("Tạm khoan").

Máy bán hàng (7) và các mảng Bán hàng, Kho, Thu chi, Báo cáo đã đẩy lên bản thật 2026-10-15 (`4b837522`); migration 0127–0130 đã chạy.

| # | Phần | Trạng thái |
|---|---|---|
| 0 | Sửa chỗ hỏng sau đợt K2–K6 và bộ lọc thời gian; đo tốc độ trước và sau; rồi tiêu đề cột đậm, căn trái (`BR-UI-011`); trang tạo/sửa hai cột cho Phiếu nhập, Phiếu xuất, Sửa đơn hàng — trước khi đẩy | **Xong**, đã đẩy 2026-10-15 (`feebd7ee`): khung chung tối đa 1.280 (`BR-UI-012`), tiêu đề cột đậm căn trái (`BR-UI-011`), tiêu đề trang tạo (`BR-UI-013`), ô và dòng gọn trên máy tính (`BR-UI-014`), form hai cột kể cả Món và Khuyến mãi (chủ quán chốt 2026-10-14) |
| 1 | Giao diện đồng nhất — đợt 8: Phiếu nhập, Phiếu xuất, Đơn hàng | **Xong**, đã đẩy: 8a, 8a-2 ngày 2026-10-06 (`d78c50f2`); 8b, 8c ngày 2026-10-15 (`feebd7ee`) |
| 1b | Khung mẫu cho từng thành phần; bộ lọc thời gian; dòng tổng dưới tiêu đề cột | **Xong**, đã đẩy: K1 ngày 2026-10-08 (`e5dc998e`); K2–K6, bộ lọc thời gian, dòng danh sách một kiểu, chữ một cách viết, dòng tổng dưới tiêu đề cột, sửa góp ý đã lưu ngày 2026-10-15 (`feebd7ee`) |
| 2 | Giao diện đồng nhất — các trang ngoài khuôn | **Xong**, đã đẩy 2026-10-15 (`feebd7ee`); sửa phiếu kiểm kê đã xác nhận, chỉ phiếu mới nhất (`BR-INV-012`, đặc tả `docs/superpowers/specs/2026-10-14-sua-phieu-kiem-ke-design.md`), migration 0110 đã chạy 2026-10-14 |
| 3 | Tổng quan mới (bước D của bản cải tổ) | **Xong**, đã đẩy 2026-10-15 (`feebd7ee`): `BR-SALE-007`, `BR-CASH-009`, đặc tả `docs/superpowers/specs/2026-10-14-tong-quan-moi-design.md`; migration 0109 đã chạy. Còn: chưa kiểm danh sách bảng sao lưu bên Apps Script đã dán lại cho khớp bản trên máy chủ chưa |
| 4 | Chức năng còn thiếu: Tồn kho, Lưu chuyển tiền tệ (bước E), trả phiếu nhập bằng nhiều hình thức, bảng chữ viết tắt, số tiền thu khi thanh lý | Tồn kho và Lưu chuyển tiền tệ (thành tab "Theo tháng" của Sổ thu chi) đã đẩy 2026-10-15 (`4b837522`); trả nhiều hình thức để tới khi có đơn thật cần (Thu chi R2); số tiền thu khi thanh lý xong, đã đẩy 2026-10-16; bảng chữ viết tắt gác lại |
| 5 | Ô tiền tự thêm dấu chấm ở các màn còn lại | Đo 2026-10-17: mọi ô tiền ở trang quản trị đã tự thêm dấu (`NumberInput`); chỉ còn 3 ô ở máy bán hàng (giảm giá cả đơn, số tiền khi trả hai cách, giảm giá từng món). **Xong trên máy này 2026-10-18, chưa đẩy** (`760e463e`): ba ô tiền ở máy bán hàng tự thêm dấu khi gõ, gõ quá mức thì báo "Tối đa …"; soát độc lập ba vòng |
| 6 | Dọn phần sót (bước H) | Tách file báo cáo và Đơn hàng đã đẩy 2026-10-15 (`feebd7ee`); xoá code chết đã đẩy 2026-10-15 (`d46953bb`). Còn: tách `app/pos/components/POSScreen.tsx` (1.138 dòng) và `app/pos/components/CartPanel.tsx` (751 dòng, đo 2026-10-18), làm cùng việc máy bán hàng ở dòng 6-giao-diện-toàn-bộ |
| 6b | Sửa theo đợt soát toàn bộ 2026-10-14 (chủ quán yêu cầu): đợt 1 lỗi kỹ thuật, đợt 2 tốc độ, đợt 3 dọn dẹp, đợt 4 gộp chỗ lặp, 10 câu chủ quán quyết | **Xong** đợt 1 và 2, đã đẩy 2026-10-15 (`feebd7ee`); đợt 3, 4 gộp vào từng mảng (dòng 6-thứ-tự). Còn: đợt 4 chưa kiểm đã làm hết chưa (bộ lọc chung `useFilterForm` mới có 2 trang dùng, F10; một hàm "hàng không theo dõi tồn", A13; dòng đơn dùng chung ở danh sách và chi tiết, C14); việc chủ quán tự làm (câu 10): luật giới hạn đăng nhập trên Vercel, tắt đăng ký tài khoản ở Supabase Auth, sửa `.claude/settings.json` (chưa rõ đã làm chưa) |
| 6b-F5 | Trang "Nhóm tuỳ chọn" theo khung chuẩn (chủ quán chốt 2026-10-14 "Dùng khung chuẩn") | **Xong**, đã đẩy 2026-10-15 (`feebd7ee`, migration B `cf11785f`; migration 0119, 0120 đã chạy); đặc tả `docs/superpowers/specs/2026-10-14-nhom-tuy-chon-design.md`; chủ quán mở trang thật 2026-10-15: "Đã kiểm tra và ổn" |
| 6-thứ-tự | **Chủ quán chốt 2026-10-14 "Đổi thứ tự":** xong 6b-F5 → chủ quán bấm thử, đẩy đợt này → làm 6c và 6d chung, **theo từng mảng** (Bán hàng, Kho, Thu chi, Báo cáo, Máy bán hàng). Mỗi mảng soát một lần cả cấu trúc dữ liệu, khuôn thiết kế chung và đề xuất cách làm tốt hơn; chủ quán chọn xong thì làm luôn mảng đó. Đợt 3, đợt 4 của 6b, mục 4, mục 5 và mục 7 gộp vào mảng tương ứng, không làm riêng. **Chủ quán chốt 2026-10-15 "Làm lại từng mảng"** khi hỏi có nên làm lại toàn bộ: không dựng lại cả hệ thống; giữ phần tiền và kho đã đối chiếu đúng; mảng nào gốc sai thì đề xuất dựng lại cả mảng đó (như Nhóm tuỳ chọn), máy bán hàng chạy suốt; bắt đầu từ mảng Bán hàng | — |
| 6-Bán-hàng | Mảng Bán hàng: soát và đề xuất `docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md`; chủ quán trả lời đủ 8 câu 2026-10-15 | **Xong**, đã đẩy 2026-10-15: đợt 1 (`167bd201`), đợt 2 (`197e3613`), đợt 3 (`7572e113`, `4de33911`; migration 0121 đã chạy; ghi dữ liệu 1, 2, 3 đã chạy), bỏ trạng thái DELETED ở món và tính giá khuyến mãi C10 (`0d708b72`, `BR-SALE-008` đến `-011`, đặc tả `docs/superpowers/specs/2026-10-15-tinh-khuyen-mai-design.md`; migration 0127 đã chạy). Nút vẫn tên "Sửa đơn", chỉ đổi cách trả (`BR-SALE-014`, chủ quán 2026-10-15) |
| 6-Kho | Mảng Kho: soát và đề xuất `docs/superpowers/specs/2026-10-15-kho-de-xuat.md` (đo 2026-10-15); 10 câu hỏi | **Xong**, đã đẩy 2026-10-15: đợt 1 và 2 (`7572e113`, lưu hàng hoá `3bb4297b`; migration 0122–0124 đã chạy); Tồn kho (`BR-INV-019`, đặc tả `docs/superpowers/specs/2026-10-15-ton-kho-design.md`) và Kiểm kê theo khuôn (`BR-INV-022`, đặc tả `docs/superpowers/specs/2026-10-15-kiem-ke-design.md`) đẩy cùng `4b837522`. Chủ quán trả lời 8 câu ngày 2026-10-15 (`BR-CATALOG-007`, `BR-INV-019` đến `BR-INV-023`); Q5 hỏi khi làm trả tiền nhiều cách, Q6 hỏi ở mảng Thu chi. Còn: chưa có trang đổi tên, ngừng dùng nguồn mua; lỗi ở form phiếu nhập còn hiện hộp "Thiếu thông tin", chưa hiện dưới từng ô (A15); nhật ký sửa phiếu nhập còn ghi sau, ngoài hàm `save_purchase_order_atomic` (`app/admin/inventory/purchase-orders/actions.ts`), nên lưu được phiếu mà mất nhật ký |
| 6-Thu-chi | Mảng Thu chi: soát và đề xuất `docs/superpowers/specs/2026-10-15-thu-chi-de-xuat.md` (phiên fnbapp-d7, đo 2026-10-15): tiền mặt theo sổ −3.593.751đ và còn trôi; 7 lựa chọn R1–R7 chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15; 2 câu chờ chủ quán: Q1 Kiểm quỹ (lật lại chốt "1b" ngày 2026-10-04), Q2 53 phiếu nhập Shopee 26.048.237đ trả qua ACB? | Chủ quán trả lời 2026-10-15: Q1 "Giữ nguyên" (`BR-CASH-007`), Q2 "Qua ACB, chuyển cả 53 đơn" (ghi dữ liệu duyệt riêng, `scripts/move-shopee-orders-to-acb.ts`). 53 phiếu đã chuyển sang ACB 2026-10-15. **Xong**, đã đẩy 2026-10-15: kiểm tra phía máy chủ và chặn chéo khoản chi hằng tháng (`0d708b72`); năm form theo khuôn, ô tìm Sổ thu chi, tab "Theo tháng" (R1, thay báo cáo lưu chuyển tiền tệ) (`4b837522`); migration 0128 bỏ cột `payer` đã chạy |
| 6-Báo-cáo | Mảng Báo cáo + Tổng quan: soát và đề xuất `docs/superpowers/specs/2026-10-15-bao-cao-de-xuat.md`; Q1 chủ quán trả lời 2026-10-15 (tháng 9 lấy số của app làm mốc) | **Xong**, đã đẩy 2026-10-15 (`4b837522`): Doanh số trên khung báo cáo, đếm lượt thanh toán (R2); Hàng đã xuất theo khoảng tháng, tách Hàng dùng và Hao hụt khớp Lãi lỗ |
| 6-Nền-tảng | Nâng cấp Next 14 → 16, React 18 → 19; xoá code chết đợt 3; cột thừa soát theo mảng (chủ quán hỏi 2026-10-15 lúc không bán hàng). Đề xuất `docs/superpowers/specs/2026-10-15-nen-tang-de-xuat.md`: đo 2026-10-15 — 101 trang codemod tự sửa, 44 chỗ `revalidateTag`, 1 middleware, 0 thư viện chặn, 40 bảng 409 cột; khuyến nghị thứ tự A: nền trước rồi từng mảng. **Chủ quán chốt A 2026-10-15.** Bước 1 nâng cấp: trang nhanh hơn ở 3/5 trang đo (Doanh số 978 → 577 ms), Tổng quan ngang (311 → 325 ms) | **Xong**: bước 1 nâng cấp đã đẩy 2026-10-15 (`6d286c96`); bước 2 xoá code chết (−1.175 dòng) đã đẩy 2026-10-15 (`d46953bb`). Còn: chủ quán mở trang thật sau nâng cấp, chưa ghi nhận |
| 6c | Thống nhất một khuôn thiết kế chung cho toàn dự án, rồi soát mọi trang theo cùng một luật, cùng một thiết kế; chủ quán 2026-10-14: *"đây luôn là điểm ưu"*. Kèm theo: trang nào có cách làm tốt hơn (tra hệ thống lớn cùng ngành) thì đề xuất làm lại, không bám code 100% (chủ quán 2026-10-14). Làm sau khi xong 6b | **Khuôn viết xong 2026-10-15** (`docs/superpowers/specs/2026-10-15-khuon-chung-design.md`, chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15): tra Shopify, KiotViet, Square, Toast; thêm `BR-UI-015` chân form, `BR-UI-016` ô tìm và trang trống, `BR-UI-017` vỏ báo cáo; bảng soát dùng cho từng mảng. Trang mẫu: thanh lưu ở Tạo món, Sửa món |
| 6d | Soát cấu trúc cơ sở dữ liệu, tối ưu cho không thừa không thiếu; chủ quán 2026-10-14 chấp nhận thao tác trên hệ thống có thể đổi theo (*"đó là điều phải xảy ra"*); được chạy nhiều Opus song song để soát. Làm sau 6c. Việc nào có thể làm máy bán ngừng nhận đơn phải báo trước | **Xong**, đã đẩy: đợt 1a 2026-10-16 (`067a6708`, migration 0132); đợt 1b 2026-10-17 (`ceca80e9`, 0133); đợt 2a (`9668cfa8`, 0134), 2b và 2c (`4c802b65`, 0135, 0136) 2026-10-17; mọi migration đã chạy và ghi sổ. Phép kiểm khấu hao độc lập `scripts/verify-depreciation.ts` 0 lệch trên 8 tháng, 83 tài sản. Còn hoãn, mỗi việc một kế hoạch riêng: bỏ cột đơn vị trên dòng phiếu nhập `purchase_order_lines.unit` (khác bảng quy đổi trên 107/362 dòng, có 7 chỗ đọc); cỡ món còn trạng thái `DELETED` (cỡ chưa bán xoá hẳn, cỡ đã bán ngừng dùng như món; cần viết luật trước); chỉ mục `order_lines_v2(created_at)` (chạy `EXPLAIN ANALYZE` trước) và chỉ mục trùng `idx_order_lines_v2_order` sau 0134 (đo còn ai đọc rồi mới bỏ); `applied_promotion_id`, `applied_promotion_snapshot_json` giữ tới khi ghi khuyến mãi theo từng dòng; nguồn mua chưa bắt buộc ở cơ sở dữ liệu (0/206 phiếu hoàn tất thiếu, đo 2026-10-17); vai SYSTEM đợi đợt bảo mật |
| 6-điện-thoại | Chủ quán 2026-10-16: *"lên kế hoạch làm lại các bản trên điện thoại luôn… càng nhiều thẻ thì lại càng dài… thiết kế lại cả màn hình của nút thêm… dễ thấy chữ và dễ bấm… Làm xong hết thì dùng playwright để kiểm tra trước"*. Thiết kế `docs/superpowers/specs/2026-10-16-khuon-dien-thoai-design.md` | **Xong**, đã đẩy 2026-10-17 (`ceca80e9`): danh sách dòng gọn hai tầng (`BR-UI-018`), báo cáo bảng cột đầu đứng yên (`BR-UI-019`), thanh lưu dính đáy (`BR-UI-015`), ô và nút 48 px; chủ quán duyệt sáu điểm 2026-10-17 ("Giữ cả sáu"). Chữ "Có thay đổi chưa lưu" khi chọn, chọn ngày, thêm/xoá dòng: đã đẩy 2026-10-17 (`4d5df40c`). Còn: chủ quán mở trên điện thoại thật, chưa ghi nhận |
| 6-giao-diện-toàn-bộ | Chủ quán 2026-10-17, gửi ảnh máy bán hàng: *"anh thấy nó vẫn chưa được tối ưu… bảng thông báo đơn hàng thành công trông cũng không phải cùng một form đồng nhất"*; chọn "Làm lại cả màn hình" cho máy bán hàng; rồi *"chạy playwright để xem thật toàn bộ trang trên cả máy tính màn nhỏ lẫn điện thoại màn nhỏ… các ô đều không giống nhau… tạo đơn nhập rất khó khăn… cách sắp xếp các nút cũng chưa tốt"*. Gồm: (1) soát mọi trang ở 1280×720 và 360×780, nhìn từng ảnh theo danh sách lỗi mắt thấy, không chỉ đo số; (2) ô nhập và nút một cỡ, một kiểu, xếp nút lại; (3) làm lại luồng tạo phiếu nhập trên máy tính; (4) máy bán hàng làm lại cả màn hình: tra KiotViet, Sapo FnB, iPOS, Square, dựng 2–3 bản mẫu cho chủ quán chọn, rồi đặc tả, kế hoạch, dựng; thông báo một kiểu chung | **Đang làm từ 2026-10-17** (việc tồn đã xong: 6d, kiểm kê tự lưu `BR-INV-023` đẩy cùng ngày; chủ quán 2026-10-17: *"Tiếp tục công việc đi em, anh nói em làm liên tục mà"*). Đã có: ảnh đợt soát 1 (48 trang Thu chi, Cài đặt, Báo cáo, máy bán hàng) ở `.worktrees/shots/audit/`; số đo cho thấy ô nhập trên máy tính cao 40, 42, 46 px lẫn nhau trong cùng trang, Lãi lỗ có 71 nút dưới 40 px, Nhà cung cấp 20. Máy bán hàng đã thấy: thông báo nền trong suốt, kiểu riêng, chấm tròn xanh bằng emoji, thẻ món lệch hàng khi loại món có hoặc không có biểu tượng, thẻ quá to ở màn rộng, ở 1024 px cột giỏ che nút Đăng xuất, nút chính hộp chọn cỡ màu đỏ thay vì nâu (`BR-UI-005`), nút cộng trừ trong giỏ nhỏ. **Máy bán hàng (4) dựng xong và gộp vào main trên máy này 2026-10-18, chưa đẩy** (`88b9faf4`, luật `BR-SALE-019`, `BR-SALE-020`; soát độc lập hai vòng; năm lệnh kiểm xanh, 4.293/4.293 test). Ghi Độ ngọt/Đá cho 35 món: chủ quán duyệt 2026-10-18, chạy ngay sau khi đẩy. Lỗi nhỏ thấy khi chụp (tên món bị cắt, nút điện thoại xuống dòng, chiều cao hộp chọn món) và ba ô tiền của mục 5 đã sửa, gộp vào main trên máy này 2026-10-18 (`760e463e`), chưa đẩy. Còn soát: đợt 2 (Kho), đợt 3 (Đơn hàng, Món) |
| 7 | Máy bán hàng và trang đăng nhập | **Xong**: đẩy 2026-10-15 (`4b837522`), bỏ bước Khách đưa theo chủ quán (`BR-SALE-018`). Còn (giới hạn biết trước, chưa sửa): đơn báo lỗi mạng mà máy chủ thật ra đã lưu, nếu thu ngân sửa giỏ hoặc đổi cách trả rồi gửi lại thì có thể ghi hai lần |
| 8 | Lộ trình dài hạn | gác lại (chủ quán 2026-10-16) |

Phần 0 (chủ quán 2026-10-10, *"Làm theo em khuyến nghị, nhưng em nên cân nhắc cả màn hình điện thoại nữa nhé"*): chủ quán thấy đợt vừa rồi làm hư nhiều giao diện và trang chạy chậm hơn. Sửa và đo xong mới đẩy. Mỗi trang soát và sửa ở cả máy tính lẫn điện thoại. Trang hai cột: Phiếu nhập, Phiếu xuất, Sửa đơn hàng trước; Món và Khuyến mãi vẽ mẫu cho chủ quán xem rồi mới quyết.

Lý do thứ tự: chủ quán đang chê giao diện, nên giao diện đi trước (1, 2). Tổng quan (3) và
Tồn kho (4) là màn hình mới, dựng sau khi khuôn đã phủ hết để dựng thẳng theo khuôn. Máy
bán hàng (7) để cuối và riêng vì đụng vào nó có thể làm quầy ngừng nhận đơn. Thứ tự này là
khuyến nghị của Opus; chủ quán đổi được bất cứ lúc nào.

## 1. Đợt 8 — Phiếu nhập, Phiếu xuất, Đơn hàng

Theo khuôn trang mục 2–3, 8. Không thêm thùng rác hay chọn nhiều ở ba danh sách này: chủ
quán chốt 2026-10-05, huỷ từng cái ở trang chi tiết (`BR-DATA-007`).

- **8a — hai trang chủ quán chỉ ra** (**xong**, đã đẩy 2026-10-06, `d78c50f2`):
  - Huỷ phiếu nhập `/admin/inventory/purchase-orders/[id]/cancel`: máy tính lấp bề ngang
    (thông tin phiếu và các dòng hàng bên cạnh ô lý do), điện thoại xếp dọc.
  - Tạo phiếu xuất `/admin/inventory/issue-slips/new`: dựng theo khuôn, hai bố cục.
- **8a-2 — góp ý chủ quán 2026-10-06** (**xong**, đã đẩy 2026-10-06, `d78c50f2`): mũi tên quay về hết kẹt vòng,
  cột "Giá trị xuất", ô "Thành tiền" và khung tổng tiền phiếu nhập, "Hình thức thanh toán"
  dời xuống dưới tổng, bỏ chữ tiếng Anh trong ngoặc (`BR-UI-001`), nút "Tạo" (`BR-UI-002`).
- **8b — phần còn lại của Phiếu nhập và Phiếu xuất:** danh sách, chi tiết, tạo, sửa chuyển
  sang mảnh chung, không đổi cách hiện. Tách `IssueSlipDetailClient.tsx` (718 dòng). Xong trong
  đợt K3, đã đẩy 2026-10-15 (`feebd7ee`).
- **8c — Đơn hàng:** danh sách đổi thẻ trên máy tính sang bảng; chi tiết; sửa. Xong trong đợt
  K4, đã đẩy 2026-10-15 (`feebd7ee`); nút "Hủy đơn" ở từng dòng bỏ, huỷ ở trang chi tiết.
- Gộp vào đợt này vì cùng trang: lỗ hổng G1, G2 ở mục "Lỗ hổng" — báo chủ quán từng cái khi
  tới trang đó.

## 1b. Khung mẫu cho từng thành phần (chủ quán 2026-10-06)

Làm trước 8b, vì 8b chuyển trang sang mảnh chung: có khung mẫu rồi mới chuyển một lần.
Luật: `docs/02-rules/business-rules/screens.md`.

- **Soát và dựng khung mẫu** (`BR-UI-005`): nút, ô nhập, ô số, bảng, khung tiền, đầu trang,
  mũi tên quay về. Đếm mọi kiểu đang có, cho chủ quán xem một trang mẫu gom đủ thành phần,
  chốt rồi mới thay ở các trang. Chủ quán duyệt trang mẫu 2026-10-07; thiết kế:
  `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md` (đợt K1–K6). Đợt K1 (cách viết số
  mới, `BR-UI-008`) đã đẩy 2026-10-08 (`e5dc998e`). Đợt K2 (dựng khuôn trong `components/ui/`,
  phép kiểm canh `components/ui/template.guard.test.ts`), K3 (các trang Kho, gồm Phiếu nhập và
  Phiếu xuất; ô trống chỉ hiện "Ví dụ" `BR-UI-009`; tên dài trong danh sách chọn hiện đủ
  `BR-UI-010`), K4 (Đơn hàng, Món, Nhóm món, Topping & tuỳ chọn, Khuyến mãi), K5 (Sổ thu chi,
  Chuyển tiền, Danh mục, Tài khoản, các báo cáo, Tổng quan: dòng tổng của bảng báo cáo nằm ngay
  dưới tiêu đề, bảng lãi lỗ giữ hình đã duyệt) và K6 (Nhân sự, Thương hiệu, Điểm bán, Nhật ký,
  Đơn cần chú ý, Xóa bộ nhớ đệm, Đổi mật khẩu, nút chọn điểm bán) đã đẩy 2026-10-15
  (`feebd7ee`). Danh sách nợ của phép kiểm canh nay trống: file Topping không ai dùng đã xoá 2026-10-15 (Bán hàng đợt 2).
- **Ô nhập số:** soát mọi ô. Mẫu là ô "Số lượng" của trang tạo phiếu xuất (chủ quán khen):
  bàn phím số trên điện thoại, số lẻ gõ bằng dấu chấm (`BR-UI-008`; trước 2026-10-07 là dấu phẩy), hiện "Quy ra" bên cạnh. Thêm: tự chèn dấu phẩy
  hàng nghìn khi gõ, không có mũi tên tăng giảm, cuộn chuột không làm đổi số (ô
  `type="number"` hiện ở phiếu nhập bị cả hai), gõ chữ thì báo ngay dưới ô. Ô tiền dùng
  chung khung này (giá món, giá tuỳ chọn, khuyến mãi xong ở đợt K4).
- **Dòng danh sách một kiểu** (`BR-UI-003`), **đọc lại toàn bộ chữ tiếng Anh còn sót**
  (`BR-UI-001`).
- **Bộ lọc thời gian kiểu Looker Studio** (`BR-UI-007`): vẽ mẫu cho chủ quán xem trước
  (khoảng có sẵn: hôm nay, hôm qua, 7 ngày qua, tháng này, tháng trước…; tự chọn; có thể so
  với kỳ trước), rồi thay ở mọi danh sách và báo cáo. Chủ quán chọn xong 2026-10-09; thiết
  kế `docs/superpowers/specs/2026-10-09-bo-loc-thoi-gian-design.md` chủ quán duyệt 2026-10-09;
  kế hoạch chủ quán duyệt 2026-10-09; đã đẩy 2026-10-15 (`feebd7ee`): bốn danh sách mở ở Tháng này, Tổng quan và Doanh số so với kỳ trước, Lãi lỗ theo tháng
  trọn, Báo cáo ngày bỏ (địa chỉ cũ mở Doanh số Hôm nay).
- **Dòng tổng dưới tiêu đề cột** (`BR-UI-004`): thiết kế ngắn (cột nào cộng được, điện
  thoại hiện ở đâu), máy chủ cộng theo bộ lọc chứ không cộng trang đang hiện.
- **Công cụ Góp ý:** sửa được góp ý đã lưu (chủ quán hỏi 2026-10-06; khuyến nghị có).

## 2. Các trang ngoài khuôn

- **Kiểm kê** `/admin/inventory/stocktake`: dựng theo khuôn, tách `StocktakeClient.tsx`
  (602 dòng). Câu hỏi Q4 của bản cải tổ (sửa phiếu kiểm khi đã có phiếu kiểm sau nó) hỏi
  chủ quán khi bắt đầu.
- **Báo cáo:** Tổng kết ngày, Doanh số, Hàng đã xuất, Lãi lỗ.
- **Trang lẻ:** Nhật ký hoạt động, Đồng bộ máy bán hàng, Xoá cache, Lịch sử giá món
  (`/admin/products/[id]/history`), Đổi mật khẩu
  (`/settings/password`).
- **Trang tạo mới còn dùng kiểu cũ** (`PageHeader` + form): Thương hiệu, Điểm bán,
  Khuyến mãi, Sổ thu chi, Nhóm thu chi, Tài khoản ngân
  hàng, Chuyển tiền, Nhân viên — dựng giống trang sửa của khuôn.

## 3. Tổng quan mới

Chủ quán đã chốt nội dung ở bản cải tổ mục 5.7–5.11: báo động (ngưỡng "lâu chưa kiểm kê"
30 ngày, anh tự đổi), bảng 7 ngày, loại món do anh tự quản (có ô "là thức uống"), nhắc
khoản chi hằng tháng, chỗ chỉnh ở Cài đặt → Tổng quan. Có bảng dữ liệu mới, nên làm đủ bốn
bước (đặc tả → thiết kế → kế hoạch → code).

## 4. Chức năng còn thiếu

- **Màn hình Tồn kho.** Câu Q5 (hiện gì: số lượng, giá trị, cảnh báo sắp hết) hỏi chủ quán
  khi bắt đầu. Dùng chung công thức tồn `computeOnHandByPurchasedItem()`.
- **Báo cáo lưu chuyển tiền tệ.** Câu Q6 (theo mẫu nào) hỏi khi bắt đầu; đọc
  `docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md` trước. Làm cho cả hai loại
  hình (hộ kinh doanh, công ty), từ sổ thu chi.
- **Trả phiếu nhập bằng một hoặc nhiều hình thức** (chủ quán 2026-10-06). Hôm nay mỗi phiếu
  chỉ có một cách trả (`purchase_orders.payment_method`, `BR-CASH-001`), sổ thu chi đọc cột
  đó. Nhiều hình thức cần bảng mới → đủ bốn bước. Hỏi chủ quán khi bắt đầu: chia theo số
  tiền từng hình thức hay theo phần trăm; có "chưa trả / ghi nợ nhà cung cấp" không; phiếu
  cũ giữ nguyên một hình thức.
- **Bảng chữ viết tắt** (`BR-UI-006`): bảng mới + màn hình chủ quán tự thêm, sửa, xoá; ví
  dụ "Hình thức thanh toán" → "HTTT" ở tiêu đề cột hẹp. Đủ bốn bước.
- **Số tiền thu khi thanh lý tài sản** (`BR-COGS-008`): **xong, đã đẩy 2026-10-16**
  (`067a6708`, migration 0131 chạy cùng ngày, chủ quán duyệt "Chạy" rồi "Đẩy").

## 5. Ô tiền tự thêm dấu phẩy

Xong trên nhánh 2026-10-08: phiếu nhập ở đợt K3; giá món, giá tuỳ chọn món, khuyến mãi ở đợt K4
(chủ quán chốt 07/10/2026 làm trong đợt khuôn mẫu). `components/ui/MoneyInput.test.tsx` canh ba
màn này. Ô tiền của trang thanh lý xong cùng việc "số tiền thu khi thanh lý" 2026-10-16.

## 6. Dọn phần sót

Đã xong, đẩy 2026-10-15: báo cáo 898 dòng tách thành bốn file dưới 320 dòng,
`app/admin/orders/actions.ts` 613 dòng tách thành năm file, lớn nhất 223 dòng (`feebd7ee`); code
chết `getCashEntries` và `DeleteConfirmModal.tsx` đã xoá (`d46953bb`). `lib/db/tables.ts` không
còn nhắc bảng đã xoá (đã kiểm).

Còn (đo 2026-10-18): `app/pos/components/POSScreen.tsx` 1.138 dòng,
`app/pos/components/CartPanel.tsx` 751; tách cùng lúc với việc máy bán hàng.
Mỗi lần dọn: mọi phép kiểm xanh và giá vốn tính lại ra đúng số cũ (đo lại trước khi dùng).

## 7. Máy bán hàng và trang đăng nhập

Bố cục riêng, dựng sau cùng và tách riêng. Báo trước giờ đưa lên vì có thể làm quầy ngừng
nhận đơn trong lúc đổi.

## 8. Lộ trình dài hạn

Theo thứ tự chủ quán đặt: đa chi nhánh (`BR-U-002`, `docs/01-system/MULTI-BRANCH-IMPACT.md`)
→ phân quyền và bảo mật (`BR-U-003`) → nhượng quyền (chưa chắc làm). Còn treo trong
`docs/02-rules/business-rules/unresolved.md`: bán khi mất mạng (`BR-U-001`), tập dượt khôi
phục sao lưu (`BR-U-004`), hàng tồn âm cần chỉnh tay (`BR-U-005`). Mỗi mục cần chủ quán cho
phép riêng mới bắt đầu.

## Lỗ hổng đã thấy, chưa báo chủ quán

Báo từng cái, khi làm tới trang liên quan. Cái nào cần chủ quán quyết thì hỏi; cái nào kỹ
thuật thì tự sửa rồi báo.

| # | Lỗ hổng | Gắn với |
|---|---|---|
| G1 | ~~Sửa phiếu nhập mà đổi mặt hàng của một dòng: tài sản của dòng đó mất liên kết~~ — đóng 2026-10-08 (đợt K3): sửa phiếu đã hoàn thành thì tài sản sinh từ phiếu đổi theo; dòng đổi mặt hàng thì tài sản cũ ngừng, tài sản mới sinh (`BR-COGS-008`) | — |
| G2 | ~~Phiếu nhập nháp luôn mở form nên không thấy nút "Huỷ phiếu"~~ — đóng 2026-10-08 (đợt K3): phiếu nháp có "Huỷ phiếu" ngay trên form, chủ quán chốt "A" (`BR-INV-015`) | — |
| G3 | ~~Tạo phiếu xuất: "Tồn hiện tại" là tồn hôm nay, kể cả khi ghi lùi ngày~~ — đóng 2026-10-06, giữ nguyên. Chủ quán: *"anh chỉ cần xem tồn hiện tại thôi, nên nếu anh có thêm 1 phiếu tồn trong quá khứ thì tồn hiện tại sẽ thay đổi. Chứ không cần tồn theo thời điểm lọc."* Mặt hàng hết hàng hôm nay không xuất lùi ngày được (tồn hôm nay sẽ âm, `issue_stock_headroom` từ chối), nên ẩn nó khỏi danh sách là đúng | — |
| G4 | ~~Xoá nhân viên (`deleteUserAction`, `app/admin/users/actions.ts`): không chặn việc chủ quán tự xoá chính mình hay xoá tài khoản `ADMIN` cuối cùng~~ — đóng 2026-10-14 trên nhánh: máy từ chối xoá tài khoản đang đăng nhập và tài khoản chủ quán cuối cùng còn dùng (luật ở `docs/02-rules/business-rules/access.md`) | — |
| G5 | ~~10 tài sản không còn dòng phiếu nhập~~ — đóng 2026-10-08: chủ quán đồng ý gắn lại, đã gắn 10 tài sản của PO-098 và PO-100 vào dòng còn sống (`BR-COGS-008`) | — |

## File đã xoá ngày 2026-10-06

Mọi kế hoạch cũ trong `docs/superpowers/plans/` (44 file, đều đã làm xong) và 10 bản thiết
kế đã dựng xong, luật đã ghi sang `docs/02-rules/business-rules/`. Chỗ trích dẫn trong code
và tài liệu đã đổi sang mã luật. Migration giữ nguyên dòng trích dẫn cũ vì là lịch sử. Cần
xem lại nội dung cũ: `git log --diff-filter=D -- docs/superpowers/`.

Ngày 2026-10-18 xoá thêm 30 kế hoạch con đã xong và đã đẩy; việc còn sót của chúng chép vào
các dòng trên (3, 6, 6b, 6-Kho, 6d, 6-Nền-tảng, 6-điện-thoại, 7). Chỗ trích dẫn đổi sang mã
commit hoặc đặc tả; migration giữ dòng trích dẫn cũ.

Giữ lại bốn bản thiết kế còn dùng: bản cải tổ (`2026-09-28-cai-to-he-thong.md`), menu và
bảng màu (`2026-09-29-menu-va-khuon-trang-design.md`), khuôn trang
(`2026-10-02-khuon-danh-sach-chi-tiet-design.md`), lãi lỗ
(`2026-09-11-bao-cao-lai-lo-design.md`).
