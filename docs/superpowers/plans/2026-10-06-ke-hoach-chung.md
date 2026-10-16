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

Máy bán hàng (7) và các mảng Bán hàng, Kho, Thu chi, Báo cáo đã đẩy lên bản thật 2026-10-15 (`4b837522`); migration 0127–0130 đã chạy. Các dòng bên dưới còn ghi "chờ đẩy" của những mảng này là chữ cũ.

| # | Phần | Trạng thái |
|---|---|---|
| 0 | Sửa chỗ hỏng sau đợt K2–K6 và bộ lọc thời gian; đo tốc độ trước và sau; rồi tiêu đề cột đậm, căn trái (`BR-UI-011`); trang tạo/sửa hai cột cho Phiếu nhập, Phiếu xuất, Sửa đơn hàng — trước khi đẩy | xong trên nhánh 2026-10-10, chờ đẩy: sửa bảng Khuyến mãi, ô lọc trên điện thoại (15 trang), tiêu đề cột đậm căn trái, ba trang tạo/sửa hai cột; đo tốc độ bản chạy thật: nhánh không chậm hơn bản đang dùng. Thêm 2026-10-11 → 14: mọi trang chung một khung tối đa 1.280 căn giữa (`BR-UI-012`), ô và dòng gọn hơn trên máy tính (`BR-UI-014`), tiêu đề trang tạo là "Tạo …" (`BR-UI-013`), mọi form còn lại hai cột kể cả Món và Khuyến mãi (chủ quán chốt 2026-10-14 thay cho bản mẫu), trang một đơn hàng hai cột, Hàng đã xuất có bảng trên máy tính |
| 1 | Giao diện đồng nhất — đợt 8: Phiếu nhập, Phiếu xuất, Đơn hàng | đang làm |
| 1b | Khung mẫu cho từng thành phần; bộ lọc thời gian; dòng tổng dưới tiêu đề cột | xong trên nhánh, chờ đẩy: khuôn K1–K6 (K2–K6 chờ đẩy); bộ lọc thời gian 2026-10-09; 2026-10-14 dòng danh sách một kiểu, chữ một cách viết, dòng tổng dưới tiêu đề cột, sửa góp ý đã lưu (kế hoạch con `docs/superpowers/plans/2026-10-14-dot-9-phan-con-lai.md`) |
| 2 | Giao diện đồng nhất — các trang ngoài khuôn | gần xong trên nhánh, chờ đẩy: trang lẻ và báo cáo theo khuôn (K5, K6), trang tạo theo khuôn (2026-10-11 → 14), Kiểm kê tách thành bốn file 2026-10-14; Q4 chủ quán chốt 2026-10-14 (chỉ sửa được phiếu kiểm kê mới nhất); sửa phiếu kiểm kê đã xác nhận (`BR-INV-012`) xong trên nhánh 2026-10-14, migration 0110 đã lên máy chủ 2026-10-14 (chủ quán duyệt "a"): đặc tả `docs/superpowers/specs/2026-10-14-sua-phieu-kiem-ke-design.md` chủ quán xác nhận ví dụ 2026-10-14, kế hoạch con `docs/superpowers/plans/2026-10-14-sua-phieu-kiem-ke.md` |
| 3 | Tổng quan mới (bước D của bản cải tổ) | xong trên nhánh 2026-10-14, chờ đẩy: ô "việc cần xử lý" và bảng 7 ngày (`BR-SALE-007`, `BR-CASH-009`), ba trang Loại món, Khoản chi hằng tháng, Cài đặt Tổng quan; migration 0109 đã lên máy chủ; phép đo `scripts/verify-dashboard-seven-days.ts` 0 lệch trên 36 ô; đặc tả `docs/superpowers/specs/2026-10-14-tong-quan-moi-design.md`. Khi đẩy: dán lại danh sách bảng sao lưu Apps Script cùng lúc với bản sao lưu trên máy chủ |
| 4 | Chức năng còn thiếu: Tồn kho, Lưu chuyển tiền tệ (bước E), trả phiếu nhập bằng nhiều hình thức, bảng chữ viết tắt, số tiền thu khi thanh lý | Tồn kho và Lưu chuyển tiền tệ (thành tab "Theo tháng" của Sổ thu chi) viết xong trên nhánh 2026-10-15, xem dòng 6-Kho, 6-Thu-chi; trả nhiều hình thức để tới khi có đơn thật cần (Thu chi R2); số tiền thu khi thanh lý xong, đã đẩy 2026-10-16; bảng chữ viết tắt gác lại |
| 5 | Ô tiền tự thêm dấu chấm ở các màn còn lại | chưa làm |
| 6 | Dọn phần sót (bước H) | đang làm: báo cáo và Đơn hàng tách file 2026-10-14; còn máy bán hàng (phần 7) và code chết chờ chủ quán |
| 6b | Sửa theo đợt soát toàn bộ 2026-10-14 (chủ quán yêu cầu): đợt 1 lỗi kỹ thuật, đợt 2 tốc độ, đợt 3 dọn dẹp, đợt 4 gộp chỗ lặp, 10 câu chủ quán quyết | kế hoạch con `docs/superpowers/plans/2026-10-14-soat-toan-bo.md`; đã sửa ngay: lộ mã băm mật khẩu ở Doanh số, cổng sửa đơn không hỏi đăng nhập, đơn vị ở Kiểm kê |
| 6b-F5 | Trang "Nhóm tuỳ chọn" theo khung chuẩn (chủ quán chốt 2026-10-14 "Dùng khung chuẩn") | kế hoạch con `docs/superpowers/plans/2026-10-14-nhom-tuy-chon.md`, đặc tả `docs/superpowers/specs/2026-10-14-nhom-tuy-chon-design.md`; code xong 2026-10-14 (năm cửa kiểm xanh, soát độc lập đã sửa xong), migration `0119` đã chạy lên máy chủ 2026-10-15 (chủ quán duyệt; đo: 0/9 tuỳ chọn thiếu nhóm, 35 món đồ uống được gắn, 0 món ăn và Topping); đẩy lên bản thật 2026-10-15 (chủ quán duyệt "đẩy lên bản thật", `feebd7ee`, Vercel READY, 0 lỗi máy chủ 10 phút đầu); hàm sao lưu `backup-to-drive` deploy cùng ngày (chủ quán duyệt riêng, thêm 5 bảng mới; chưa xem bản sao đêm đầu); chủ quán mở trang thật 2026-10-15: "Đã kiểm tra và ổn"; migration B (`0120`, `9bef9288`) đã chạy lên máy chủ 2026-10-15 (chủ quán duyệt "Chạy đi"; đo: `group_id` bắt buộc, cột `group_name` đã bỏ, 9/9 tuỳ chọn có nhóm, `sync_topping_price_atomic` còn một bản 3 đối số chỉ `service_role` gọi được, Kem muối 4.000/4.000); code đẩy lên bản thật cùng ngày (chủ quán duyệt "Đẩy đi", `cf11785f`, Vercel READY, 0 lỗi máy chủ). **Xong** |
| 6-thứ-tự | **Chủ quán chốt 2026-10-14 "Đổi thứ tự":** xong 6b-F5 → chủ quán bấm thử, đẩy đợt này → làm 6c và 6d chung, **theo từng mảng** (Bán hàng, Kho, Thu chi, Báo cáo, Máy bán hàng). Mỗi mảng soát một lần cả cấu trúc dữ liệu, khuôn thiết kế chung và đề xuất cách làm tốt hơn; chủ quán chọn xong thì làm luôn mảng đó. Đợt 3, đợt 4 của 6b, mục 4, mục 5 và mục 7 gộp vào mảng tương ứng, không làm riêng. **Chủ quán chốt 2026-10-15 "Làm lại từng mảng"** khi hỏi có nên làm lại toàn bộ: không dựng lại cả hệ thống; giữ phần tiền và kho đã đối chiếu đúng; mảng nào gốc sai thì đề xuất dựng lại cả mảng đó (như Nhóm tuỳ chọn), máy bán hàng chạy suốt; bắt đầu từ mảng Bán hàng | — |
| 6-Bán-hàng | Mảng Bán hàng: soát và đề xuất `docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md`; chủ quán trả lời đủ 8 câu 2026-10-15 | **Đã làm:** món đã xoá không còn nút Bán lại (`61937cd0`); Sửa đơn chỉ đổi cách trả (`BR-SALE-014`, `b3253f16`), nút vẫn tên "Sửa đơn" (chủ quán 2026-10-15); đẩy lên bản thật 2026-10-15 (chủ quán duyệt, `167bd201`, Vercel READY, 0 lỗi máy chủ). Đợt 2 đẩy lên bản thật 2026-10-15 (chủ quán duyệt, `197e3613`, Vercel READY, 0 lỗi máy chủ): Huỷ đơn thành trang riêng có lý do; danh sách đơn lọc Đã huỷ; mở lại điểm bán đã ngừng; bỏ ô Ngày áp dụng giá; lỗi hiện ngay dưới ô; năm trang tạo mới (Món, Nhóm món, Loại món, Tuỳ chọn, Nhóm tuỳ chọn) theo khuôn; xoá trang Topping cũ; ghi dữ liệu 2 chạy 2026-10-15 (chủ quán duyệt): 6 đơn trả lại người bán tuyen2612, 3 đơn trả lại khuyến mãi, tiền 6/6 đơn không đổi, chạy thử lại còn 0 đơn lệch trên 18 (`scripts/restore-order-seller-promo.ts`). Đợt 3 viết xong trên nhánh 2026-10-15, chưa chạy gì lên máy chủ (`docs/superpowers/plans/2026-10-15-ban-hang-dot-3.md`): trang món hỏi máy chủ tuỳ chọn nào đã bán thay vì đọc mọi dòng đơn; hai bản ghi dữ liệu 1 và 3 chạy thử xong; migration 0121 bỏ các cột chết của đơn. **Đã đẩy 2026-10-15** A1–A4a (chủ quán duyệt "Đẩy lên", `7572e113`). **Đã ghi 2026-10-15** ghi dữ liệu 1 (chủ quán duyệt "Ghi thật"): 37 trên 55 dòng lịch sử giá hết 0đ, đọc lại còn 0 dòng 0đ. Ghi dữ liệu 3 cùng ngày ("Ghi thật"): xoá hẳn 3 món đã xoá chưa bán (Cà phê kem dẻo CT1, CT2, Cà phê đá bản cũ) kèm size và lịch sử giá, và nhóm Cacao; giữ Dâu sấy vì một đơn cũ còn nhắc. 0121 chạy 2026-10-15 lúc quán vắng (chủ quán chọn "Chạy ngay bây giờ") và A4b đẩy ngay sau (`4de33911`); đợt 3 xong. Bỏ trạng thái DELETED xong (`1469bc23`). **Tính giá khuyến mãi (C10) viết xong trên nhánh 2026-10-15**, chưa đẩy (`docs/superpowers/specs/2026-10-15-tinh-khuyen-mai-design.md`): máy bán và máy chủ tính chung một hàm, khuyến mãi "Dùng chung", thu ngân chọn bộ khuyến mãi, máy chủ từ chối khi tổng lệch (`BR-SALE-008` đến `-011`); migration 0127 phải chạy trước khi đẩy, đẩy cùng lúc máy bán và máy chủ |
| 6-Kho | Mảng Kho: soát và đề xuất `docs/superpowers/specs/2026-10-15-kho-de-xuat.md` (đo 2026-10-15); 10 câu hỏi | **Đợt 1 viết xong trên nhánh 2026-10-15** (`docs/superpowers/plans/2026-10-15-kho-dot-1.md`): Huỷ phiếu xuất thành trang riêng; Phiếu nhập thêm nguồn ngay trong ô chọn, trang phiếu hiện tên nhà cung cấp và khoá nút khi đã kiểm kê; chặn đổi phân loại hàng đã xuất kho (giá vốn tháng cũ); migration 0122 chặn sửa kiểm kê làm âm kho. **Đợt 2 viết xong trên nhánh 2026-10-15** (`docs/superpowers/plans/2026-10-15-kho-dot-2.md`): chặn số nhập sai ở phiếu nhập và thanh lý (migration 0123); lưu hàng hoá trọn một lần (migration 0124); xoá code chết; chữ và khung báo trên màn hình Kho. **Đã đẩy 2026-10-15** đợt 1 và đợt 2 phần không cần migration (chủ quán duyệt "Đẩy lên", `7572e113`). 0122 và 0123 chạy trên máy chủ 2026-10-15 ("Chạy", duyệt riêng từng bản); 0124 chạy rồi đẩy phần lưu hàng hoá cùng ngày ("Chạy rồi đẩy", `3bb4297b`). Chủ quán trả lời 8 câu ngày 2026-10-15 (`BR-CATALOG-007`, `BR-INV-019` đến `BR-INV-023`); Q5 hỏi khi làm trả tiền nhiều cách, Q6 hỏi ở mảng Thu chi. **Viết xong trên nhánh 2026-10-15, chưa đẩy:** trang Tồn kho mới đầu nhóm Kho (`BR-INV-019`, `docs/superpowers/specs/2026-10-15-ton-kho-design.md`; đo 69 món, 18.013.339đ, 0 lệch trên 69); Kiểm kê dựng lại theo khuôn, hoàn tác thành trang riêng có lý do (`BR-INV-022`, `docs/superpowers/specs/2026-10-15-kiem-ke-design.md`) |
| 6-Thu-chi | Mảng Thu chi: soát và đề xuất `docs/superpowers/specs/2026-10-15-thu-chi-de-xuat.md` (phiên fnbapp-d7, đo 2026-10-15): tiền mặt theo sổ −3.593.751đ và còn trôi; 7 lựa chọn R1–R7 chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15; 2 câu chờ chủ quán: Q1 Kiểm quỹ (lật lại chốt "1b" ngày 2026-10-04), Q2 53 phiếu nhập Shopee 26.048.237đ trả qua ACB? | Chủ quán trả lời 2026-10-15: Q1 "Giữ nguyên" (`BR-CASH-007`), Q2 "Qua ACB, chuyển cả 53 đơn" (ghi dữ liệu duyệt riêng, `scripts/move-shopee-orders-to-acb.ts`). Kiểm tra phía máy chủ và chặn chéo khoản chi hằng tháng xong (`1469bc23`). **Viết xong trên nhánh 2026-10-15, chưa đẩy:** năm form theo khuôn, ô tìm Sổ thu chi, tab "Theo tháng" (R1, thay báo cáo lưu chuyển tiền tệ); migration 0128 bỏ cột `payer` chạy sau khi đẩy |
| 6-Báo-cáo | Mảng Báo cáo + Tổng quan: soát và đề xuất `docs/superpowers/specs/2026-10-15-bao-cao-de-xuat.md`; Q1 chủ quán trả lời 2026-10-15 (tháng 9 lấy số của app làm mốc) | **Viết xong trên nhánh 2026-10-15, chưa đẩy:** Doanh số trên khung báo cáo, máy chủ tính hết, đếm lượt thanh toán (R2); Hàng đã xuất theo khoảng tháng, tách Hàng dùng và Hao hụt khớp Lãi lỗ; `verify-revenue` xanh lại |
| 6-Nền-tảng | Nâng cấp Next 14 → 16, React 18 → 19; xoá code chết đợt 3; cột thừa soát theo mảng (chủ quán hỏi 2026-10-15 lúc không bán hàng). Đề xuất `docs/superpowers/specs/2026-10-15-nen-tang-de-xuat.md`: đo 2026-10-15 — 101 trang codemod tự sửa, 44 chỗ `revalidateTag`, 1 middleware, 0 thư viện chặn, 40 bảng 409 cột; khuyến nghị thứ tự A: nền trước rồi từng mảng. **Chủ quán chốt A 2026-10-15.** Bước 1 nâng cấp: kế hoạch con `docs/superpowers/plans/2026-10-15-nang-cap-next-16.md`. Chủ quán 2026-10-15: phiên này chỉ lên kế hoạch; phiên fnbapp-f5 phản biện rồi triển khai. Làm xong trên nhánh `chore/next-16` 2026-10-15: năm cửa kiểm xanh (vitest 493/493 file, 3.777 test), trang nhanh hơn ở 3/5 trang đo (Doanh số 978 → 577 ms), Tổng quan ngang (311 → 325 ms) | Bước 1 **đã đẩy 2026-10-15** (6d286c96, Vercel READY, 0 lỗi máy chủ 15 phút đầu); chờ chủ quán mở trang thật. Bước 2 xoá code chết xong trên nhánh 2026-10-15 (`docs/superpowers/plans/2026-10-15-don-code-chet.md`): −1.175 dòng, 16 file test canh thứ đã gỡ; **đã đẩy 2026-10-15** (chủ quán duyệt "Đẩy ngay", `d46953bb`, Vercel READY, 0 lỗi máy chủ trong 1 giờ). **Xong** |
| 6c | Thống nhất một khuôn thiết kế chung cho toàn dự án, rồi soát mọi trang theo cùng một luật, cùng một thiết kế; chủ quán 2026-10-14: *"đây luôn là điểm ưu"*. Kèm theo: trang nào có cách làm tốt hơn (tra hệ thống lớn cùng ngành) thì đề xuất làm lại, không bám code 100% (chủ quán 2026-10-14). Làm sau khi xong 6b | **Khuôn viết xong 2026-10-15** (`docs/superpowers/specs/2026-10-15-khuon-chung-design.md`, chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15): tra Shopify, KiotViet, Square, Toast; thêm `BR-UI-015` chân form, `BR-UI-016` ô tìm và trang trống, `BR-UI-017` vỏ báo cáo; bảng soát dùng cho từng mảng. Trang mẫu: thanh lưu ở Tạo món, Sửa món |
| 6d | Soát cấu trúc cơ sở dữ liệu, tối ưu cho không thừa không thiếu; chủ quán 2026-10-14 chấp nhận thao tác trên hệ thống có thể đổi theo (*"đó là điều phải xảy ra"*); được chạy nhiều Opus song song để soát. Làm sau 6c. Việc nào có thể làm máy bán ngừng nhận đơn phải báo trước | Kế hoạch con `docs/superpowers/plans/2026-10-16-6d-csdl.md`. **Đợt 1a xong, đã đẩy 2026-10-16** (`067a6708`; migration 0132 chạy cùng ngày; sao lưu Drive cập nhật; thêm 1 dòng thanh toán và 9 dòng lịch sử giá, 0 lệch trên 1.874 đơn và 57 cỡ món; gỡ `user-admin`, xoá POE-001 — chủ quán duyệt từng việc). **Đợt 1b code đã đẩy 2026-10-17** cùng đợt điện thoại (`ceca80e9`); migration 0133 chạy cùng đêm sau khi đẩy (chủ quán duyệt "Chạy ngay"; đo trước khi chạy: 0 giá trị trên 45/48/23/61/3/151 dòng, 0 lệch trên 362 dòng phiếu nhập; sau khi chạy: còn 0/7 cột, 4/4 hàm còn đủ) (trước đó `69969353`: bỏ 7 cột trống hoặc suy ra được, migration 0133 chạy **sau** khi đẩy code; năm cửa kiểm xanh, 4.029/4.029 test). **Đợt 2a xong, đã đẩy 2026-10-17** (`9668cfa8`, đẩy cùng `6f624931`, Vercel READY, 0 lỗi máy chủ; 0134 chạy sau khi đẩy, cùng ngày, và ghi sổ migration — chủ quán duyệt từng việc; đọc lại 6/6 ràng buộc): chỉ thêm 6 ràng buộc cho đơn và dòng đơn, 0 vi phạm trên 3.535 đơn / 4.914 dòng; sửa kèm khôi phục bản sao lưu; Sonnet phản biện, reviewer soát; vitest 505/505 file, 4.172 test; verify-revenue khớp 6/6 tháng đã đóng, verify-price-cart 0 lệch trên 4.914 dòng. Đợt 2b (bỏ `completed_at`, `pos_snapshot_json`) chờ hỏi chủ quán ở bước cuối vì là xoá dữ liệu. Còn: các mục hoãn |
| 6-điện-thoại | Chủ quán 2026-10-16: *"lên kế hoạch làm lại các bản trên điện thoại luôn… càng nhiều thẻ thì lại càng dài… thiết kế lại cả màn hình của nút thêm… dễ thấy chữ và dễ bấm… Làm xong hết thì dùng playwright để kiểm tra trước"*. Thiết kế `docs/superpowers/specs/2026-10-16-khuon-dien-thoai-design.md`, kế hoạch con `docs/superpowers/plans/2026-10-16-khuon-dien-thoai.md` | **Xong trên `main` 2026-10-16, chưa đẩy** (gộp `06453fa7` và `9bd67d1d`; năm cửa kiểm xanh, 4.159/4.159 test trên 504 file): mọi danh sách là dòng gọn hai tầng (`BR-UI-018`), báo cáo là bảng cột đầu đứng yên (`BR-UI-019`), mọi trang tạo/sửa chung một thanh lưu dính đáy (`BR-UI-015`), ô và nút 48 px, không chữ dưới 12 px; Phiếu nhập và Phiếu xuất gập dòng hàng, bấm mở tại chỗ. Playwright 2026-10-16 ở 390×844: 26/26 trang tạo/sửa trả 200, 0 tràn ngang, 0 chữ dưới 12 px, 24/24 thanh lưu không đè thanh menu (2 trang không có thanh: Loại món, Huỷ phiếu nhập); Phiếu nhập hiện 7 dòng ở màn đầu (trước 5), dòng cao 69 px; nhãn "Bán hàng" không xuống dòng ở 390 và 360; máy tính 1280×800 không đổi (12/12 trang 0 tràn, bảng vẫn hiện). Còn hở: chữ "Có thay đổi chưa lưu" chỉ hiện khi gõ, chưa hiện khi chọn trong ô chọn, chọn ngày, hay thêm/xoá dòng. Chủ quán duyệt sáu điểm chọn thay và chữ trên nút 2026-10-17 ("Giữ cả sáu"). **Đã đẩy 2026-10-17** (chủ quán duyệt "Đẩy ngay", `ceca80e9`, Vercel READY, 0 lỗi máy chủ); chờ chủ quán mở trên điện thoại thật. **Lỗ "Có thay đổi chưa lưu" sửa xong, đã đẩy 2026-10-17** (`4d5df40c`, đẩy cùng `6f624931`; chờ chủ quán mở trên điện thoại thật): ô chọn, chọn ngày, thêm/xoá dòng ở Phiếu nhập, Phiếu xuất, Đổi cách trả, Món, Mặt hàng, Khung giá tài sản, Nhóm tuỳ chọn; reviewer soát; bấm thật 7/7 bước đạt (390×844 và 1280×800), 54/54 trang quản trị mở không lỗi; năm cửa kiểm xanh (4.177 test) |
| 7 | Máy bán hàng và trang đăng nhập | **Xong**: đẩy 2026-10-15 (`4b837522`), bỏ bước Khách đưa theo chủ quán (`BR-SALE-018`) |
| 8 | Lộ trình dài hạn | gác lại (chủ quán 2026-10-16) |

