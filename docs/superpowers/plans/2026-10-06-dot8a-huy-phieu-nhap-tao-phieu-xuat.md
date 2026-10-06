# Đợt 8a — trang Huỷ phiếu nhập và trang Tạo phiếu xuất, đủ hai bố cục

Phần 1 của kế hoạch chung `docs/superpowers/plans/2026-10-06-ke-hoach-chung.md`.
Xoá file này khi đợt 8a xong.

Chủ quán, 2026-10-06: trang huỷ phiếu nhập *"trông rất trống rỗng và chưa tối ưu được diện
tích sử dụng phụ thuộc theo màn hình"*; *"trang tạo phiếu xuất em cũng chưa thiết kế lại"*;
mọi lần sửa giao diện *"phải làm luôn cả phần responsive"*.

Sửa thứ đã có, không bảng mới, không trang mới: thiết kế rút gọn nằm ngay trong file này.

## Hiện trạng

1. **Trạng thái.**
   - Trang huỷ: ba trạng thái, do máy chủ đặt qua `getPurchaseOrderCancelView`: chưa cập
     nhật dữ liệu (`missing-migration`), bị chặn (có câu từ chối), sẵn sàng huỷ. Không đổi.
   - Trang tạo phiếu xuất: đang nhập, đang ghi (nút quay). Không đổi.
2. **Nút.**
   - Trang huỷ: "Xác nhận huỷ" (chỉ hiện khi không bị chặn, mờ khi lý do trống), "Quay lại".
     Không thêm nút.
   - Trang tạo: "+ Thêm mặt hàng", "✕" xoá dòng (ẩn khi chỉ còn một dòng), "Ghi phiếu xuất
     (N dòng)". Thêm "Quay lại" về danh sách Phiếu xuất cạnh nút ghi trên máy tính, cho giống
     trang huỷ và trang sửa.
3. **Danh sách.**
   - Trang huỷ thêm bảng **hàng trong phiếu** (mặt hàng, đơn vị, số lượng, đơn giá, thành
     tiền), đúng như trang chi tiết phiếu nhập, xếp theo thứ tự dòng đã nhập. Bảng **tài sản sẽ
     ngừng** giữ nguyên nội dung. Không loại dòng nào.
   - Trang tạo: danh sách mặt hàng để chọn giữ nguyên (`getIssueSlipFormData`).
4. **Ô nhập.**
   - Lý do huỷ: bắt buộc, tối đa 500 ký tự, như cũ.
   - Số lượng phiếu xuất: số lớn hơn 0, dấu phẩy là dấu thập phân, như cũ. Thời điểm xuất: ô
     24 giờ giờ Sài Gòn, ghi lùi ngày thì hỏi có/không, như cũ.
5. **Dữ liệu.** Chỉ đọc thêm cho trang huỷ (dòng hàng, tiền hàng, phí, thuế, giảm giá, mã hoá
   đơn, nguồn nhập, ghi chú). Không ghi gì mới, không đổi cách tính, không migration.

Thêm, riêng cho việc này:
6. **Màn hình cỡ vừa (1024px).** Bảng không tràn ngang; khối bên phải của trang huỷ xuống dưới
   bảng khi hẹp hơn 1024px.
7. **Phiếu nhập không có dòng nào** (phiếu cũ từ tồn đầu kỳ): bảng hiện đúng câu trang chi tiết
   đang hiện.

Đã xem: `app/admin/inventory/purchase-orders/[id]/page.tsx`, `[id]/cancel/page.tsx`,
`CancelPurchaseOrderForm.tsx`, `getPurchaseOrderCancelView`, `issue-slips/new/page.tsx`,
`IssueSlipClient.tsx`, bảng sửa trong `IssueSlipDetailClient.tsx`, `components/ui/detail/*`.
Chưa xem: hai trang ở cỡ 1024px trên trình duyệt (xem sau khi dựng).

## Ví dụ bằng số thật (đo 2026-10-06, chỉ đọc)

Phiếu `PO-195`, một dòng `POL-24a1a94b-e556-41ec-8786-52bfa0b77915`: 20 Túi `Bột cà phê
MR.PHIN Robusta Dak Mil` × 157.000đ = 3.140.000đ. Phí vận chuyển +59.600đ, thuế 0, voucher
và giảm giá −756.200đ (656.200 + 100.000). Tổng cộng 2.443.400đ. Trang huỷ hiện đúng các số
này, giống trang chi tiết `PO-195`.

## Thiết kế

**Trang huỷ — máy tính (từ 1024px):** cùng bố cục trang chi tiết phiếu nhập. Đầu trang: "←
Phiếu nhập PO-195", tên "Huỷ phiếu nhập PO-195", dòng phụ ngày nhập và nhà cung cấp. Thân
chia 3 phần: hai phần trái là bảng hàng trong phiếu, dưới nó là bảng tài sản sẽ ngừng (nếu
có); một phần phải là khối tiền (giống khối "Thông tin thanh toán"), dưới nó là khối huỷ: câu
hậu quả, ô lý do, "Xác nhận huỷ" và "Quay lại". Bị chặn: khối huỷ thay bằng khung đỏ chứa câu
từ chối và nút "Quay lại". Không còn `max-w-2xl` dính trái.

**Trang huỷ — điện thoại:** xếp dọc: khối tiền, dòng hàng thành thẻ, tài sản thành thẻ, khối
huỷ ở cuối, nút chiếm hết bề ngang.

**Trang tạo phiếu xuất — máy tính:** khung rộng như trang sửa ISL-00083. Đầu trang theo khuôn.
Một khung trên cùng: thời điểm xuất, cảnh báo ghi lùi ngày, "Đã điền đủ N/M dòng". Dưới là
bảng thật: Mặt hàng · Tồn hiện tại · Đơn vị · Số lượng · Quy ra · ✕, dòng cuối bảng là "+ Thêm
mặt hàng". Cuối trang bên phải: "Quay lại", "Ghi phiếu xuất (N dòng)".

**Trang tạo phiếu xuất — điện thoại:** giữ thẻ từng dòng như hiện nay, khung thời điểm ở trên,
nút ghi chiếm hết bề ngang ở cuối.

## Việc

1. **Sonnet** — `getPurchaseOrderCancelView` trả thêm dòng hàng và các khoản tiền
   (`app/admin/inventory/purchase-orders/actions.ts`, test trong `actions.cancel.test.ts`, ví
   dụ `PO-195` ở trên).
2. **Gemini** — dựng lại hai trang theo mục Thiết kế, giữ mọi test hiện có, thêm test cho bảng
   dòng hàng của trang huỷ và bảng của trang tạo trên máy tính.
3. **Opus** — soát, chạy năm cửa kiểm, mở hai trang ở 1568px, 1024px, 390px trên máy chạy thử
   (chỉ xem, không bấm "Xác nhận huỷ" hay "Ghi phiếu xuất"), sửa flow doc, lưu.

## Lỗ hổng gặp ở trang này, báo chủ quán riêng

G3 của kế hoạch chung: "Tồn hiện tại" là tồn hôm nay, mặt hàng ngừng dùng đã hết hàng hôm nay
không hiện để chọn, nhưng phiếu ghi lùi ngày được kiểm theo tồn ở ngày của phiếu. Không sửa
trong đợt này.
