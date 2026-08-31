# Retire the stock ledger

**Written 2026-08-28 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1).

**Deletes two tables the entire operational core writes to.** The cost was put
to the owner twice — 21 functions, the money path, weeks — and he decided
anyway, with a reason worth recording:

> *"Nếu sau này xoá, em vẫn sẽ đọc lại, như vậy còn làm tốn kém hơn, xoá luôn
> bây giờ và chữa các lỗ hổng rồi sau này chỉ việc xây thôi."*

Deferring means re-deriving this whole picture later. That cost is real — this
session spent most of a day rebuilding exactly this understanding.

---

## 1. Why the data deserves retiring, measured

`stock_ledger` holds **382 rows** and every one duplicates a row that already
exists elsewhere, keyed better:

| Movement | Authoritative table | Ledger copy |
|---|---:|---:|
| Purchases | 299 `purchase_order_lines` | 299 — exact duplicate |
| Manual issues | 45 `stock_issues` | 45 — exact duplicate |
| Stocktake variance, 2026-08-09 | **49** `stock_issues` | **38 — incomplete** |

**Where the copy differs from the original it is the less complete one.** A
report reading the ledger for the first stocktake sees 38 of 49 adjustments.

**Nothing sold has ever touched it.** Only `PO_RECEIPT` (299) and `STOCK_ADJUST`
(83) exist — no sales row, because selling stopped deducting stock at the
2026-08-07 cutover. So `void_order_atomic` and `supersede_order_v2_atomic` read
the ledger for an order and find nothing, every time.

**The live on-hand figure already ignores it.** `computeOnHandByPurchasedItem`
derives on-hand from `purchase_order_lines` minus `stock_issues`, keyed by
`purchased_item_id`.

## 2. The blast radius, enumerated not estimated

This is the check that was missed on `0072` and cost three days of broken order
editing. **21 database functions reference the two tables. 13 are live** —
called from `lib/` or `app/` outside tests and historical tooling:

`apply_stocktake_session_atomic`, `approve_stock_adjustment_atomic`,
`close_shift_stock_check_atomic`, `create_issue_slip_atomic`,
`open_shift_stock_check_atomic`, `reverse_manual_issue_atomic`,
`reverse_stocktake_session_atomic`, `save_purchase_order_atomic`,
`save_stocktake_line_atomic`, `submit_stock_adjustment_atomic`,
`supersede_order_v2_atomic`, `void_order_atomic`, `create_pos_order_atomic`.

**8 are dead** and can be dropped outright: `apply_hong_to_luc_migration`,
`apply_purchase_cost_recovery`, `rollback_purchase_cost_recovery`,
`rebuild_inventory_balances`, `rebuild_stock_ledger_for_order`,
`get_pos_inventory_state`, `create_pos_order_atomic_unvalidated_0025`,
`save_production_order_atomic`.

Plus one trigger, `trg_stock_ledger_inventory_balances`, and 8 TypeScript sites.

**Re-derive this list before acting.** It was produced by grep on 2026-08-28 and
a function added tomorrow will not be in it.

## 2b. Hiện trạng đo lại 31/08 — việc nhỏ đi một nửa

**§2 đo ngày 28/08 và đã lỗi thời.** Từ đó: công thức và bán thành phẩm bị xoá
hẳn, phiếu xuất kho thôi ghi sổ (migration `0076`), và mấy màn hình đọc sổ qua
công thức đã biến mất theo. Kế hoạch tự dặn phải đo lại trước khi làm — đây là
lần đo lại.

### 2b.1 Ai còn GHI vào hai bảng

21 hàm còn nhắc tên, nhưng **6 hàm chỉ nhắc trong chú thích hoặc chỉ đọc** —
trong đó có `create_issue_slip_atomic` và `reverse_manual_issue_atomic`, đã gỡ
phần ghi hôm 30/08.

**7 hàm còn sống và ghi thật** (§2 đoán 13):

