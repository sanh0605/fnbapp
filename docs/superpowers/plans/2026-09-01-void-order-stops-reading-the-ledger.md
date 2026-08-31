# Hàm huỷ đơn thôi đọc sổ kho — chỗ chặn thứ tư

**Written 2026-09-01 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Chỗ chặn cuối cùng của giai đoạn D.** Ba chỗ kia xong 01/09.

**Nó bị bỏ sót vì phép quét của tôi hỏng**, không phải vì khó thấy — chi tiết ở
mục 5.2 của `docs/superpowers/plans/2026-09-01-phase-d-blockers.md`. Phép quét
loại bỏ mọi hàm từng bị lệnh `drop` chạm tới, mà giai đoạn C xoá rồi dựng lại
ngay. **Từ nay hỏi máy chủ bằng `pg_get_functiondef`, đừng ghép file migration.**

---

## 1. Hiện trạng

### 1.1 Hàm này có mấy nhánh, và mỗi nhánh vào khi nào

`void_order_atomic` (bản mới nhất: `0080_retire_ledger_void_order.sql`) đọc sổ
kho **hai chỗ**, cả hai hỏi cùng một câu: *đơn này đã có dòng `EDIT_REVERSAL`
trong sổ chưa?*

| Chỗ | Dòng | Dùng để | Vào khi nào |
|---|---|---|---|
| `v_has_reversal` | 86 | Chặn không cho huỷ, ném lỗi *"incomplete legacy void state"* | Mọi lần huỷ đơn |
| `v_reversal_count` | 97 | Trả về trong kết quả | Chỉ khi đơn **đã huỷ rồi** |

### 1.2 Màn hình có nút gì

Nút **Huỷ đơn** trong màn hình Đơn hàng. Không có ô nhập nào liên quan tới sổ
kho. Người dùng không thấy hai câu đọc này — chỉ thấy hậu quả nếu chốt nổ.

### 1.3 Chốt này chặn được bao nhiêu đơn — đo, không suy

| Phép đo 01/09 | Kết quả |
|---|---:|
| Dòng sổ kho hiện tại | **384** |
| Trong đó loại `EDIT_REVERSAL` | **0** |
| Số đơn bị chốt này chặn | **0** |
| Loại thật sự có trong sổ | `PO_RECEIPT` 300, `STOCK_ADJUST` 84 |

**Và trước đây cũng chưa từng có.** Bản sao lưu sổ kho đã xoá hồi 23/07
(`docs/audits/2026-07-23-deleted-stock-ledger-backup.json`, **10.734 dòng**)
chứa bốn loại: `PRODUCTION_CONSUME` 5.600, `RECLASSIFICATION_REVERSAL` 3.520,
`SALES_CONSUME` 807, `PRODUCTION_YIELD` 807. **Không có `EDIT_REVERSAL`.**

**Chốt này chưa bao giờ chặn được gì, trong toàn bộ lịch sử còn nhìn thấy được.**

**Phép đo này KHÔNG cho thấy điều gì:** nếu có dữ liệu sổ kho bị xoá **trước**
23/07 mà không nằm trong bản sao lưu đó, tôi không biết. Đây là bằng chứng tốt
nhất có được, không phải bằng chứng tuyệt đối.

### 1.4 Giá trị trả về — ai đọc, và bỏ đi thì sao

Hàm trả về ba khoá: `order_id`, `reversal_count`, `already_voided`.

| Khoá | Ai đọc |
|---|---|
| `reversal_count` | `lib/void-order-transaction.ts` dịch thành `reversalCount`… rồi **không ai dùng**. Chỗ gọi duy nhất (`app/admin/orders/actions.ts:418`) gọi `await` mà **không lấy kết quả**. Ngoài ra chỉ có **phép kiểm** đọc |
| `already_voided` | cùng tình trạng |

**Đây đúng cái bẫy `0076`, nhưng lần này ngược chiều thuận lợi:** ngày 30/08 một
kế hoạch bỏ giá trị trả về mà quên chỗ đọc, làm hỏng mọi phiếu xuất. Lần này
**không có chỗ đọc thật nào** — nhưng phải chứng minh bằng phép tra, không phải
bằng câu này.