Phần 0 (chủ quán 2026-10-10, *"Làm theo em khuyến nghị, nhưng em nên cân nhắc cả màn hình điện thoại nữa nhé"*): chủ quán thấy đợt vừa rồi làm hư nhiều giao diện và trang chạy chậm hơn. Sửa và đo xong mới đẩy. Mỗi trang soát và sửa ở cả máy tính lẫn điện thoại. Trang hai cột: Phiếu nhập, Phiếu xuất, Sửa đơn hàng trước; Món và Khuyến mãi vẽ mẫu cho chủ quán xem rồi mới quyết.

Lý do thứ tự: chủ quán đang chê giao diện, nên giao diện đi trước (1, 2). Tổng quan (3) và
Tồn kho (4) là màn hình mới, dựng sau khi khuôn đã phủ hết để dựng thẳng theo khuôn. Máy
bán hàng (7) để cuối và riêng vì đụng vào nó có thể làm quầy ngừng nhận đơn. Thứ tự này là
khuyến nghị của Opus; chủ quán đổi được bất cứ lúc nào.

## 1. Đợt 8 — Phiếu nhập, Phiếu xuất, Đơn hàng

Theo khuôn trang mục 2–3, 8. Không thêm thùng rác hay chọn nhiều ở ba danh sách này: chủ
quán chốt 2026-10-05, huỷ từng cái ở trang chi tiết (`BR-DATA-007`).