`apply_stocktake_session_atomic`, `approve_stock_adjustment_atomic`,
`reverse_stocktake_session_atomic`, `save_purchase_order_atomic`,
`submit_stock_adjustment_atomic`, `supersede_order_v2_atomic`,
`void_order_atomic`.

**7 hàm ghi nhưng đã chết**, xoá thẳng: `apply_hong_to_luc_migration`,
`apply_purchase_cost_recovery`, `create_pos_order_atomic_unvalidated_0025`,
`rebuild_stock_ledger_for_order`, `rollback_purchase_cost_recovery`,
`save_production_order_atomic`, `rebuild_inventory_balances`.

Cộng cơ chế tự động `trg_stock_ledger_inventory_balances` và hàm của nó.

### 2b.2 Ai còn ĐỌC — chỉ còn 5 chỗ trong 3 file

| Chỗ | Làm gì |
|---|---|
| `inventory/actions.ts:446` | `deleteUnit` — kiểm một đơn vị còn ai dùng không trước khi xoá |
| `inventory/actions.ts:492` | `getRealtimeStock` — nuôi báo cáo tồn kho và báo cáo ngày |
| `orders/actions.ts:413` | `voidOrderV2` — đọc để trả hàng về kho khi huỷ đơn |
| `orders/actions.ts:491` | `editOrderV2` — như trên, khi sửa đơn |
| `pos/actions.ts:225` | `loadPOSStockStatus` — hiện còn/hết hàng cho nhân viên |

**Hai chỗ đọc của màn hình sản phẩm đã tự biến mất** cùng lúc xoá công thức.

**Hai chỗ đọc ở đơn hàng đọc ra rỗng**: sổ kho không có dòng nào từ bán hàng —
chỉ có `PO_RECEIPT` và `STOCK_ADJUST`. Chứng minh lại bằng hành động 29/08: bán
một ly thật, sửa, rồi huỷ — sổ kho đứng nguyên 382 dòng qua cả ba bước.

### 2b.3 Số dòng hôm nay

| | 28/08 | 31/08 |
|---|---:|---:|
| `stock_ledger` | 382 | **384** |
| `inventory_balances` | 141 | **130** |
| `stock_issues` | 94 | **103** |

Số dư giảm 11 vì xoá bán thành phẩm. Sổ kho **chỉ tăng 2 trong bốn ngày** — và
9 phiếu xuất mới trong cùng kỳ **không sinh dòng nào**, đúng như migration `0076`
định làm.

### 2b.4 Chỗ tôi CHƯA xem

- **`approve_stock_adjustment_atomic` và `submit_stock_adjustment_atomic`** hiện
  là "còn sống" theo phép tra tên, nhưng Sonnet đo 31/08 rằng đường tạo điều
  chỉnh tồn **không có ai gọi** và bảng **0 dòng**. Hai phép đo mâu thuẫn nhau —
  **phải làm rõ trước khi sửa hai hàm này**, vì có thể chúng thuộc nhóm chết.
- **Màn hình Điều chỉnh Tồn kho** còn trong menu hay chưa — chưa xem.
- **`get_pos_inventory_state`** đọc chứ không ghi, nhưng chưa xem ai gọi nó.

## 2c. Sau giai đoạn A — một chỗ đọc còn sống, và một kiểu hụt mới

**`getRealtimeStock` vẫn sống**, vì **báo cáo ngày** dùng nó cho mục *hàng đang
âm kho* (`reports/daily/actions.ts:52` và `:72`). Nó đọc `Inventory_Balances`.
**Phải xử lý trước giai đoạn D**, nếu không xoá bảng là báo cáo ngày vỡ.

**Kiểu hụt này khác lần trước, và đáng ghi.** Mục 2b.2 **có** nói
`getRealtimeStock` nuôi *"báo cáo tồn kho **và báo cáo ngày**"*. Nhưng danh sách
việc của giai đoạn A — viết 28/08, trước khi có mục 2b — chỉ nói xoá báo cáo tồn
kho và nhắc đặt hàng. **Mô tả đúng, rồi không mang sang phần việc.**

