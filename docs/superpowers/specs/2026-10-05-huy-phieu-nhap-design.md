# Huỷ phiếu nhập

**Status:** approved by the owner 2026-10-05 (*"a"*); below-zero check widened the same day (§3, answer *"a"*).
**Rule this implements:** `BR-INV-015` in `docs/02-rules/business-rules/purchasing.md`.
Related: `BR-INV-013` (stocktake lock on issue slips), `BR-COGS-008` (assets, retiring them),
`BR-DATA-007` (an input box is its own page), `BR-CASH-001` (purchase money in the cash book).

## 1. What the owner asked

Shown on 2026-10-05 that a completed purchase order can only be edited, never removed, so an
order entered twice stays counted twice forever, the owner chose to add a cancel (*"Làm theo em
khuyến nghị"*). Then, on what to refuse:

| Question | Answer |
|---|---|
| Order whose equipment became assets | Cancel it and retire its assets (*"1b để nếu nhập nhầm thì có thể huỷ phiếu và nhập rồi tính chi phí khấu hao từ ngày nhập thực tế"*) |
| Order on or before the last confirmed stocktake | Refuse (*"2a"*) |
| Cancel that leaves an item below zero | Refuse, naming the item (*"3a"*) |

## 2. Hiện trạng

Seen: `app/admin/inventory/purchase-orders/actions.ts`, `[id]/page.tsx`,
`components/PurchaseOrdersClient.tsx`, `lib/purchasing/purchase-order-list.ts`,
`lib/stock/purchased-item-onhand.ts`, `lib/costing/issue-costing-inputs.ts`,
`lib/reports/profit-and-loss.ts`, `lib/purchasing/item-purchase-history.ts`,
`lib/assets/asset-removal.ts`, `app/admin/suppliers/[id]/components/SupplierDetailView.tsx`,
migrations `0001`, `0106`, `0107`, `scripts/verify-cash-book-core.ts`, `scripts/verify-cogs-core.ts`.
Not seen: `scripts/verify-revenue.ts` beyond its sales filter; the purchase-order form's draft
storage (`po-draft.ts`) — a cancelled order is never opened in the form, so it is not reached.

1. **States.** `purchase_orders.status` is `DRAFT` or `COMPLETED`, set by the form's two save
   buttons. The database check has allowed `CANCELLED` since `0001`; nothing writes it. Measured
   2026-10-05: 199 orders, all `COMPLETED`.
2. **Buttons.** Detail page: edit (ADMIN; a draft is opened straight in the form), "Trả bằng"
   change on a completed order (ADMIN, MANAGER). No cancel, no delete anywhere.
3. **Lists.** The list filters Tất cả (default) / Nháp / Hoàn thành, by supplier, by day, by
   "Trả bằng". Supplier detail lists the supplier's orders with a status badge. Item purchase
   history shows completed orders only.
4. **Inputs.** A completed order needs a supplier, a source, at least one line and a "Trả bằng".
   There is no reason field.
5. **Data served.** Every money and stock reader already counts `status === "COMPLETED"` only
   (checked by reading each condition, not by a search tool's summary): on-hand stock
   (`purchased-item-onhand.ts:17`), cost replay (`issue-costing-inputs.ts:28`), P&L purchases
   used at once (`profit-and-loss.ts:182`), P&L years (`reports/pnl/actions.ts:61`), item purchase
   history (`item-purchase-history.ts:63`), cash book view `cash_book_daily` (`0107`, `where status =
   'COMPLETED'`), `verify-cash-book-core.ts:96`, `verify-cogs-core.ts:161`. So a `CANCELLED` order
   leaves all of them with no change to those readers.

Places that do **not** handle a third status and must change: the detail page (treats anything
not `DRAFT` as completed: shows edit and "Trả bằng"), the list's status badge and filter, the
supplier detail badge, `savePurchaseOrder` (would accept a save over a cancelled order, and its
asset creation fires on `previous.status !== "COMPLETED"`, so re-completing a cancelled order would
mint assets twice), `setPurchaseOrderPayment` (already refuses anything not `COMPLETED`, keeps).

Questions of my own for this job:

6. **What if two people act at once?** The cancel locks the order row; a save of the same order
   waits and then sees `CANCELLED` and is refused.
7. **What moves in reports, and from when?** Stock and cost from the order's date on; the P&L of
   every month from that date (cost of goods, purchases used at once, depreciation); the cash book
   day row and every balance after it. Nothing before the order's date moves.
8. **Can a cancel be undone?** No, like a cancelled cash entry. Re-enter the order instead.

## 3. Data — migration `0108` (no `create table`)

`purchase_orders` gains `cancelled_at timestamptz`, `cancelled_by_id text`,
`cancelled_by_name text`, `cancel_reason text`, all null. Check `cancelled_has_reason`:
`status = 'CANCELLED'` if and only if `cancelled_at` and a non-blank `cancel_reason` are set.

**Writer inventory** (`fnbapp-bulk-data-change` §6, for the new check):
- `save_purchase_order_atomic` (live version `0107`): updates or inserts with the status from the
  payload, never touches the four new columns. Under the check, a payload saying `CANCELLED` fails;
  `0108` also makes it refuse when the stored row is already `CANCELLED` ("Phiếu đã huỷ, không sửa
  được"), before the check is reached.
- `setPurchaseOrderPayment`: two columns on a `COMPLETED` order only; unaffected.
- `cancel_purchase_order_atomic` (new, below): the only writer of `CANCELLED`.
- Backup restore (`lib/db/backup-restore.ts`): restores rows as they are; a pre-`0108` bundle has
  no cancelled rows. The edge function's table list is unchanged (no new table).

Triggers: `purchase_orders` and `assets` carry `touch_updated_at` (`updated_at` moves on the rows
touched); nothing else, per the trigger list in the migration text (`0106`, `0107` headers).

**`purchase_order_cancel_check(p_id text) returns jsonb`** (stable, service_role only). One source
for both the page and the cancel. Returns `{ blocked: [...], assets: [...] }`:
- not found → blocked `NOT_FOUND`; already `CANCELLED` → `ALREADY_CANCELLED`.
- `DRAFT` → nothing else checked (a draft touched no stock, cost, money or asset).
- `COMPLETED`:
  - **Stocktake:** `issue_slip_stocktake_lock(coalesce(transaction_date, created_at))` is not
    null → `STOCKTAKE { stocktake_id, confirmed_at }`. Compared as moments, as `0106` does for slips.
  - **Below zero, at any moment from the order's date to now** (owner 2026-10-05, *"a"*): per
    item on the order, the lowest balance from the order's moment to now, by the formula of
    `issue_stock_headroom` (`0106`: completed purchase lines minus `stock_issues`, a purchase at
    the same instant first), minus the order's quantity for that item < 0 →
    `NEGATIVE { item_id, item_name, low_balance, low_at, order_qty, base_unit }`, one per item.
    `low_at` is the moment of that lowest balance. The function takes the same advisory lock as
    the issue-slip writers (`stock_issues:id`), so a slip saved at the same instant waits.
  - **Disposed asset:** an asset made from one of its lines has an `asset_disposals` row →
    `DISPOSED { asset_id, name }`.
  - `assets`: every asset made from its lines that is not `INACTIVE` (id, name, quantity,
    total_cost) — what the cancel will retire.

**`cancel_purchase_order_atomic(p_id, p_reason, p_actor_id, p_actor_name) returns jsonb`**: locks
the order row (`for update`), runs the check, refuses with the first blocker's Vietnamese message
(§6) if any, refuses a blank reason or one over 500 characters; else sets the order `CANCELLED`
with the four columns, and sets each listed asset `INACTIVE`. One transaction (`BR-INV-002`).

## 4. Roles

Cancel: ADMIN and MANAGER (`requireAdmin`), as for cancelling an issue slip or voiding an order.
The button is hidden for STAFF and the server refuses them.

## 5. Screens

**Detail `/admin/inventory/purchase-orders/[id]`.**
- Draft or completed, ADMIN/MANAGER: a "Huỷ phiếu" button (danger outline) next to the existing
  ones, linking to `[id]/cancel?returnTo=…`.
- Cancelled: header badge "Đã huỷ"; a block "Lý do huỷ: … · Huỷ bởi {name} lúc dd/MM/yyyy
  HH:mm:ss" (Saigon); no edit, no "Huỷ phiếu", "Trả bằng" shown read-only.

**New page `/admin/inventory/purchase-orders/[id]/cancel`** (`BR-DATA-007`: an input is a page).
- Top: code, date, supplier, total, "Trả bằng".
- If the check returns blockers: each as a sentence (§6), no reason box, only "Quay lại".
- Else, what will happen, in plain words:
  - "Phiếu sẽ không còn tính vào tồn kho, giá vốn, lãi lỗ và sổ thu chi từ ngày {date}."
  - If assets: "Các tài sản sau sẽ ngừng, khấu hao đã tính cho các tháng trước được gỡ ra:" then
    one line per asset (code, name, quantity, cost).
  - "Lý do huỷ (bắt buộc)" text box, 500 characters at most; "Xác nhận huỷ" disabled while blank;
    "Quay lại".
- On success: back to the detail page (it now shows "Đã huỷ"). On a refusal from the server (state
  changed meanwhile): the message shows in the page, the box keeps its text.

**List.** Status filter: **Chưa huỷ** (default: drafts and completed), Nháp, Hoàn thành, Đã huỷ,
Tất cả — the template's rule that the default hides retired rows. Badge "Đã huỷ" (muted). The
`status` value in the address: `ACTIVE` for the default.

**Supplier detail.** Badge "Đã huỷ" for a cancelled order.

**Phone:** the cancel page is one column; buttons full width.

## 6. Messages

| Case | Message |
|---|---|
| Stocktake | "Phiếu ngày {dd/MM/yyyy} nằm trước lần kiểm kê {STK-001} ({dd/MM/yyyy}), nên không huỷ được: lần kiểm kê đã đếm lại hàng trên kệ." |
| Below zero | "Huỷ phiếu này làm tồn kho âm: {item} lúc thấp nhất ({dd/MM/yyyy HH:mm}) chỉ còn {low_balance} {unit}, phiếu có {order_qty} {unit}. Hàng của phiếu đã được dùng, nên phiếu này là thật." (one line per item) |
| Disposed asset | "Tài sản {TS-xxx} {name} của phiếu đã thanh lý, nên không huỷ được phiếu." |
| Already cancelled | "Phiếu đã huỷ rồi." |
| Blank reason | "Lý do huỷ phiếu là bắt buộc" |
| Reason too long | "Lý do huỷ tối đa 500 ký tự" |
| Save over a cancelled order | "Phiếu đã huỷ, không sửa được" |

Numbers in Vietnamese format (`42.000 ml`).

## 7. What does not change

Money and stock readers (§2 point 5). Drafts' behaviour. The "Trả bằng" rules. The cash book
view. Issue-slip and stocktake rules. No row is ever deleted.

## 8. Known limits, told to the owner

- Cancelling moves P&L of every month from the order's date; there is no month lock.

## 9. Worked examples (measured 2026-10-05, read only)

**Can be cancelled, with an asset: `PO-147`, 13/08/2026 00:00, 20.200đ, Tiền mặt.**
- One line, Vòi rót rượu 2 Cái → asset `TS-080` (2 cái, 20.200đ, 12 months, from 13/08/2026).
- After cancel: `TS-080` becomes `INACTIVE`; depreciation falls by 20.200 / 12 = 1.683,33…đ in each
  of August, September and October 2026 (5.050đ through October).
- Cash book, 13/08/2026: "Nhập hàng · Tiền mặt · 3 đơn nhập · 182.306đ" (`PO-082` 130.000đ,
  `PO-147` 20.200đ, `PO-148` 32.106đ) becomes "2 đơn nhập · 162.106đ"; the cash balance on every
  later day rises by 20.200đ.

**Refused, below zero in the past only: `PO-064`, 12/08/2026, Trứng gà 60 trái.** Stock on
2026-10-05 15:50 is 116, so a check of today alone would allow it; but on 03/10/2026 22:32, after
a slip of 374 trái, it fell to 21; without the order it would have been −39. Message: "Huỷ phiếu
này làm tồn kho âm: Trứng gà lúc thấp nhất (03/10/2026 22:32) chỉ còn 21 trái, phiếu có 60 trái…"

**Refused, below zero today: `PO-066`, 20/08/2026.** Sữa tươi Mlekovita 60 Hộp = 60.000 ml against
a lowest of 42.000 ml (also today's stock): −18.000 ml. Its second line, Đào ngâm Rich 24, is also
refused: that item's lowest since 20/08 is 0.

All 17 refused for this reason (2026-10-05 15:50): `PO-064`, `PO-065`, `PO-086`, `PO-154`,
`PO-159`, `PO-168`, `PO-183`, `PO-188`, `PO-192`, `PO-199` (Trứng gà); `PO-087`, `PO-167`,
`PO-190` (Sữa chua không đường Vinamilk); `PO-066`; `PO-089` (Bột cà phê truyền thống Phin Đậm);
`PO-180` (Sữa đặc Ngôi Sao Phương Nam); `PO-181` (Giấy lót chống tràn).

**Refused, stocktake: `PO-063`, 03/08/2026, 736.000đ** — the last order before `STK-001`
(confirmed 09/08/2026 22:02): "Phiếu ngày 03/08/2026 nằm trước lần kiểm kê STK-001 (09/08/2026),
nên không huỷ được…". On the edge: `PO-161`, dated 10/08/2026 00:00 Saigon (09/08 17:00 UTC), is
**after** the count and may be cancelled; a day cut in UTC would wrongly refuse it.

Count (2026-10-05 15:50): 199 orders; 151 on or before `STK-001`; of 48 after, 17 below zero at
some moment; **31 can be cancelled**, 3 of them with assets (`PO-147`, `PO-148`, `PO-149`). The
count moves with every issue: that morning, before 25 eggs were issued and with a check of today
only, it was 43.

## 10. Tests that must exist

- Migration text: the four columns, the check, both functions `service_role` only, the save refusal
  on a cancelled row, assets set `INACTIVE` in the same function.
- Pure message builder: each blocker → its §6 sentence with real-looking numbers.
- Server action `cancelPurchaseOrder`: STAFF refused; blank and 501-character reason refused;
  passes actor name; maps RPC refusals to Vietnamese.
- `savePurchaseOrder` over a cancelled order: refused, nothing written, no asset created.
- List: default hides cancelled; "Đã huỷ" shows only cancelled; badge.
- Detail: cancelled shows reason, no edit, no "Huỷ phiếu"; STAFF sees no "Huỷ phiếu".
- Cancel page: blockers shown and no box; assets listed; button disabled while blank.
- After the release: dry read with `purchase_order_cancel_check` on `PO-147`, `PO-064` and `PO-066`
  reproduces §9 before anyone cancels anything.

## 11. Split of the work

- Sonnet: migration `0108`, the two functions, `cancelPurchaseOrder`, the save refusal, message
  builder, list filter logic (`purchase-order-list.ts`), their tests.
- Gemini (`agy`): cancel page, detail page changes, list filter and badge, supplier badge, their
  tests.
- Opus: review, gates, docs (`docs/03-workflows/purchasing.md`, `TABLE-DICTIONARY.md`).
- Release order: code and `0108` together is impossible (separate approvals), so code first —
  the page calls a function that does not exist yet and shows "Chưa cập nhật dữ liệu" until
  `0108` runs; nothing else reads the new columns.
