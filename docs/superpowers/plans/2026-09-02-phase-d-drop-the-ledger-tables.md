# Giai đoạn D — xoá hẳn hai bảng sổ kho cũ

**Written 2026-09-02 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Việc cuối của chuỗi bắt đầu 28/08.** Kế hoạch gốc:
`docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md`.

**Xoá dữ liệu — `CLAUDE.md` mục 2 cấm theo mặc định.** Chủ quán chốt việc bỏ sổ
kho từ 28/08, và duyệt chạy giai đoạn D 02/09. **Không đảo ngược được.**

---

## 1. Hiện trạng

### 1.1 Hai bảng có mấy trạng thái, đặt bằng cách nào

Không có trạng thái. Chỉ có tồn tại hoặc bị xoá.

| Bảng | Số dòng | Ai còn ghi |
|---|---:|---|
| `stock_ledger` | **384** | **Không ai** — đóng băng từ 01/09 |
| `inventory_balances` | **129** | **Không ai** — chỉ đổi qua trigger bám vào bảng trên |

**Cả hai đều không có cột ngừng dùng**, nên không có đường "đánh dấu thôi dùng"
như `CLAUDE.md` mục 2 vẫn khuyên. Muốn giữ mà không dùng thì phải thêm cột.

**Một vết bẩn phải khai lại:** 129 dòng số dư là kết quả tôi chạy nhầm
`rebuild_inventory_balances` sáng 31/08. Trước đó 130 dòng. Mất một dòng, không
xác định được dòng nào. Bản sao lưu chụp **sau** sự cố đó.

### 1.2 Màn hình nào còn hiện số từ hai bảng

**Không còn màn hình nào.** Dòng cảnh báo "âm tồn kho" trên báo cáo Ngày đã gỡ
01/09 theo chủ quán chọn. Giai đoạn A đã xoá màn hình sổ kho.

### 1.3 Ai còn dùng — đo 02/09 trên máy chủ

| Nơi | Kết quả |
|---|---|
| **Khoá ngoại trỏ vào hai bảng** | **0** |
| **View / view vật chất đọc chúng** | **0** |
| **Hàm máy chủ dùng chúng** | **1** — `stock_ledger_apply_inventory_balance_delta`, chính là hàm trigger |
| **Trigger** | **1** — `trg_stock_ledger_inventory_balances` trên `stock_ledger` |

**Phía mã nguồn — chỉ 2 chỗ là lệnh thật, phần còn lại là chú thích:**

| Chỗ | Lệnh gì | Sau khi xoá bảng |
|---|---|---|
| `app/admin/inventory/purchase-orders/actions.ts:262` | `revalidateTag("sheets-Stock_Ledger")` | **Vô hại** — xoá nhãn của bảng không tồn tại là việc rỗng, không lỗi |
| `lib/historical/sheets-db-v2.ts:66` | **`insertMany("Stock_Ledger", ...)`** | **Sẽ lỗi nếu chạy** |

**Chỗ thứ hai đã chết:** hàm chứa nó là `insertOrderV2Records`, và **không file
nào gọi** — tra cả `app/`, `lib/`, `scripts/`, trừ chính nó và phép kiểm.

### 1.4 Xoá theo thứ tự nào, sai thì sao

Ba việc, và thứ tự có lý do:

| Thứ tự | Việc | Bỏ qua thì sao |
|---|---|---|
| 1 | Xoá **trigger** | Xoá bảng số dư trước khi gỡ trigger thì trigger trỏ vào bảng không còn |
| 2 | Xoá **`inventory_balances`** | — |
| 3 | Xoá **`stock_ledger`** | — |

**Hàm trigger `stock_ledger_apply_inventory_balance_delta` cũng phải xoá**, nếu
không nó thành hàm mồ côi trỏ vào hai bảng đã mất — và đó chính là thứ đã đánh
lừa phép quét của tôi ba lần trong tuần này.

**Không cần `CASCADE`**, vì không khoá ngoại nào trỏ vào (§1.3). **Nhưng phải
thử không có `CASCADE` trước** — nếu máy chủ từ chối thì tức là còn thứ gì phụ
thuộc mà §1.3 chưa thấy, và **phải dừng lại tìm hiểu**, không được thêm `CASCADE`
cho qua.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ hai bảng, một trigger, một hàm. **Cố ý không đụng:**