Lần 31/08 trước là *mô tả thiếu*. Lần này là *mô tả đủ mà không dùng*. Cả hai
đều lọt vì không có bước nào bắt đối chiếu **mỗi thứ đã mô tả có được xử lý
trong phần thay đổi hay không**.

**Sonnet sửa hai chỗ tôi ghi sai tên hàm** trong 2b.2: dòng 446 là
`loadRealtimeStock` chứ không phải `deleteUnit`, dòng 492 là
`loadReorderSuggestions` chứ không phải `getRealtimeStock`. Không đổi phạm vi,
nhưng ghi lại vì mục 1b bảo kiểm cả chỗ mô tả sai.

**Hai câu 2b.4 để ngỏ, Sonnet trả lời:**

`open_shift_stock_check_atomic` và `close_shift_stock_check_atomic` **chỉ đọc, không
ghi** — trái với phỏng đoán ở giai đoạn C rằng chúng "có thể tồn tại chỉ để ghi
sổ". Chỗ gọi duy nhất là màn hình vừa xoá, nên chúng thành **hàm chết**, chuyển
sang giai đoạn B.

`get_pos_inventory_state` chỉ được gọi từ `lib/historical/` và một script chạy
một lần — **cũng chết**, sang giai đoạn B.

Hai hàm điều chỉnh tồn kho thì **không chết**: bảng rỗng 0 dòng và đường tạo
không có ai gọi, **nhưng nửa duyệt/từ chối là thật** — màn hình vẫn trong menu,
vẫn nối vào hàm thật. Nó chỉ đang **đói dữ liệu vĩnh viễn** vì phần tạo chưa bao
giờ được xây. Giữ ở giai đoạn C.

## 2d. Đo lại 31/08 trước giai đoạn B — SỔ CHƯA CHẾT, và giai đoạn C to hơn kế hoạch

### 2d.1 Sửa lại điều đã nói: sổ không đứng yên ở 382

Tôi đã nói sổ **bất động ở 382 dòng**, chứng minh bằng một lần bán, một lần sửa
đơn, một lần huỷ đơn thật — sổ không nhúc nhích.

**Phép thử đó chỉ chứng minh ĐƯỜNG BÁN không ghi sổ. Nó không nói gì về đường
nhập hàng.** Đây đúng là lỗi `CLAUDE.md` mục 5 cấm: kết luận từ một truy vấn mà
không nói truy vấn đó *không* cho thấy điều gì.

Đo 31/08: **384 dòng**, dòng mới nhất **29/08 lúc 14:48** — đơn nhập `PO-155`.

| Đường ghi | Số dòng | Lần cuối | Còn sống? |
|---|---:|---|---|
| Nhận hàng đơn nhập (`PO_RECEIPT`) | 300 | 29/08 14:48 | **CÒN** |
| Phiếu xuất kho (`STOCK_ADJUST ← ISS-`) | 46 | 29/08 12:41 | **ĐÃ NGỪNG** |
| Đóng kỳ kiểm kê (`STOCK_ADJUST ← STK-`) | 38 | 09/08 | Chưa đóng kỳ nào từ đó |

**Phiếu xuất đã ngừng thật, chứng minh trên phiếu thật:** mọi phiếu tới
`ISS-00095` (29/08) đều sinh 1 dòng sổ; **cả 8 phiếu từ `ISS-00096` trở đi
(30/08, sau migration `0076`) sinh 0 dòng.** Không phải suy từ mã nguồn.

**Đường nhập hàng vẫn ghi.** Nó im từ 29/08 chỉ vì **chưa có đơn nhập nào từ
26/08 tới nay** — không phải vì đã tắt.

`inventory_balances`: **130 dòng** — đúng con số chủ quán hỏi.

### 2d.2 Giai đoạn C không phải "gỡ một khối lệnh" — có một chốt chặn ném lỗi

`lib/stocktake-transaction.ts` có **hai** chốt, **cả hai đều ném lỗi** chứ không
hiện sai:

