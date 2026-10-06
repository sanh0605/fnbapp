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

| # | Phần | Trạng thái |
|---|---|---|
| 1 | Giao diện đồng nhất — đợt 8: Phiếu nhập, Phiếu xuất, Đơn hàng | đang làm |
| 2 | Giao diện đồng nhất — các trang ngoài khuôn | chưa làm |
| 3 | Tổng quan mới (bước D của bản cải tổ) | chưa làm |
| 4 | Chức năng còn thiếu: Tồn kho, Lưu chuyển tiền tệ (bước E) | chưa làm |
| 5 | Ô tiền tự thêm dấu chấm ở các màn còn lại | chưa làm |
| 6 | Dọn phần sót (bước H) | chưa làm |
| 7 | Máy bán hàng và trang đăng nhập | chưa làm |
| 8 | Lộ trình dài hạn | chưa làm |

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
- **8b — phần còn lại của Phiếu nhập và Phiếu xuất:** danh sách, chi tiết, tạo, sửa chuyển
  sang mảnh chung, không đổi cách hiện. Tách `IssueSlipDetailClient.tsx` (718 dòng).
- **8c — Đơn hàng:** danh sách đổi thẻ trên máy tính sang bảng; chi tiết; sửa.
- Gộp vào đợt này vì cùng trang: lỗ hổng G1, G2 ở mục "Lỗ hổng" — báo chủ quán từng cái khi
  tới trang đó.

## 2. Các trang ngoài khuôn

- **Kiểm kê** `/admin/inventory/stocktake`: dựng theo khuôn, tách `StocktakeClient.tsx`
  (602 dòng). Câu hỏi Q4 của bản cải tổ (sửa phiếu kiểm khi đã có phiếu kiểm sau nó) hỏi
  chủ quán khi bắt đầu.
- **Báo cáo:** Tổng kết ngày, Doanh số, Hàng đã xuất, Lãi lỗ.
- **Trang lẻ:** Nhật ký hoạt động, Đồng bộ máy bán hàng, Xoá cache, Lịch sử giá món
  (`/admin/products/[id]/history`), `/admin/products/toppings`, Đổi mật khẩu
  (`/settings/password`).
- **Trang tạo mới còn dùng kiểu cũ** (`PageHeader` + form): Thương hiệu, Điểm bán,
  Khuyến mãi, Món, Nhóm món, Topping & tuỳ chọn, Sổ thu chi, Nhóm thu chi, Tài khoản ngân
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

## 5. Ô tiền tự thêm dấu chấm

Giá món, giá tuỳ chọn món, phiếu nhập, khuyến mãi, thanh lý tài sản. Chủ quán chốt
11/09/2026: làm sau báo cáo tài chính. Mục này sinh từ `it.todo` trong
`components/ui/MoneyInput.test.tsx`; xong thì đổi `it.todo` thành test xanh.

## 6. Dọn phần sót

File lớn chưa bước nào đụng (đo 2026-10-06): `app/pos/components/POSScreen.tsx` 1.144 dòng,
`app/pos/components/CartPanel.tsx` 689, `app/admin/reports/actions.ts` 898,
`app/admin/orders/actions.ts` 613. `lib/db/tables.ts` không còn nhắc bảng đã xoá (đã kiểm).
Mỗi lần dọn: mọi phép kiểm xanh và giá vốn tính lại ra đúng số cũ (đo lại trước khi dùng).

Code chết đã thấy, chỉ báo chưa xoá: `getCashEntries` (`app/admin/finance/actions.ts`),
`DeleteConfirmModal.tsx`, `ToppingsManager.tsx`.

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
| G1 | Sửa phiếu nhập mà đổi mặt hàng của một dòng: tài sản của dòng đó mất liên kết | Phần 1 (8b) |
| G2 | Phiếu nhập nháp luôn mở form nên không thấy nút "Huỷ phiếu" (đo 2026-10-06: 0 phiếu nháp) | Phần 1 (8b) |
| G3 | Tạo phiếu xuất: "Tồn hiện tại" là tồn hôm nay, và mặt hàng ngừng dùng đã hết hàng hôm nay không hiện để chọn; nhưng phiếu ghi lùi ngày được kiểm theo tồn ở ngày của phiếu | Phần 1 (8a) |
| G4 | Xoá nhân viên (`deleteUserAction`, `app/admin/users/actions.ts`): không chặn việc chủ quán tự xoá chính mình hay xoá tài khoản `ADMIN` cuối cùng | Phần 2 (Nhân viên) |
| G5 | 10 tài sản không còn dòng phiếu nhập — không cần làm gì, chỉ ghi nhận | — |

## File đã xoá ngày 2026-10-06

Mọi kế hoạch cũ trong `docs/superpowers/plans/` (44 file, đều đã làm xong) và 10 bản thiết
kế đã dựng xong, luật đã ghi sang `docs/02-rules/business-rules/`. Chỗ trích dẫn trong code
và tài liệu đã đổi sang mã luật. Migration giữ nguyên dòng trích dẫn cũ vì là lịch sử. Cần
xem lại nội dung cũ: `git log --diff-filter=D -- docs/superpowers/`.

Giữ lại bốn bản thiết kế còn dùng: bản cải tổ (`2026-09-28-cai-to-he-thong.md`), menu và
bảng màu (`2026-09-29-menu-va-khuon-trang-design.md`), khuôn trang
(`2026-10-02-khuon-danh-sach-chi-tiet-design.md`), lãi lỗ
(`2026-09-11-bao-cao-lai-lo-design.md`).
