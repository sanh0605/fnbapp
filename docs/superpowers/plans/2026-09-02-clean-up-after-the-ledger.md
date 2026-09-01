# Dọn phần thừa sau khi sổ kho biến mất

**Written 2026-09-02 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Giai đoạn D chạy xong 02/09.** Hai bảng, trigger và hàm trigger đã biến mất.
Còn lại một ít thứ trỏ vào chỗ trống.

**Không có gì gấp ở đây.** Không màn hình nào hỏng, không con số nào sai. Việc
này để **danh sách việc treo còn đáng tin** — thứ đã khiến việc bị làm trùng ba
lần hồi tháng 8.

---

## 1. Hiện trạng

### 1.1 Có mấy loại thứ còn sót, và mỗi loại nguy tới đâu

| Loại | Số chỗ | Chạy vào thì sao |
|---|---:|---|
| Chú thích nhắc tên bảng cũ | nhiều | Vô hại, nhưng gây hiểu nhầm |
| Lệnh xoá bộ nhớ tạm của bảng đã mất | **1** | **Vô hại** — xoá nhãn không tồn tại là việc rỗng |
| Mã đọc/ghi thật vào bảng đã mất | **4 file** | **Lỗi ngay nếu chạy** |
| Mục trong danh sách việc treo đã hết nghĩa | **ít nhất 1** | Gây làm trùng |

### 1.2 Màn hình nào có nút gì

**Không áp dụng.** Không màn hình nào của chủ quán đụng tới những chỗ này —
đã tra `app/` và không có đường nào dẫn tới.

### 1.3 Bốn file đọc/ghi thật — ai gọi chúng

| File | Lệnh gì | Chỗ gọi |
|---|---|---|
| `lib/historical/backdated-ledger/recompute-event.ts` | `findAllNoCache("Stock_Ledger")` | 3 script chạy tay |
| `lib/historical/backdated-recipe-events/recompute-event.ts` | như trên | 3 script chạy tay |
| `lib/historical/history-ops/task-3-recovery.ts` | đọc ảnh chụp `stock_ledger` | 1 file `lib/` + 2 script |
| `lib/historical/sheets-db-v2.ts` | **`insertMany("Stock_Ledger", ...)`** | **không ai gọi** |

**Không file nào có đường dẫn từ `app/`** — tra rồi, rỗng. Nên **chủ quán không
thể chạm phải chúng** qua giao diện.

**Đây không phải "mã chết" theo nghĩa thường.** Mã chết thì nằm im vô hại. Mấy
file này **sẽ nổ nếu ai chạy** — và nổ to, báo lỗi rõ, không sai âm thầm. Đó là
điểm khác quan trọng: chúng an toàn theo kiểu ồn ào, không phải theo kiểu vô hại.

### 1.4 Xoá hay giữ — và luật nói gì

`CLAUDE.md` mục 3: *"Thấy code chết không liên quan thì nói, đừng tự xoá."*

**Nên đợt này KHÔNG xoá file nào.** Việc cần làm là **ghi rõ chúng đã hỏng**,
ngay trong chính file, để người sau mở ra là biết — chứ không phải chạy rồi mới
biết.

**Lý do không xoá, nói cho đủ:** mấy file này là công cụ điều tra lịch sử. Chúng
đã dùng xong, nhưng **cách chúng tính lại lịch sử** là thứ duy nhất còn ghi lại
việc đó đã làm thế nào. Xoá đi là mất bản ghi, và mất nó chẳng đổi lấy gì.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ chú thích, một lệnh vô hại, và danh sách việc treo. **Cố ý không đụng:**

- **Không xoá file nào** (§1.4)
- **Không đụng `stock_issues`** — đường giá vốn duy nhất còn lại
- Không sửa `scripts/` ngoài việc ghi chú
- Không đụng phép kiểm nào đang xanh

### 1.6 Chỗ tôi CHƯA xem

- **`types/db.ts` còn kiểu dữ liệu cho hai bảng không** — chưa tra. Nếu còn thì
  vô hại, nhưng gây hiểu nhầm.
- **Còn mục nào khác trong danh sách việc treo đã hết nghĩa không** — mới soi
  đúng mục 36. Đáng rà cả danh sách, vì đó là điểm của đợt này.
- **Mục 18 nói kiểm kê "chưa dùng lần nào"** — sai từ 09/08, và tôi đo hôm nay
  ra **2 kỳ** (`STK-001` đã chốt, `STK-002` đã huỷ). Chưa đọc kỹ mục đó nói gì.

### 1.7 Ví dụ tính sẵn

**Mục 36** — *"mã `STK-` đặt tên cho hai không gian khác nhau"*: một là mã kỳ
kiểm kê, hai là mã dòng sổ kho.

| | Trước 02/09 | Sau |
|---|---|---|
| Không gian mã `STK-` | **2** | **1** — sổ kho không còn |
| Mục 36 còn nghĩa | có | **không** |

**Đây là mục tự hết nghĩa vì việc khác**, không phải ai sửa. Đúng loại mục làm
danh sách mất tin cậy nếu để nguyên.

## 2. Thay đổi

1. **Ghi chú vào bốn file ở §1.3**: nói rõ chúng đọc/ghi bảng đã xoá 02/09, nên
   **sẽ lỗi nếu chạy**, và giữ lại chỉ để làm bản ghi lịch sử. **Không xoá.**
2. **Gỡ `revalidateTag("sheets-Stock_Ledger")`** ở
   `app/admin/inventory/purchase-orders/actions.ts` — vô hại nhưng vô nghĩa.
   **Đây là đường đơn nhập**, nên chỉ gỡ đúng dòng đó, không đụng gì khác.
3. **Rà danh sách việc treo**, đóng những mục đã hết nghĩa — bắt đầu từ mục 36,
   và trả lời §1.6 về mục 18. **Với mỗi mục đóng, ghi rõ vì sao và đo bằng gì**,
   đừng chỉ gạch đi.
4. **Trả lời §1.6 về `types/db.ts`**, xử lý nếu còn.

## 3. Kiểm chứng

- **Không hàm máy chủ nào, không màn hình nào đổi hành vi.** Đợt này chỉ đụng
  chú thích, một dòng vô nghĩa, và tài liệu.
- **Lưu một đơn nhập hàng thật** sau khi gỡ dòng ở §2.2 — đó là đường tiền, và
  là chỗ duy nhất đợt này chạm vào mã đang chạy.
- **Mỗi mục việc treo đóng lại phải kèm phép đo**, không phải kèm lập luận.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. Không ghi dữ liệu, không migration, không tự đẩy.

**Rồi chủ quán lưu một đơn nhập hàng** — việc duy nhất đợt này chạm tới.