- dòng 232 — `ledger_count + issue_count` khác số dòng đếm
- dòng 236 — số mã dòng sổ trả về khác `ledger_count`

Đây là **đóng kỳ kiểm kê**, một trong **hai** đường duy nhất sinh ra giá vốn.
Nếu migration bỏ ghi sổ mà code chưa đổi, **đóng kỳ sẽ hỏng hẳn**, không phải
hiện xấu. Đúng bài học `0076`, nhưng vào chỗ đắt hơn nhiều.

Nên **hàm kiểm kê phải sửa code và migration cùng một lần lưu**, không phải
"một migration cơ học" như mục 5 đang viết. Sửa lại mục 5 khi làm tới.

### 2d.3 Nhánh ghi sổ trong kiểm kê chưa từng chạy — nhưng 38 dòng kia có nguồn khác

Đo: **cả 50 dòng kiểm kê đều là hàng mua** (`PURCHASED_ITEM`), nên nhánh ghi sổ
theo từng dòng **chưa chạy lần nào**. 38 dòng sổ của kỳ `STK-001` đến từ **vòng
lặp thứ hai** — vòng quy đổi ngược ra nguyên liệu gốc.

**Chỗ tôi CHƯA xem, và nó có thể đắt:** vòng đó quy từ hàng mua ra nguyên liệu
gốc. **Công thức đã bị xoá hôm 31/08.** Chưa ai đóng kỳ kiểm kê nào từ lúc đó,
nên **không ai biết đóng kỳ bây giờ còn chạy được không.** Việc này độc lập với
giai đoạn B–D và phải kiểm riêng.

## 3. Phase A — stop reading, delete the screen

Owner instruction: *"Anh không xài báo cáo tồn kho với những thông tin đó, sẽ
xây lại chuẩn chỉnh sau, xoá đi."*

- Delete `app/admin/reports/stock/` — screen, actions, nav entry. Update
  `nav-guard.test.ts` in the same commit.
- Remove the reorder suggestion from the daily report. The owner set its
  condition himself: *"Khi nào cần nhắc nhở đặt hàng? Khi đã chỉn chu xong
  những điều cơ bản nhất."* Not now.
- Remove the ledger read from `voidOrderV2` and `editOrderV2`. **It returns
  nothing today** — prove that with a test asserting zero rows for a real order
  before deleting the code, so the removal is evidenced rather than assumed.
- ~~`app/admin/products/page.tsx` và `products/cogs-estimate/page.tsx`~~ —
  **đã biến mất cùng lúc xoá công thức 31/08**, không còn việc gì ở đây.
- **POS stock status** (`loadPOSStockStatus`, `app/pos/actions.ts:225`):
  **chủ quán chốt 31/08 — bỏ hẳn.** Được hỏi vì đây là chỗ duy nhất trong giai
  đoạn này mà nhân viên nhìn thấy giữa ca; ông ấy chọn bỏ chứ không chọn giữ rồi
  tính lại cho đúng. Lý do đứng vững: con số đó lấy từ bảng số dư, tức từ **bản
  chép thiếu** — 38 dòng trên 49 điều chỉnh của kỳ kiểm kê đầu tiên — nên **số
  sai còn tệ hơn không có số**.

  Và code đã ghi sẵn rằng nhãn hết hàng *"đang bị chủ quán tắt"*, nên việc này
  chỉ dọn nốt phần còn lại của một quyết định đã có, không phải bỏ một tính năng
  đang dùng.

  **Xoá cả hàm, không chỉ ẩn chỗ hiển thị** — để không còn ai đọc `Inventory_Balances`
  từ đường bán hàng.

**Gate:** POS sells, orders void and edit, full suite, `npm run build`.

## 3b. THỨ TỰ BẮT BUỘC — giai đoạn B không được chạy trước khi A lên web

**Đo 31/08:** nhánh đang chạy trên web (`origin/main`) vẫn còn
`lib/shift-stock-check-transaction.ts` gọi `open_shift_stock_check_atomic` và
`close_shift_stock_check_atomic`. Giai đoạn A vừa xoá chỗ gọi đó **ở máy**, chưa
đẩy.

