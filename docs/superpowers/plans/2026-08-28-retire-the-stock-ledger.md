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

## 5. Phase C — remove the write from the 13 live functions

**One function per commit, POS last.** Each is a mechanical removal of an
`insert into stock_ledger` block and its `p_ledger` argument — not a logic
rewrite. Copy the body forward otherwise unchanged, the same discipline `0074`
used.

**Two of these need a decision, not an edit:** `open_shift_stock_check_atomic`
and `close_shift_stock_check_atomic` may exist *only* to write the ledger. If
removing the write leaves an empty function, say so and stop — deleting a
feature is the owner's call, not a consequence of this plan.

**After each commit:** the POS completes a sale, a purchase saves, an issue slip
saves. Not at the end — after each.

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
