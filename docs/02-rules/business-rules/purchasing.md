# Purchasing rules

Purchase orders: how they are written and cancelled. Flow: `docs/03-workflows/purchasing.md`.
Moved here from `inventory.md` on 2026-10-05, when that file passed its 200-line ceiling; the codes keep their `BR-INV-*` names.

### BR-INV-002 — Critical multi-row writes are atomic

**Status:** `APPROVED`

Purchase orders, reviewed recoveries, and other critical flows that change multiple dependent rows must use an atomic transaction/RPC path or a reviewed equivalent. A partial success is not an acceptable business result.

### BR-INV-015 — A completed purchase order can be cancelled; it is kept, marked "Đã huỷ"

**Status:** `APPROVED` — owner decision 2026-10-05. **Not built yet**; design `docs/superpowers/specs/2026-10-05-huy-phieu-nhap-design.md`, waiting for his approval.

Until 2026-10-05 a completed purchase order could only be edited, never removed, and it must keep at least one line, so an order entered twice stayed counted twice in stock, cost and the cash book with no way out (measured that day: 199 purchase orders, all completed). Offered "no cancel" or "cancel with a typed reason, kept and marked", the owner answered *"Làm theo em khuyến nghị"* (the second).

- **Never deleted** (data rules: an order is never deleted). The cancelled order stays in the list as "Đã huỷ" with the reason typed when cancelling.
- **It leaves stock, cost and the cash book.** He was told before choosing that cancelling an August order recomputes the weighted-average cost from August on, so profit and loss for those months changes.
- **An order whose equipment became assets can be cancelled; its assets are retired with it** (owner 2026-10-05, *"1b để nếu nhập nhầm thì có thể huỷ phiếu và nhập rồi tính chi phí khấu hao từ ngày nhập thực tế"*). They become `INACTIVE`, so their depreciation leaves every month, earlier ones included; re-entering the right order creates new assets from its real date (`BR-COGS-008`). He was offered "refuse" first and chose this. If any of those assets has a disposal, the cancel is refused, as for an item leaving equipment (`BR-COGS-008`).
- **An order dated on or before the last confirmed stocktake cannot be cancelled** (owner 2026-10-05, *"2a"*): the count already put the shelf on the book; cancelling an earlier order would leave the book below the shelf. Same reason as `BR-INV-013`.
- **A cancel that would leave any item's stock below zero is refused**, naming the item (owner 2026-10-05, *"3a"*), as an issue slip may not issue more than is on hand. A genuinely duplicated order never goes below zero; going below zero means the goods were real and used. Example shown: `PO-199` (04/10/2026), Trứng gà 120 trái against 141 on hand, leaves 21, so it may be cancelled.
- **Measured 2026-10-05, 199 orders:** 151 are dated on or before `STK-001` (confirmed 09/08/2026 22:02, Saigon); of the 48 after it, 5 would go below zero; 43 can be cancelled, 3 of them with assets. The order's moment is `transaction_date`, else `created_at`, compared with the stocktake's `confirmed_at` as a moment, not as a day: `PO-161` is dated 10/08/2026 00:00 Saigon (09/08 17:00 UTC) and is after the count. A first count cut the day in UTC and wrongly put it before.