**Chạy migration giai đoạn B lúc này là làm hỏng màn hình kiểm kho đầu ca trên
web thật.**

Đây là bài học `0076` ngày 30/08 lặp lại theo chiều ngược: lần đó migration đi
trước code và mọi phiếu xuất báo lỗi đỏ suốt bốn tiếng. Lần này là **xoá hàm
trước khi gỡ chỗ gọi**.

**Thứ tự đúng:**

1. Viết migration của B và C — **không chạy**.
2. Đẩy toàn bộ code, chờ Vercel dựng xong.
3. Chủ quán mở web xác nhận bán được, huỷ đơn được.
4. **Rồi mới** chạy migration B, sau đó C.

Chủ quán chốt 31/08 là *"làm tiếp một thể"* — nghĩa là viết hết rồi đẩy một
lượt, **không phải chạy hết một lượt**.

## 4. Phase B — drop the dead functions

One migration that drops the dead functions. **Write it. Do not apply it.**
Applying to production is a separate approval the owner gives himself, and §3b
forbids applying it before Phase A is deployed.

1. **Re-derive the dead list live. Do not trust this plan's counts.** §4 once
   said 8 and §5 says 13; §2b and §2c revised both, and the list has changed
   twice already. Enumerate the functions that exist in production **today** and
   touch `stock_ledger` or `inventory_balances`, then split dead from live.

2. **Prove each candidate unreferenced individually**, not with one batched
   search. Per name, search `app/`, `lib/`, `scripts/`, `supabase/migrations/`
   and tests separately and report per name. A function referenced only by the
   migration that created it is dead; one referenced by a test is not — say
   which case each is.

3. **Check every candidate against `origin/main` as well as the working tree.**
   The local tree already lost its callers to Phase A. A function dead locally
   may still be called by what is running in production right now. Report both
   columns.

4. **Write `supabase/migrations/0077_*.sql`** — one `drop function if exists`
   per name **with its full argument signature**, since some are overloaded.
   Do not apply it.

5. **Say what happens to `save_production_order_atomic`** — it also dies with
   the recipes work, which has since landed. State whether it is already gone.

**Do not touch the live writers in this phase.** In particular do not remove the
ledger write from the purchase receipt path: §2d measured it still writing as of
29/08, and it belongs to Phase C, one function per commit.

## 5. Phase C — remove the write from the 8 live functions

**Sửa thứ đã có → mô tả hiện trạng rút gọn, năm mục đánh số** (`CLAUDE.md` §1b).
Danh sách dưới đây dựng lại 31/08 từ **thân hàm mới nhất của từng hàm**, không
từ tên — vì đúng cách tra bằng tên đã bỏ sót hàm POS suốt bốn ngày.

### 5.1 Đường ống này có mấy trạng thái, đặt bằng cách nào

Hai, và **không ai đặt được bằng tay**. Mỗi hàm hoặc còn khối `insert into
public.stock_ledger`, hoặc không. Không có công tắc, không có cấu hình, không có
màn hình. Đổi trạng thái = chạy một migration.

Riêng đường POS có trạng thái thứ ba, **kín**: khối lệnh còn nguyên nhưng luôn
nhận danh sách rỗng, nên nó *ở tư thế ghi mà không ghi* — trạng thái này chính là
thứ làm hàm đó bị chấm nhầm là chết.

### 5.2 Màn hình nào có nút gì

**Không áp dụng — không màn hình nào của chủ quán chạm tới sổ kho nữa.** Màn
hình duy nhất từng hiện nó đã bị xoá ở giai đoạn A. Việc này thuần máy chủ.

### 5.3 Danh sách 8 hàm — cái gì vào, cái gì bị loại ra