- **8a — hai trang chủ quán chỉ ra** (code xong 2026-10-06, chờ chủ quán xem; kế hoạch con
  `docs/superpowers/plans/2026-10-06-dot8a-huy-phieu-nhap-tao-phieu-xuat.md` xoá khi chủ quán nhận):
  - Huỷ phiếu nhập `/admin/inventory/purchase-orders/[id]/cancel`: máy tính lấp bề ngang
    (thông tin phiếu và các dòng hàng bên cạnh ô lý do), điện thoại xếp dọc.
  - Tạo phiếu xuất `/admin/inventory/issue-slips/new`: dựng theo khuôn, hai bố cục.
- **8a-2 — góp ý chủ quán 2026-10-06** (đang làm; kế hoạch con
  `docs/superpowers/plans/2026-10-06-dot8a2-gop-y-chu-quan.md`): mũi tên quay về hết kẹt vòng,
  cột "Giá trị xuất", ô "Thành tiền" và khung tổng tiền phiếu nhập, "Hình thức thanh toán"
  dời xuống dưới tổng, bỏ chữ tiếng Anh trong ngoặc (`BR-UI-001`), nút "Tạo" (`BR-UI-002`).
- **8b — phần còn lại của Phiếu nhập và Phiếu xuất:** danh sách, chi tiết, tạo, sửa chuyển
  sang mảnh chung, không đổi cách hiện. Tách `IssueSlipDetailClient.tsx` (718 dòng). Xong trên
  nhánh 2026-10-08 trong đợt K3, chờ đẩy.
