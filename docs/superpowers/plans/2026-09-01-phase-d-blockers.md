# Gỡ ba chỗ chặn trước khi xoá hai bảng sổ kho

**Written 2026-09-01 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). Sửa thứ đã có → năm mục mô tả hiện trạng, đánh số.

**Đây là việc dọn đường cho giai đoạn D**, không phải giai đoạn D. Việc xoá bảng
là quyết định riêng của chủ quán, và **không đảo ngược được** — nên tách hẳn.

Kế hoạch gốc: `docs/superpowers/plans/2026-08-28-retire-the-stock-ledger.md`,
mục 5c.4 liệt kê ba chỗ chặn này.

---

## 1. Hiện trạng

### 1.1 Hai bảng này có mấy trạng thái, đặt bằng cách nào

| Bảng | Số dòng | Ai còn ghi |
|---|---:|---|
| `stock_ledger` | **384** | **Không ai.** Đóng băng từ 01/09, sau 9 migration |
| `inventory_balances` | **129** | **Không ai.** Nó chỉ được cập nhật bởi một trigger bám vào `stock_ledger` |

**Trigger là mấu chốt:** `inventory_balances` không có đường ghi riêng. Nó đổi
khi và chỉ khi `stock_ledger` có dòng mới. Sổ đóng băng thì số dư đóng băng theo.

**Một vết bẩn phải khai:** 129 dòng này là kết quả tôi chạy nhầm
`rebuild_inventory_balances` sáng 31/08 (mục 5b của kế hoạch gốc). Trước đó là
130 dòng. Mất một dòng, không xác định được dòng nào.

### 1.2 Màn hình nào còn hiện số từ hai bảng này

**Đúng một chỗ:** báo cáo Ngày, dòng cảnh báo *"N nguyên liệu/bán thành phẩm
đang âm tồn kho"* (`app/admin/reports/daily/page.tsx`).

Đường đi: `getRealtimeStock()` → đọc `Inventory_Balances`, ghép với nhóm nguyên
liệu và bán thành phẩm → báo cáo lọc lấy mục có tồn dưới 0.

**Đo 01/09 — dòng này hiện báo `0` mục.** Không phải "ít", mà là không có gì.

| Nguồn nó gộp | Số mục |
|---|---:|
| Bán thành phẩm | **0** (đã xoá hết 31/08) |
| Nhóm nguyên liệu (sau khi bỏ loại "mua dùng ngay") | 39 |
| Trong đó có tồn khác 0 | 24 |
| **Trong đó tồn ÂM** | **0** |

Nói cách khác: **dòng cảnh báo này chỉ còn có thể báo 0, hoặc báo một con số cũ
không ai cập nhật.** Nó không còn là cảnh báo thật.

### 1.3 Ba chỗ chặn — cái gì thật sự chạy, cái gì chỉ nằm đó

| # | Chỗ | Đọc gì | Có chạy thật không |
|---|---|---|---|
| 1 | Báo cáo Ngày | `Inventory_Balances` | **Có chạy**, mỗi lần mở báo cáo. Kết quả luôn là 0 |
| 2 | `apply_stocktake_session_atomic` dòng 121 | `stock_ledger` | **Chưa bao giờ** — nhánh này chỉ vào khi đếm trực tiếp nguyên liệu gốc, mà cả 50 dòng kiểm kê đều là hàng mua |
| 2 | cùng hàm, dòng 229 | `stock_ledger` | **Có chạy** — nhưng chỉ nuôi **cột hiển thị**, không nuôi phép tính chênh lệch |
| 3 | `save_stocktake_line_atomic` dòng 135 | `stock_ledger` | **Chưa bao giờ** — cùng nhánh `else` như số 2 |

**Ba trong bốn chỗ đọc chưa từng chạy.** Nhưng xoá bảng thì cả bốn đều thành lỗi
lúc chạy, không phải trả về 0 — Postgres không kiểm tên bảng cho tới lúc câu
lệnh thật sự được gọi.