| # | Hàm | Việc thật của nó | Còn ghi thật? |
|---|---|---|---|
| 1 | `save_purchase_order_atomic` | Nhận hàng đơn nhập | **CÓ** — 300 dòng, mới nhất 29/08 |
| 2 | `apply_stocktake_session_atomic` | Đóng kỳ kiểm kê | **CÓ** — 38 dòng, 09/08. **Hai** khối ghi |
| 3 | `reverse_stocktake_session_atomic` | Đảo một kỳ kiểm kê | Chưa chạy lần nào |
| 4 | `void_order_atomic` | Huỷ đơn | Không — 0 dòng trên cả 53 đơn thật |
| 5 | `supersede_order_v2_atomic` | Sửa đơn | Không — như trên |
| 6 | `create_pos_order_atomic_unvalidated_0025` | Bán hàng | Không — luôn nhận rỗng |
| 7 | `submit_stock_adjustment_atomic` | Tạo phiếu điều chỉnh | Không — bảng rỗng, chưa nối form |
| 8 | `approve_stock_adjustment_atomic` | Duyệt phiếu điều chỉnh | Không — như trên |

**Bị loại ra, có lý do:**

- `stock_ledger_apply_inventory_balance_delta` — hàm trigger, **giai đoạn D**.
- `save_stocktake_line_atomic` — **chỉ đọc**, không ghi. Nhưng nó đang được dùng
  thật (`lib/stocktake-transaction.ts:80`), nên **phải xử lý trước giai đoạn D**
  chứ không phải ở đây.
- 12 hàm chết — giai đoạn B đã lo.

### 5.4 Giá trị nào hợp lệ ở mỗi ô, và ngoài khoảng thì sao

Không có ô nhập của người dùng. Ô duy nhất là tham số `p_ledger` giữa hai lớp
máy, và **chỗ này là chỗ dễ vỡ nhất của cả giai đoạn**:

| Chỗ | Kiểm gì | Hỏng thì ra sao |
|---|---|---|
| `0072:78` | `p_ledger` phải là mảng | Ném lỗi |
| `0072:331` | Số dòng ghi được phải bằng số dòng truyền vào | Ném lỗi |
| `lib/pos-order-transaction.ts:81` | `ledger_count` trả về phải khớp | **Ném lỗi — hỏng mọi lần bán** |
| `lib/order-edit-transaction.ts:65` | như trên, đường sửa đơn | Ném lỗi |
| `lib/stocktake-transaction.ts:232,236` | như trên, đóng kỳ kiểm kê | **Ném lỗi — hỏng đóng kỳ** |

**Ba chốt cuối là chốt ném lỗi, không phải chốt hiện sai.** Đây là lý do giai
đoạn này **không** phải "một migration cơ học" như bản đầu của mục này viết.

### 5.5 Phục vụ dữ liệu nào, cố ý không phục vụ loại nào

Chỉ gỡ **chỗ ghi vào `stock_ledger`**. Cố ý **không** đụng: `stock_issues` (đường
giá vốn thật), `inventory_balances` (giai đoạn D), tên hàm, và **bất kỳ logic
nghiệp vụ nào khác trong cùng hàm**. Chép nguyên phần còn lại, đúng kỷ luật
`0074`.

**Không đổi tên `create_pos_order_atomic_unvalidated_0025`.** Cái tên gây hiểu
nhầm, nhưng đổi tên một hàm trên đường thu tiền là rủi ro thật đổi lấy chỗ dễ
đọc; và sau khi gỡ xong nó không còn xuất hiện trong danh sách "ai đụng sổ kho"
nữa, nên nguyên nhân hiểu nhầm tự mất.

### 5.6 Cách làm

**Một hàm một lần lưu. POS làm SAU CÙNG** — đường tiền.

Với mỗi hàm: gỡ khối `insert`, gỡ tham số `p_ledger` và phần kiểm định dạng của
nó, gỡ chốt đối chiếu số dòng, gỡ `ledger_count` khỏi kết quả trả về — **và sửa
TypeScript tương ứng trong CÙNG lần lưu đó.**

**Sau mỗi lần lưu:** bán một ly, lưu một đơn nhập, lưu một phiếu xuất. Sau mỗi
lần, không phải để dồn cuối.