- **8c — Đơn hàng:** danh sách đổi thẻ trên máy tính sang bảng; chi tiết; sửa. Xong trên nhánh
  2026-10-08 trong đợt K4, chờ đẩy; nút "Hủy đơn" ở từng dòng bỏ, huỷ ở trang chi tiết.
- Gộp vào đợt này vì cùng trang: lỗ hổng G1, G2 ở mục "Lỗ hổng" — báo chủ quán từng cái khi
  tới trang đó.

## 1b. Khung mẫu cho từng thành phần (chủ quán 2026-10-06)

Làm trước 8b, vì 8b chuyển trang sang mảnh chung: có khung mẫu rồi mới chuyển một lần.
Luật: `docs/02-rules/business-rules/screens.md`.

- **Soát và dựng khung mẫu** (`BR-UI-005`): nút, ô nhập, ô số, bảng, khung tiền, đầu trang,
  mũi tên quay về. Đếm mọi kiểu đang có, cho chủ quán xem một trang mẫu gom đủ thành phần,
  chốt rồi mới thay ở các trang. Chủ quán duyệt trang mẫu 2026-10-07; thiết kế:
  `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md` (đợt K1–K6). Đợt K1 (cách viết số
  mới, `BR-UI-008`) đã đẩy 2026-10-08, chờ chủ quán nhận. Đợt K2 (dựng khuôn trong `components/ui/`,
  phép kiểm canh `components/ui/template.guard.test.ts`) xong trên nhánh 2026-10-08, chờ đẩy. Đợt K3
  (các trang Kho, gồm Phiếu nhập và Phiếu xuất; ô trống chỉ hiện "Ví dụ" `BR-UI-009`; tên dài trong
  danh sách chọn hiện đủ `BR-UI-010`) xong trên nhánh 2026-10-08, chờ đẩy. Đợt K4 (Đơn hàng, Món,
  Nhóm món, Topping & tuỳ chọn, Khuyến mãi; kế hoạch con `docs/superpowers/plans/2026-10-08-dot-k4-ban-hang.md`)
  xong trên nhánh 2026-10-08, chờ đẩy. Đợt K5 (Sổ thu chi, Chuyển tiền, Danh mục, Tài khoản, các báo cáo,
  Tổng quan; kế hoạch con `docs/superpowers/plans/2026-10-08-dot-k5-tai-chinh-bao-cao.md`) xong trên nhánh
  2026-10-08, chờ đẩy: dòng tổng của bảng báo cáo nằm ngay dưới tiêu đề, bảng lãi lỗ giữ hình đã duyệt.
  Đợt K6 (Nhân sự, Thương hiệu, Điểm bán, Nhật ký, Đơn cần chú ý, Xóa bộ nhớ đệm, Đổi mật khẩu, nút chọn
  điểm bán; kế hoạch con `docs/superpowers/plans/2026-10-08-dot-k6-con-lai.md`) xong trên nhánh 2026-10-08,
  chờ đẩy. Danh sách nợ của phép kiểm canh nay trống: file Topping không ai dùng đã xoá 2026-10-15 (Bán hàng đợt 2).
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
  kế hoạch `docs/superpowers/plans/2026-10-09-bo-loc-thoi-gian.md` chủ quán duyệt 2026-10-09; xong trên nhánh
  2026-10-09, chờ đẩy: bốn danh sách mở ở Tháng này, Tổng quan và Doanh số so với kỳ trước, Lãi lỗ theo tháng
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

File lớn chưa bước nào đụng (đo 2026-10-06): `app/pos/components/POSScreen.tsx` 1.144 dòng,
`app/pos/components/CartPanel.tsx` 689, báo cáo 898 (đã tách thành bốn file dưới 320 dòng ngày 2026-10-14),
`app/admin/orders/actions.ts` 613 (đã tách thành năm file, lớn nhất 223 dòng, ngày 2026-10-14). `lib/db/tables.ts` không còn nhắc bảng đã xoá (đã kiểm).
Mỗi lần dọn: mọi phép kiểm xanh và giá vốn tính lại ra đúng số cũ (đo lại trước khi dùng).

Code chết đã thấy, chỉ báo chưa xoá: `getCashEntries` (`app/admin/finance/actions.ts`),
`DeleteConfirmModal.tsx`.

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

Giữ lại bốn bản thiết kế còn dùng: bản cải tổ (`2026-09-28-cai-to-he-thong.md`), menu và
bảng màu (`2026-09-29-menu-va-khuon-trang-design.md`), khuôn trang
(`2026-10-02-khuon-danh-sach-chi-tiet-design.md`), lãi lỗ
(`2026-09-11-bao-cao-lai-lo-design.md`).