**Chỗ duy nhất đụng số liệu là dòng 229, và nó chỉ đụng cột hiển thị.** Chênh
lệch kiểm kê — thứ sinh ra giá vốn — lấy từ `count_variance` đã đóng băng trên
từng dòng đếm. Nên **xoá bảng không làm sai một đồng giá vốn nào**; nó làm hỏng
hàm.

### 1.4 Giá trị nào hợp lệ, và làm sai thứ tự thì sao

Không có ô nhập. Chỗ nguy là **thứ tự**, và lần này **giống `0076`, không giống
giai đoạn C**:

| Làm gì trước | Hậu quả |
|---|---|
| Xoá bảng trước, sửa hàm sau | **Đóng kỳ kiểm kê hỏng** trong khoảng giữa |
| Xoá bảng trước, sửa báo cáo Ngày sau | **Báo cáo Ngày hỏng** trong khoảng giữa |
| **Sửa hết rồi mới xoá** | An toàn — không hàm nào còn đọc bảng |

**Đợt này chỉ làm phần sửa. Không xoá bảng.** Nên tự nó không có khoảng hở nào.

### 1.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

**Cố ý không đụng:**

- **Không xoá bảng nào, không xoá trigger.** Đó là giai đoạn D, chủ quán duyệt
  riêng, và **không đảo ngược được**
- Không đụng `stock_issues` — đường giá vốn thật
- Không đụng phép tính chênh lệch kiểm kê, chỉ đụng cột hiển thị
- Không sửa vết bẩn 130→129 ở §1.1. Bảng sắp bị xoá thì dựng lại nó là việc thừa

### 1.6 Chỗ tôi CHƯA xem

- **`getRealtimeStock` còn ai gọi ngoài báo cáo Ngày không** — mục 2c của kế
  hoạch gốc nói nó sống sót nhờ đúng báo cáo này, nhưng tôi **chưa tự tra lại**.
- **Sáu công cụ trong `scripts/` đọc bảng nhóm** (Sonnet nêu 01/09) — chưa xem
  cái nào đọc luôn hai bảng này.
- **Trigger `trg_stock_ledger_inventory_balances` còn gì bám vào không** — mới
  đọc tên, chưa đọc thân.

### 1.7 Ví dụ tính sẵn

**Kỳ kiểm kê `STK-001`** (09/08, 50 dòng đếm, đều là hàng mua) sinh 38 dòng gộp
theo nguyên liệu. Mỗi dòng có bốn cột hiển thị lấy từ sổ kho.

| | Hôm nay | Sau khi sửa |
|---|---|---|
| Chênh lệch của mỗi dòng | từ `count_variance` đóng băng | **y nguyên** |
| Cột "tồn lý thuyết" hiển thị | từ sổ kho (384 dòng, đã chết) | **0**, hoặc tính từ nguồn sống |
| Giá vốn sinh ra | không đổi | **không đổi** |

**Đây là chỗ phải chọn, và tôi chưa chọn thay chủ quán** — xem §2.

## 2. Thay đổi

### 2.1 Báo cáo Ngày — cần chủ quán quyết

Dòng *"âm tồn kho"* đọc bảng sắp bị xoá và hiện báo 0. Hai đường:

| Cách | Được gì | Mất gì |
|---|---|---|
| **A. Bỏ hẳn dòng đó** | Sạch, không nợ lại | Mất một ô cảnh báo — nhưng nó đang không cảnh báo gì |
| **B. Dựng lại trên nguồn sống** | Giữ được cảnh báo, tính từ đơn nhập trừ phiếu xuất | Là **tính năng mới**, phải làm đủ bốn bước, và đo trên **hàng mua** chứ không phải nhóm nguyên liệu |

**Khuyến nghị: cách A.** Lý do: bán thành phẩm đã xoá hết, nhóm nguyên liệu sắp
xoá — cảnh báo này đang đo những thứ sắp không tồn tại. Muốn cảnh báo âm tồn
thật thì phải đo trên **hàng mua**, và đó là việc khác, đáng làm riêng chứ không
nhét vào đây.