### 5.7 Thứ tự đẩy — lần này thuận, không nghịch

Gỡ một tham số là **đổi chữ ký hàm**. Nếu migration lên trước, code cũ vẫn gọi
kèm `p_ledger`, máy chủ không tìm thấy hàm khớp, **mọi lần bán hỏng**.

Nhưng chiều ngược lại an toàn: `p_ledger` có sẵn giá trị mặc định rỗng, nên
**code mới không truyền gì vẫn chạy được với hàm cũ**.

**Nên: đẩy code trước, chạy migration sau. Không có khoảng hở.** Đây là ngoại lệ
so với `0076` — ở đó code phải theo sau migration; ở đây phải đi trước.

## 5b. SỰ CỐ 31/08 — tôi ghi vào dữ liệu thật khi đang đi "đo"

Để biết migration đã chạy chưa, tôi gọi thử hai hàm và **tự dán nhãn việc đó là
"chỉ đọc, vô hại"** ngay trong chú thích của chính đoạn mã. Một hàm tên là
`rebuild_inventory_balances`. Tên nó nói đúng việc nó làm. Tôi vẫn gọi.

`inventory_balances` **130 → 129 dòng**, và **cả bảng bị viết đè** — mọi dòng
giờ mang cùng một mốc thời gian. `stock_ledger` không đổi (384).

**Không xác định được mất dòng nào**, vì không có bản chụp trước đó. Bản sao lưu
duy nhất (`docs/audits/2026-08-31-recipes-semi-products-backup.json`) chỉ chứa
11 dòng bán thành phẩm, không phải cả bảng.

Phạm vi: không đụng giá vốn (tính từ `stock_issues`), không đụng doanh thu, đơn
hàng, đơn nhập. Bảng này còn đúng một chỗ đọc — dòng "hàng âm kho" của báo cáo
ngày — và là bảng giai đoạn D sẽ xoá. **Hai ý cuối không phải lý do bào chữa.**

### Luật rút ra

**Không gọi một hàm máy chủ để "thăm dò" khi chưa đọc thân hàm của nó.** Không
có hàm nào an toàn vì tên nó nghe có vẻ vô hại, và **chữ "chỉ đọc" do chính mình
gõ vào chú thích không chứng minh gì cả** — đó là điều mình muốn đúng, không
phải điều mình đã kiểm.

Cách đúng để biết một migration đã chạy chưa: **hỏi chủ quán**, hoặc đọc thân
hàm trước rồi mới chọn hàm để thử. Việc `CLAUDE.md` mục 2 xếp vào loại "ghi vào
dữ liệu thật, chủ quán duyệt từng lần" không được đổi loại chỉ vì mình gọi nó là
phép đo.

### Việc còn nợ

Trước khi giai đoạn D xoá hai bảng, **xuất cả hai ra file trước** như mục 6 đã
yêu cầu — lần này thật, vì bản chụp lẽ ra phải có hôm nay thì không có.

## 5c. Đo 31/08 sau khi chạy 9 migration — ba thứ chặn giai đoạn D

### 5c.1 Migration đã chạy, đo trên máy chủ chứ không tin dòng chữ "OK"

`0077`–`0085` chạy xong theo thứ tự, sau khi code đã lên web.

| Phép đo trên máy chủ | Kết quả |
|---|---|
| 9 hàm chết còn sót | **0** |
| Hàm còn `insert into stock_ledger` | **0** |
| Hàm còn nhận tham số `p_ledger` | **0** |
| Hàm sống còn đủ | **7/7**, cả hai bản `supersede_order_v2_atomic` (5 và 6 tham số) |

`stock_ledger` đóng băng ở **384 dòng**. Không còn đường ghi.

**Đã xuất sao lưu** — `docs/audits/2026-08-31-stock-ledger-and-balances-backup.json`,
162 kB, 384 dòng sổ + 129 dòng số dư, đã đọc lại để chứng minh file dùng được.
Đây là món nợ từ mục 5b: bản chụp lẽ ra phải có sáng nay thì không có. **File này
chụp trạng thái SAU khi tôi dựng lại nhầm**, không phải trước.