- **Không đụng `stock_issues`** — đường giá vốn thật, và là thứ duy nhất còn lại
- Không đụng `purchase_order_lines`, `orders_v2`, `stocktake_lines`
- **Không xoá `lib/historical/sheets-db-v2.ts`** dù nó đã chết — `CLAUDE.md` mục
  3 nói thấy code chết thì nói, đừng tự xoá. Ghi lại thành mục việc
- Không gỡ `revalidateTag("sheets-Stock_Ledger")` — vô hại, và gỡ nó là đụng
  đường đơn nhập cho một thứ không gây hại

### 1.6 Chỗ tôi CHƯA xem

- **`lib/sheets_db.ts` có liệt kê hai bảng trong danh sách nào không** — nếu có
  thì để lại cũng vô hại, nhưng chưa tra.
- **Sáu công cụ trong `scripts/`** đọc hai bảng (Sonnet nêu 01/09). Chúng là
  script chạy một lần đã xong; chạy lại sau khi xoá thì **báo lỗi to, không sai
  âm thầm**. Chưa tra từng cái.
- **Supabase có bản chụp tự động nào không** — nếu có thì "không đảo ngược được"
  ở §0 nói quá. Chưa tra, và **phải tra trước khi chạy**.

### 1.7 Ví dụ tính sẵn

**Kỳ kiểm kê `STK-001`** (09/08) và **phiếu xuất `ISS-00103`** — hai thứ từng
liên quan tới sổ kho nhiều nhất.

| | Trước | Sau |
|---|---|---|
| `stock_issues` — số dòng và tổng | không đổi | **không đổi** |
| Giá vốn từng tháng | không đổi | **không đổi** |
| Doanh thu 5 tháng | khớp | **khớp** |
| Đóng kỳ kiểm kê chạy được | có | **có** |
| Lưu phiếu xuất chạy được | có | **có** |

**Không dòng nào được đổi.** Nếu có dòng đổi thì việc dọn đường chưa xong, và
phải dừng.

## 2. Thay đổi

### 2.1 Trước khi chạy — hai việc bắt buộc

1. **Trả lời §1.6 về bản chụp tự động.** Nếu Supabase có bản chụp thì nói rõ
   mốc thời gian; nếu không thì xác nhận file sao lưu là bản duy nhất.
2. **Xác minh bản sao lưu đọc lại được** —
   `docs/audits/2026-08-31-stock-ledger-and-balances-backup.json`, 161 kB, ghi
   384 + 129 dòng. **Đọc lại từ đĩa và đối chiếu từng dòng với máy chủ**, không
   chỉ đếm. **Không khớp thì dừng.**

### 2.2 Một migration, bốn lệnh, đúng thứ tự

```
drop trigger trg_stock_ledger_inventory_balances on public.stock_ledger;
drop function public.stock_ledger_apply_inventory_balance_delta();
drop table public.inventory_balances;
drop table public.stock_ledger;
```

**Không `CASCADE`, không `if exists`.** Cả hai đều che lỗi: `CASCADE` kéo theo
thứ mình chưa biết, `if exists` biến "không tìm thấy" thành im lặng. Muốn biết
đúng cái gì bị xoá thì để nó nổ nếu sai.

**Không chạy.** Chủ quán duyệt lần chạy riêng.

## 3. Kiểm chứng

- **Trước khi chạy:** đối chiếu bản sao lưu với máy chủ **từng dòng** (§2.1).
- **Sau khi chạy, hỏi máy chủ:** hai bảng, trigger, hàm trigger — **cả bốn phải
  không còn**. Và **không hàm nào còn nhắc tới chúng**, tra bằng
  `pg_get_functiondef` **bỏ chú thích trước khi tìm**.
- **Ví dụ §1.7 phải đứng yên toàn bộ.**
- **Đóng thử một kỳ kiểm kê** (`p_dry_run`) và **lưu một phiếu xuất thật** — hai
  đường từng đụng sổ kho nhiều nhất.
- **Doanh thu 5 tháng khớp**, `stock_issues` đếm và tổng bằng nhau.
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. **Viết migration, KHÔNG chạy.** Không tự đẩy.

**Rồi chủ quán tự làm:** bán một ly, lưu một phiếu xuất, mở màn hình Kiểm kê.

**Sau việc này sổ kho cũ biến mất hẳn khỏi hệ thống**, và giá vốn chỉ còn chạy
trên một đường duy nhất — phiếu xuất kho (`BR-COGS-005`). Ghi vào
`docs/BUSINESS-RULES.md` cùng phiên (`CLAUDE.md` §8).