**Chủ quán chốt 01/09: cách A — bỏ hẳn dòng đó.**

Gỡ dòng cảnh báo khỏi `app/admin/reports/daily/page.tsx`, gỡ `negativeStockItems`
khỏi kết quả trả về, và gỡ luôn `getRealtimeStock`/`loadRealtimeStock` **nếu sau
đó không còn ai gọi** — kiểm bằng phép tra, đừng đoán. Còn chỗ gọi nào thì để
nguyên và nói rõ chỗ đó là gì.

**Đã đối chiếu `BR-INV-004`** (*"tồn âm phải được điều tra, không được xoá lặng
lẽ"*). **Không xung đột**: quy tắc đó nói về hồ sơ kiểm toán, và cấm xoá **kết
quả điều tra**, không cấm bỏ một ô màn hình đang báo 0.

**Nhưng phải nói cho hết:** sau khi bỏ, **không màn hình nào còn hiện tồn âm**.
Hôm nay không mất gì vì con số là 0, nhưng nếu sau này muốn cảnh báo tồn âm thật
thì phải dựng mới trên **hàng mua** — ghi thành mục việc riêng, đừng để nó biến
mất cùng dòng code.

### 2.2 Hai hàm kiểm kê — kỹ thuật, tự quyết

1. **`apply_stocktake_session_atomic`** — bỏ hai câu đọc `stock_ledger`. Dòng
   121 thuộc nhánh chưa từng chạy: bỏ luôn câu đọc, để `v_current_theoretical_qty`
   nhận 0. Dòng 229 nuôi cột hiển thị: cho về 0 và **ghi rõ trong chú thích** là
   cột đó không còn nghĩa, đừng để người sau tưởng nó là số thật.
2. **`save_stocktake_line_atomic`** — bỏ câu đọc ở dòng 135, cùng lý do.

**Chép nguyên phần còn lại**, đúng kỷ luật `0074`. Mỗi hàm một lần lưu.

**Kiểm chữ ký trả về:** nếu bỏ câu đọc làm đổi hình dạng kết quả trả về thì
**phải sửa TypeScript trong cùng lần lưu** — bài học `0076`, và giai đoạn C đã
gặp đúng chuyện này ở `lib/stocktake-transaction.ts`.

## 3. Kiểm chứng

- **Không hàm nào còn nhắc `stock_ledger` hay `inventory_balances`** — tra trên
  thân hàm mới nhất của mọi hàm, không tra theo tên. Kết quả phải là 0.
- **Chênh lệch kiểm kê không đổi:** chạy thử đóng kỳ (`p_dry_run`) trên dữ liệu
  thật trước và sau, `count_variance` từng dòng phải **y hệt**. Đây là phép kiểm
  quan trọng nhất — nó canh giá vốn.
- **`stock_issues` không đổi:** đếm và tổng trước/sau phải bằng nhau.
- **Phép kiểm mới, viết trước, phải ĐỎ trên bản chưa sửa.** Nói rõ đỏ vì **giá
  trị sai** hay vì **thiếu hàm**.
- **Trả lời §1.6 trước khi viết migration.**
- Đủ `CLAUDE.md` §9.

## 4. Xong nghĩa là

`CLAUDE.md` §9. **Viết migration, KHÔNG chạy.** Không tự đẩy.

**Thứ tự bắt buộc, giống `0076`:** đẩy code trước, chủ quán mở web xác nhận đóng
kỳ kiểm kê và báo cáo Ngày còn chạy, **rồi mới** chạy migration.

**Sau đợt này, giai đoạn D mới hết chặn.** Việc xoá hai bảng vẫn là một lần hỏi
riêng, và mục 6 của kế hoạch gốc đã yêu cầu xuất sao lưu trước — **đã xuất rồi**
(`docs/audits/2026-08-31-stock-ledger-and-balances-backup.json`, ghi 31/08).

---

## 5. Đo lại 01/09 sau khi chạy `0086`/`0087` — có chỗ chặn THỨ TƯ, và phép quét của tôi hỏng

### 5.1 Kết quả, đo trên máy chủ chứ không trên file

| Hàm | Còn ghi | Còn đọc |
|---|---|---|
| `stock_ledger_apply_inventory_balance_delta` (trigger) | Có | Có — giai đoạn D xoá cùng bảng |
| **`void_order_atomic`** | Không | **Có, 2 chỗ** — dòng 86 và 97 của `0080` |

Việc **ghi** đã dừng thật: không hàm nghiệp vụ nào còn ghi vào hai bảng.

Hai câu đọc trong hàm huỷ đơn là **chốt kiểm trạng thái cũ** — hỏi xem đơn này
đã từng có dòng đảo `EDIT_REVERSAL` trong sổ chưa. Giai đoạn C cố ý giữ lại
(chính chú thích của `0085` có nhắc), vì mục 5 chỉ yêu cầu bỏ **ghi**.

**Nhưng giai đoạn D xoá bảng thì hai câu đó thành lỗi lúc chạy — và huỷ đơn là
đường tiền.** Đây là chỗ chặn thứ tư; mục 5c.4 chỉ liệt kê ba.

### 5.2 Vì sao tôi sót — lỗi nằm trong phép đo của chính tôi

Phép quét tôi dùng suốt đợt này đọc **file migration**, dựng bản mới nhất của
mỗi hàm, rồi **loại bỏ mọi hàm có tên xuất hiện trong một lệnh `drop function`**
— coi đó là hàm đã chết.

**Giai đoạn C xoá rồi dựng lại ngay trong cùng một file.** Nên **cả sáu hàm giai
đoạn C sửa đều lọt khỏi phép quét**: `save_purchase_order_atomic`,
`void_order_atomic`, hai bản `supersede_order_v2_atomic`, và hai hàm máy bán
hàng.

Tôi đã dùng đúng phép quét đó để báo **"0 hàm còn đụng hai bảng"** — hai lần.
Con số 0 đó không sai vì dữ liệu, mà vì **phép đo tự loại bỏ đúng những hàm đáng
ngờ nhất**.

**Luật rút ra: hỏi máy chủ, đừng phân tích file.** `pg_get_functiondef` cho biết
hàm đang thật sự là gì; ghép file migration lại là dựng một mô hình, và mô hình
đó sai đúng ở chỗ khó thấy nhất — thứ tự xoá/tạo trong cùng một file. Cùng họ
với sự cố `rebuild_inventory_balances` sáng 31/08: cả hai lần tôi tin một thứ do
mình tự dựng thay vì đi đo.

Và phải **bỏ chú thích trước khi tìm** — không thì mọi dòng giải thích "chỗ này
từng ghi sổ kho" đều bị đếm là lệnh thật.

### 5.3 Danh sách chặn giai đoạn D — BỐN mục

1. ~~Báo cáo Ngày~~ — **xong 01/09**, đã bỏ dòng cảnh báo theo chủ quán chọn.
2. ~~`apply_stocktake_session_atomic`~~ — **xong**, migration `0086`.
3. ~~`save_stocktake_line_atomic`~~ — **xong**, migration `0087`.
4. **`void_order_atomic` — CHƯA LÀM.** Hai câu đọc chốt trạng thái cũ.

**Trước khi làm mục 4 phải trả lời một câu chưa ai hỏi:** chốt đó đang bảo vệ
điều gì, và bỏ sổ kho đi thì nó còn ý nghĩa không? Nó đếm dòng `EDIT_REVERSAL`
— mà sổ đóng băng ở 384 dòng, nên câu trả lời **không bao giờ đổi nữa**. Có thể
đó là lý do bỏ được, nhưng **phải đo số đơn thật rơi vào chốt đó trước**, không
suy luận.
