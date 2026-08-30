# Equipment leaves through the asset register, not through a stock issue

**Written 2026-08-31 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1).

**First plan written under `CLAUDE.md` §1b.** Changing things that exist, so:
current-state description below, then the change. `OPEN-ITEMS 77`, plus the
date half of `OPEN-ITEMS 78`.

---

## 1. Hiện trạng — mô tả để chủ quán bác, không phải câu hỏi để ông trả lời

### 1.1 Màn hình Phiếu Xuất Kho

**Danh sách mặt hàng chứa gì.** Mọi mặt hàng `ACTIVE`, trừ hai loại: nguyên liệu
đã đánh dấu *không quản lý tồn*, và mặt hàng đã ngừng dùng mà tồn đã hết. Đo
31/08 — trong danh sách có **65 dụng cụ, 27 nguyên liệu, 18 vật tư tiêu hao**.
**Dụng cụ là nhóm đông nhất.**

**Ba lý do xuất, chọn một cho cả phiếu:** *Hao hụt / hư hỏng*, *Dùng nội bộ*,
*Khác*. Lý do chỉ đi vào phần ghi chú — máy chủ không phân biệt, và **không lý
do nào đưa tiền đi đường khác**.

**Ô số lượng** nhân với hệ số quy cách trước khi gửi: chọn `Cây 50 Cái` gõ 10 là
xuất 500. Máy chủ từ chối nếu vượt tồn tại thời điểm xuất, và nếu chưa có đơn
nhập nào trước thời điểm đó.

**Thời điểm xuất** áp cho cả phiếu, lùi ngày được, và nó quyết định tháng nào
gánh chi phí.

**Nút:** *Ghi phiếu xuất*, *Đảo dòng* cho từng dòng, *Huỷ cả phiếu*. Đảo và huỷ
đều tạo bản ghi bù, không xoá.

### 1.2 Sổ Tài Sản