### 5c.2 Nỗi lo về đóng kỳ kiểm kê là lo hão — khép lại

Tôi đã nêu ở mục 2d.3 rằng đóng kỳ có thể hỏng sau khi xoá công thức. **Sai.**
Bốn chỗ nhắc tới công thức trong `0079` đều là **chú thích**, không phải lệnh.
Vòng quy ngược chạy bằng `purchased_items.base_ingredient_id`, không dùng công
thức. Nêu ra thì phải khép lại.

### 5c.3 Nhưng hàm đóng kỳ ĐỌC sổ kho ở hai chỗ — chặn giai đoạn D

`0079` dòng **121** và **229** đều `select ... from public.stock_ledger`. Giai
đoạn D xoá bảng thì **hai câu này thành lỗi cú pháp lúc chạy**, không phải trả
về 0.

Mức độ khác nhau giữa hai chỗ, và phải nói rõ chứ đừng gộp:

| Dòng | Dùng cho | Có chạy thật không |
|---|---|---|
| 121 | Dòng đếm trực tiếp nguyên liệu gốc / bán thành phẩm | **Chưa bao giờ** — cả 50 dòng kiểm kê đều là hàng mua, nên nhánh này không vào |
| 229 | Cột hiển thị của dòng gộp theo nguyên liệu | **Có chạy** — sinh 38 dòng ở kỳ `STK-001` |

**Nhưng dòng 229 chỉ nuôi cột hiển thị, không nuôi phép tính chênh lệch.** Chênh
lệch lấy từ `count_variance` đã đóng băng trên từng dòng đếm. Chính chú thích
trong hàm nói vậy, và đọc mã thì đúng vậy.

**Nên: xoá bảng không làm sai giá vốn, nhưng làm hỏng hàm.** Phải sửa `0079`
trước giai đoạn D.

### 5c.4 Danh sách chặn giai đoạn D — ba mục, không phải một

1. **Báo cáo ngày** đọc `Inventory_Balances` cho dòng "hàng âm kho"
   (`app/admin/reports/daily/actions.ts:52` và `:72`) — mục 2c.
2. **`apply_stocktake_session_atomic`** đọc `stock_ledger` hai chỗ — mục 5c.3.
3. **`save_stocktake_line_atomic`** đọc `stock_ledger`, đang được dùng thật
   (`lib/stocktake-transaction.ts:80`) — Sonnet tìm ra ở giai đoạn B.

**Cả ba đều phải xử lý trước khi xoá bảng.** Mỗi cái là một quyết định riêng
(sửa hay bỏ hẳn), không được gộp thành một việc kỹ thuật.

## 6. Phase D — drop the trigger, then the tables

`trg_stock_ledger_inventory_balances` first, then `inventory_balances`, then
`stock_ledger`.

**Export both tables to `docs/audits/2026-08-28-stock-ledger-backup.json`
first** and verify the file re-reads. 382 + the balance rows. After this they
exist nowhere else.

`fnbapp-bulk-data-change` applies. Owner approves the drop separately from
approving this plan.

## 7. Verification

- **On-hand unmoved for every item**, before and after every phase — diff the
  whole `computeOnHandByPurchasedItem` map, not a sample. This is the figure
  that must survive, and it is the one this plan claims already ignores the
  ledger. If it moves, the claim was wrong and the plan stops.
- `scripts/verify-revenue.ts` byte-identical throughout.
- COGS unmoved: `stock_issues` is untouched by all four phases — assert its row
  count and sum before and after.
- Full `CLAUDE.md` §9 at each phase, including `npm run build`.

## 8. Done means

`CLAUDE.md` §9. Do not push without approval. **And the owner must sell a real
drink on the real POS after phase C and after phase D** — thirteen functions on
the money path are being edited, and no gate here has ever caught a failure that
only appears in a logged-in session.