**Vẫn nên giữ khoá `reversal_count`, trả về 0.** Bỏ hẳn khoá là đổi hình dạng
kết quả — việc khác, lợi ít, rủi ro thật. Giữ khoá thì `lib/` không phải sửa
dòng nào.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ hai câu đọc trong một hàm. **Cố ý không đụng:**

- **Không đổi hình dạng kết quả trả về** — giữ đủ ba khoá
- Không đụng chốt kiểm `order_events` (dòng 77–82) — nó đọc bảng khác, còn sống
- Không đụng phần ghi sự kiện huỷ đơn
- **Không xoá bảng nào.** Giai đoạn D là việc riêng, chủ quán duyệt riêng

### 1.6 Chỗ tôi CHƯA xem

- **Chốt `order_events` có thay được chốt sổ kho không** — hai chốt này cùng
  hỏi "đơn có trạng thái huỷ dở dang không" theo hai đường. Chưa xem đường kia
  có đủ chặt không. **Nếu đủ thì bỏ chốt sổ kho không mất gì cả**, và đó là câu
  Sonnet phải trả lời trước khi sửa.
- **`RECLASSIFICATION_REVERSAL` trong bản sao lưu có phải cùng ý nghĩa không** —
  tên gần giống `EDIT_REVERSAL`. Chưa tra. Nếu nó là tên cũ của cùng một khái
  niệm thì kết luận §1.3 phải viết lại.

### 1.7 Ví dụ tính sẵn

**Đơn `260831002002`** (bán 31/08, đã hoàn tất). Hôm nay bấm Huỷ:

| Bước | Hôm nay | Sau khi sửa |
|---|---|---|
| Hỏi sổ kho có dòng đảo không | có hỏi, trả lời **không** | **không hỏi nữa** |
| Chốt có nổ không | không | không |
| Ghi sự kiện huỷ | có | **có** |
| `reversal_count` trả về | 0 | **0** |

**Không có gì đổi từ phía chủ quán.** Đó là điều phải chứng minh, không phải
điều mong đợi.

## 2. Thay đổi

1. **Trả lời §1.6 trước.** Nếu chốt `order_events` đủ chặt thì nói rõ; nếu
   không thì nói rõ bỏ chốt sổ kho mất gì.
2. **Bỏ hai câu `select ... from public.stock_ledger`** (dòng 86, 97). Cho
   `v_has_reversal := false` và `v_reversal_count := 0`, **ghi rõ trong chú
   thích vì sao** — kèm số đo §1.3, để người sau không tưởng là bỏ ẩu.
3. **Giữ nguyên ba khoá trả về.** Không đụng `lib/void-order-transaction.ts`.
4. **Chép nguyên phần còn lại**, kỷ luật `0074`. Một migration, **không chạy**.

## 3. Kiểm chứng

- **Hỏi máy chủ, đừng ghép file:** sau khi chạy, `pg_get_functiondef` của mọi
  hàm còn sống — **bỏ chú thích trước khi tìm** — chỉ được còn **đúng một** hàm
  nhắc tới hai bảng, là hàm trigger. Đây là phép đo đúng đắn thay cho phép quét
  hỏng đã bỏ sót chính việc này.
- **Huỷ một đơn thật** bằng script trên dữ liệu thật, trước và sau: đơn phải
  chuyển sang trạng thái huỷ, sự kiện phải ghi, kết quả trả về phải đủ ba khoá.
- **Huỷ lại một đơn đã huỷ** — nhánh dòng 97 chỉ vào trường hợp này, và nó là
  nhánh dễ quên nhất.
- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa.** Nói rõ đỏ vì **giá
  trị sai** hay vì **thiếu hàm**.
- **Doanh thu không đổi:** chạy `scripts/verify-revenue.ts`, năm tháng khớp.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. **Viết migration, KHÔNG chạy.** Không tự đẩy. Đẩy code trước,
chủ quán huỷ thử một đơn trên web, **rồi mới** chạy migration.

**Sau đợt này giai đoạn D hết chặn hoàn toàn** — chỉ còn hàm trigger, mà nó bị
xoá cùng bảng. Việc xoá vẫn là một lần hỏi riêng, **không đảo ngược được**, và
bản sao lưu đã có (`docs/audits/2026-08-31-stock-ledger-and-balances-backup.json`).