**Một nút duy nhất rời khỏi sổ:** ô nhập gồm **số lượng**, **ngày** (nhãn *"Ngày
thanh lý"*), **lý do** (chữ tự do). Có xem trước số tiền sẽ bị tính.

**Máy chủ kiểm gì:** tài sản có tồn tại không; số lượng phải là số dương; số
lượng không vượt phần còn lại; **ngày chỉ cần khác rỗng**.

**Ngày đó làm gì:** phần giá trị chưa khấu hao hết của đúng số lượng đó bị dồn
thành một khoản chi **trong tháng của ngày ấy**.

### 1.3 Chỗ hai hệ thống không nói chuyện với nhau

**Kiểm kê đã loại dụng cụ từ lâu** — `stocktake/actions.ts:208` ghi thẳng
*"equipment is never stocktaken -- a fixed property of the EQUIPMENT
category"*.

**Nhưng phiếu xuất thì không.** Cùng một danh mục, một màn hình bảo "không phải
hàng tồn", màn hình kia bảo "là hàng tồn". **Hệ thống đã quyết rồi, chỉ quyết ở
một chỗ.**

Và bộ máy tính giá vốn **không lọc danh mục** — tra `EQUIPMENT`/`system_type`
trong `lib/issue-costing-inputs.ts` và `lib/issue-costing.ts`: **0 kết quả**.

### 1.4 Chỗ tôi CHƯA xem

- **Màn hình Điều chỉnh Tồn kho** (`stock-adjustments`) — chưa kiểm nó có mời
  dụng cụ không. Nếu có thì đây là cửa thứ ba cho cùng một lỗi.
- **Máy POS** đọc bảng số dư để hiện còn/hết hàng — chưa kiểm dụng cụ có lọt
  vào đó không.
- **Báo cáo hàng đã xuất** (`reports/issued`) — chưa kiểm nó gộp danh mục thế
  nào.
- **Nhãn "Ngày thanh lý"** dùng chung cho cả *hỏng vứt đi* lẫn *bán thanh lý*.
  Chưa xem nên đổi tên thành gì; đó là phần của `OPEN-ITEMS 78` và **không nằm
  trong kế hoạch này**.

## 2. Hai lỗi, và cái nào nặng hơn

**Tính tiền hai lần.** Xuất một cái `Máy đánh bọt` là ghi toàn bộ tiền của nó
vào giá vốn, trong khi sổ tài sản vẫn khấu hao đúng cái máy đó qua 12/24/36
tháng. Hai hệ thống không biết nhau. **Chưa xảy ra lần nào — 0 lần xuất kho
dụng cụ từ trước tới nay** — nhưng không có gì chặn.

**Ngày thanh lý không bị kiểm.** Chọn ngày tương lai thì khoản chi rơi vào tháng
chưa tới; chọn ngày trước cả ngày mua thì rơi vào tháng tài sản chưa tồn tại.
Đo 31/08: **1 lần thanh lý, ngày hợp lệ** — chưa sai, cũng chưa có gì chặn.

## 3. Thay đổi

1. **Bỏ dụng cụ khỏi danh sách phiếu xuất**, dùng đúng phép thử kiểm kê đã dùng
   (`system_type === "EQUIPMENT"`), **không viết phép thử thứ hai**.
2. **Chặn thêm ở bộ máy tính giá vốn**: một dòng xuất trỏ vào dụng cụ không được
   vào dòng *Giá vốn*. Lớp này bảo vệ cả những phiếu lỡ ghi trước khi màn hình
   đổi — hôm nay là 0, nhưng lớp chặn không nên phụ thuộc vào con số đó.
3. **Ngày thanh lý phải nằm trong khoảng** từ `acquired_date` tới hôm nay, kiểm
   ở **máy chủ** chứ không chỉ ở ô nhập. Câu từ chối phải nói rõ khoảng hợp lệ,
   không chỉ nói "không hợp lệ".

**Không đụng** tới nhãn *"Ngày thanh lý"*, ô tiền thu hồi, hay việc tách *hỏng*
với *thanh lý* — đó là `OPEN-ITEMS 78`, và nó đẻ ra một dòng trong báo cáo lãi
lỗ nên thuộc đợt làm báo cáo.

## 4. Kiểm chứng

- **Viết phép kiểm trước, và nó phải đỏ vì GIÁ TRỊ**: danh sách phiếu xuất không
  còn dụng cụ nào. Hôm nay nó có 65. Nói rõ đỏ vì giá trị hay vì thiếu hàm.
- **Phép kiểm ngược, bắt buộc**: nguyên liệu và vật tư tiêu hao **vẫn còn** trong
  danh sách. Thiếu nó thì "lọc sạch danh sách" cũng qua được.
- **Kiểm kê vẫn không có dụng cụ** — chứng minh không ai gộp hai phép lọc lại.
- **Lớp chặn giá vốn có phép kiểm riêng**, không dựa vào việc màn hình đã lọc.
- **Ngày thanh lý**: từ chối ngày tương lai, từ chối ngày trước ngày mua, **chấp
  nhận ngày lùi hợp lệ** — cái thứ ba quan trọng nhất, vì lùi ngày là việc chủ
  quán thật sự làm.
- Đủ `CLAUDE.md` §9.

## 5. Xong nghĩa là

`CLAUDE.md` §9. Không tự đẩy. **Rồi chủ quán mở Phiếu Xuất Kho và tìm một món
dụng cụ — phải không tìm thấy.** Và thử đánh dấu hỏng một tài sản với ngày tháng
trước — phải nhận.

---

## 6. Hai chỗ mục 1 mô tả SAI — Sonnet bắt được

**Đây là lần đầu `CLAUDE.md` §1b được dùng, và nó bắt đúng thứ nó sinh ra để
bắt: sai trong phần mô tả, không phải sai trong phần đề xuất.**

**§1.1 tả lỗi thời.** Tôi viết danh sách chỉ loại món tồn 0 *khi món đã ngừng
dùng*. Đúng cho tới 30/08 — nhưng chính `OPEN-ITEMS 76` hôm đó đã đổi thành
**loại mọi món tồn 0, bất kể trạng thái** (`issue-slips/actions.ts:128`,
`.filter(item => item.onHand > 0)`, không có nhánh nào theo trạng thái). Tôi tả
hiện trạng của hôm trước.

**§2 đúng một nửa, và nửa sai quan trọng hơn.** Tôi viết *"ngày thanh lý không
bị kiểm"*. Thật ra `lib/asset-depreciation.ts:217` **đã chặn** ngày trước ngày
mua từ đợt 3, có phép kiểm hẳn hoi.

**Nhưng nó không nói được.** Câu chặn viết bằng tiếng Anh thuần ASCII —
`"disposal dated before the asset was acquired"` — và `describeActionError` chỉ
giữ nguyên câu **có dấu tiếng Việt**, nên nó bị thay bằng *"Có lỗi xảy ra, vui
lòng thử lại"*.

Nên chủ quán **đã bị chặn từ trước**, chỉ là màn hình không cho biết vì sao.
Đây là `OPEN-ITEMS 62` xảy ra thật lần đầu — mục đó ghi bộ lọc "tin mọi ký tự
không phải ASCII" có lỗ, và đây đúng là cái lỗ ấy. **Sửa đúng chỗ là viết lại
câu chặn bằng tiếng Việt, không phải thêm một lớp chặn nữa.**

Chỉ nửa *ngày tương lai* là đúng như tả: không có gì chặn, ghi thẳng vào.

**Bốn chỗ §1.4 ghi là chưa xem, Sonnet xem hết:**

| Chỗ | Kết quả |
|---|---|
| Màn hình Điều chỉnh Tồn kho | Đường tạo **không ai gọi**, bảng **0 dòng** — không mời dụng cụ được |
| Máy POS đọc số dư | Chỉ đọc nhóm nguyên liệu và bán thành phẩm, **không chạm hàng mua vào** |
| Báo cáo hàng đã xuất | **Có dính cùng lỗi** — nhưng dùng chung một bộ máy, nên lớp chặn ở §3.2 vá luôn, không cần chỗ thứ tư |
| Nhãn "Ngày thanh lý" | Cố ý để ngoài |

**Ghi danh sách "chưa xem" ra đã đáng công:** một trong bốn chỗ đó thật sự có
lỗi, và nó được vá miễn phí thay vì được phát hiện sau ba tuần.
