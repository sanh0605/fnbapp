# Inventory and production rules

Purchase-order rules (`BR-INV-002`, `BR-INV-015`, `BR-INV-016`, `BR-INV-018`) are in `docs/02-rules/business-rules/purchasing.md`; stocktake rules (`BR-INV-010`, `BR-INV-011`, `BR-INV-012`, `BR-INV-017`) are in `docs/02-rules/business-rules/stocktake.md`.

### BR-INV-001 — Quantity movement belongs in the stock ledger

**Status:** `RETIRED`, effective 2026-09-02 — successor `BR-COGS-005`

Purchase receipts, sale consumption, adjustments, production input, production yield, and reversals must be explainable through `stock_ledger` records and their business references.

Superseded by `BR-COGS-005` (owner decision 2026-08-04, cutover 2026-08-07) in practice well before this retirement was recorded: once cost moved to the issue-based figure, no report or screen read `stock_ledger` for money, and by 2026-09-01 nothing wrote to it either — the table sat frozen, explaining nothing new. Phase D (owner-approved 2026-08-28/2026-09-02) drops `stock_ledger` and `inventory_balances` outright, along with their trigger and trigger function — migration `0096`, **applied on the server** (confirmed by `supabase migration list`, 2026-09-11). Quantity movement for cost purposes now runs on exactly one path: `stock_issues` (`BR-COGS-005`). This rule is retired regardless of whether the drop has run yet, since the table already explains nothing live either way.

### BR-INV-003 — BTP consumption follows reviewed recipe/yield evidence

**Status:** `RETIRED`, effective 2026-08-07 — successor `BR-INV-006`

Semi-product production and consumption must retain the recipe/yield evidence needed to explain sale-time COGS. Later recipe replay can differ from the pinned transaction without authorizing historical mutation.

Superseded by `BR-INV-006` (owner decision 2026-08-05). Plan C Task 5 applied the cutover on 2026-08-07: every `PRODUCTION_CONSUME`/`PRODUCTION_YIELD` `stock_ledger` row deleted, semi-product balances fell to `0`. Measured: of 16 active semi-products, 11 carry an `inventory_balances` row and every one reads exactly `0.000000`; the other 5 never had `stock_ledger` activity, so no row exists for them either — also zero by absence. There is no recipe/yield evidence left for this rule to protect — semi-products carry no stock to explain.

### BR-INV-006 — Semi-products carry no stock and no value

**Status:** `APPROVED` — owner decision 2026-08-05

Semi-products are things the shop makes rather than buys — syrups, brewed tea, boiled sweet potato. They are no longer tracked as stock, hold no value, and no screen records making a batch. Nothing about them is kept any more: the owner decided on 2026-08-27 to remove recipes, and the semi-product list itself, with its batch tables, is dropped by migration `0105` (owner-approved 2026-09-28).

**Why the cost does not vanish with the tracking.** The ingredients were already expensed the moment they left stock. A pot of brewed tea is not a new asset; it is goods already paid for, in a different shape. Recording it as stock with a value of its own would count the same money twice.

**Why this reverses the 2026-07-31 decision to keep semi-product stock.** That decision served the inference chain this design removes, and the arithmetic ends it regardless. Measured 2026-08-05: 16 active semi-products hold 3.919 `stock_ledger` rows, and **every one of them is a transaction type the cutover deletes** — `PRODUCTION_YIELD` in, `SALES_CONSUME` out. None is a purchase receipt, because a semi-product is never purchased.

Raw ingredients survive deletion because purchases remain underneath them: stock reads as everything ever bought, inflated but real, and the first count corrects it. Semi-products have no such floor. They fall to zero with nothing able to add to them, and a count could not value them either, since they have no purchase price to draw on.

The owner was shown both directions before deciding — Sữa tươi rising from 50.750 g to 134.450 g against semi-products falling from 40.550 to 0 — and chose to drop the tracking rather than rebuild a mechanism for it.

Supersedes `BR-INV-003`, effective on the Plan C cutover.

### BR-INV-004 — Negative stock is investigated, not silently fabricated away

**Status:** `APPROVED`

Negative-stock findings require physical/business evidence and an approved correction path. Unresolved negative stock remains visible in audit/roadmap records.

### BR-INV-005 — A count above everything ever purchased is refused, never valued

**Status:** `APPROVED` — owner decision 2026-08-04

Counting happens per purchased item. A count below expectation needs no rule: goods taken by mistake, or taken in excess, leave that item short and are valued correctly without anyone declaring intent.

A count that exceeds the item's total ever purchased is different in kind. No handling error creates physical goods; either the purchase was recorded against another item code, or the stock predates the system. That line is refused and the surplus is left unvalued — a price assigned to goods with no purchase behind them is a guess that enters the cost figure permanently.

The refusal presents every other purchased item sharing the same base ingredient, with each one's purchased total and counted quantity, because a mis-recorded purchase almost always lands on a sibling brand. The refusal is scoped to the single line; the rest of the session saves.

Applies from the issue-based COGS path (Plan B, parallel path).

### BR-INV-007 — Count sealed packages only; cost is recognised when a package is opened

**Status:** `APPROVED` — owner decision 2026-08-07. **Built** by Plan D: the count screen takes whole sealed packages only and refuses a fraction (`StocktakeLineCards.tsx`). Checked 2026-10-15.

A stocktake counts only packages that are still sealed. An opened package is not counted and not estimated. The owner's own example: the 100 g bag of `Dâu sấy` is finished, the 500 g bag is open and in use, the 1 kg bag is sealed — only the 1 kg line gets a number.

**This is an accounting policy, not a data-entry convenience.** Cost is recognised at the moment a package is opened rather than as its contents are consumed. Consequences, all intended:

- The stock figure means **sealed stock**, and understates what is physically present by whatever sits in open packages.
- Cost runs ahead of true consumption by at most one open package per item.
- The error is **bounded and does not accumulate**: each package is expensed exactly once, at the first count where it is no longer sealed.

**Why this beats a more precise rule.** It removes all weighing and estimating. A rule the owner can follow at the shelf is worth more than a more accurate one he cannot.

**Counting is by package, not by unit name.** Measured 2026-08-07: 48 purchased items have one purchase unit, 3 have two, 1 has three — and two items carry the dangerous shape where the same unit name means different sizes. `Dâu sấy` has three `ACTIVE` conversions all named **Túi** (100 g, 500 g, 1.000 g), all used in real purchases, so "how many Túi?" has three answers differing by ten times. Each package size is therefore its own count line, labelled with the size derived from `conversion_rate` — no master data is renamed.

**Worked example, real figures.** `Dâu sấy` (`ING-028`): 4.100 g bought for 2.443.600đ, a weighted average of exactly **596 đ/g**. Counting one sealed 1 kg bag gives 1.000 g on hand, an issue of **3.100 g** costing **1.847.600đ**, and remaining stock worth **596.000đ** — which reconciles against the 2.443.600đ paid.

**Observed 2026-08-10, first real count: some items will read 0 for ever, and that is the rule working.** `Nước đường Glofood` counted 0 against a theoretical 50 kg. The owner explained why, and it is not an error: syrup is measured by the can, a can is finished once opened, and at current volume a can is opened as soon as it arrives. There will essentially never be a sealed can, so this item costs out as everything bought in the period.

This is the edge Sonnet named while reviewing `BR-INV-007`: an item that always has exactly one open package can never show sealed stock, so each period expenses that period's purchases in full. For such items the rule collapses into expense-on-receipt, which is the honest treatment when the shop genuinely cannot say how much is left. **Expect a permanent 0 on the stock screen for them, and do not read it as a missed count.**

### BR-INV-008 — Counting more than expected is recorded as goods found, not refused

**Status:** `APPROVED` — owner decision 2026-08-07. **Implemented 2026-08-08** (Plan D D5b, `0056_found_stock.sql`): the `stock_issues.base_quantity` constraint now accepts a negative value (the `NaN` guard kept alongside it), `save_stocktake_line_atomic` no longer refuses the found-stock range, and the negative issue row carries a Vietnamese note explaining itself. Verified live against real `Dâu sấy` data inside a rolled-back transaction — nothing persisted; see the plan's D5b entry for the five checks. The count screen writes it since Plan D D7. Live 2026-10-15: STK-001 wrote 49 rows, none of them goods found.

When a count exceeds the theoretical quantity but stays within everything ever purchased, the system accepts it and records **hàng tìm lại được**: the quantity returns to stock at the weighted average it left at, which leaves the average unchanged and closes the discrepancy permanently.

**What the case really is.** Under `BR-INV-007` the usual cause is a sealed package missed at an earlier count, expensed then, and found now. Goods thought consumed have reappeared. Concretely (example of 2026-08-07): a 1 kg bag of `Dâu sấy` worth 596.000đ.

**Why the first proposal was withdrawn.** It was to correct the ingredient quantity and record no issue at all. Sonnet's challenge showed that a purchased item's theoretical quantity is recomputed every time as `purchase_order_lines − stock_issues` and never reads `stock_ledger`, so correcting the ingredient closes nothing: the same discrepancy would reappear **at every future count, for ever**. It had been described to the owner as a one-off note; it would have been a prompt that never stopped. The costing stayed correct throughout — no event reached the replay — but the description was wrong, and the owner was told so before deciding.

**Implementation consequence to face rather than defend.** `stock_issues.base_quantity` carries `check (base_quantity > 0)` (`0052_stock_issues.sql`). This rule requires that to accept a negative value. The earlier position — "a negative issue is a different event wearing the wrong name" — reads well but leaves the loop open, and was set aside for that reason.

**Reporting impact — say this before the owner finds it himself.** A found event reduces the *current* period's cost, not the past period where the over-issue originally happened. That is correct accounting (a prior-period correction lands in the period it is discovered), but it means a month with a large found event will show unusually low COGS. Flagged here in advance so a low figure reads as this rule working, not as a data error to investigate.

**Edge settled 2026-08-07:** a found event when the on-hand quantity is zero has no live average to draw on (`value/quantity` is `0/0`). Resolved as the **last unit cost the item left at** (the rate of the issue that emptied the pool), not a lifetime average of all purchases — that is the exact inverse of the depleting issue and the only choice that leaves the weighted average unchanged. A found event with no purchase ever recorded still refuses; a lot that never existed cannot be found. Implemented in `lib/costing/issue-costing.ts` (`computeIssueCosting`), Plan D K6, 5 tests.

### BR-INV-013 — "Xoá" on an issue-slip line returns the goods to stock the day it is pressed; the line leaves the slip view

**Status:** `APPROVED` — owner decision 2026-09-29. **Implemented** on branch `feat/issue-slip-list` (`supabase/migrations/0106_issue_slip_edit.sql`, `8c158f8`; screens `9bd0c2f`, `1989b6a`, `2b68a45`). Migration `0106` ships together with that code. It keeps `BR-INV-009`'s mechanism and changes only what the screen shows and asks.

**What was decided, in order, the same day.**
1. The owner was offered two meanings of "Xoá": the `BR-INV-009` return to stock dated today, or a real delete as if never issued. The example used real data: slip ISL-00040 (01/09/2026) issued 500 g of Bột cà phê MR.PHIN Robusta Dak Mil, and the line is deleted on 15/10.
2. He first chose the real delete: *"Chọn cách 2, anh cần dữ liệu được tối giản. Project này chưa đủ lớn để theo dõi chi tiết từng thao tác."*
3. He was then told three consequences of the real delete:
   - It would need an exception so managers could delete outright.
   - September's report, and slightly every later month through the running average, would change.
   - A line dated before a confirmed stocktake is a problem under **both** meanings.
4. He asked whether to go back to the first meaning and chose it (*"A"*). The screen stays as simple as he asked; the data keeps one compensating row per deleted line.

**Rule.**
- **Mechanism.** Deleting a line writes the `BR-INV-009` compensating row: dated today, valued at today's running average. The month of the mistake keeps its figure, and the correction lands in the month it is made.
- **Display.** A deleted line disappears from the slip's detail view: no strike-through, no "đảo" wording. The compensating row is not shown as a line of the slip.
- **Buttons.**
  - The detail page has "Chỉnh sửa". In edit mode the user picks one line, several, or all, then "Xoá".
  - "Huỷ phiếu" stays, and does the same thing to every remaining line.
  - If every line is deleted, the slip asks whether to cancel the slip. If the user declines, at least one line must be entered before the slip can be saved. Owner's words: *"nút huỷ phiếu vẫn để, nếu xoá hết dòng thì phiếu sẽ hỏi người dùng về việc huỷ phiếu. Nếu không huỷ phiếu thì yêu cầu người dùng nhập ít nhất 1 dòng để lưu phiếu."* <!-- undated-ok -->
- **Who.** The owner and managers (`requireAdmin()`), as today. Nothing is deleted outright, so the "only ADMIN deletes" rule does not apply.
- **Lines before a confirmed stocktake cannot be deleted.** This means any line whose issue date is on or before the confirmed date of the most recent confirmed stocktake. That count already put the goods back on the book as found stock. Returning them again would leave the book that much above the shelf. The screen says why and points to the next count. The reversal from `0058` had no such block; `0106` adds it to `reverse_manual_issue_atomic`, `cancel_issue_slip_atomic` and `edit_issue_slip_atomic`.

**What "Chỉnh sửa" allows** (owner 2026-09-29, *"A"*): deleting lines, changing a quantity, and adding lines.
- **Changing a quantity** is a delete plus a new line, **both on the slip's own date** (owner 2026-09-29, answer *"1"*; this replaces the first version, where the old quantity went back to stock today). Example: 500 g changed to 300 g returns 500 g and issues 300 g, both on the slip's date, so that month's cost ends up as if 300 g had been entered in the first place.
- **Added lines** take the slip's own date, like the lines entered when the slip was made.
- **A slip dated on or before the most recent confirmed stocktake cannot be edited at all.** A new line backdated before that count would leave the book below the shelf, just as a delete would leave it above.

**Cancelled slips in the list** (owner 2026-09-29, after seeing the mockup): hidden by default. Choosing Loại = "Đã huỷ" in the list's filter shows them. Owner's words: *"Bình thường thì ẩn, chọn Loại = \"Đã huỷ\" trong bộ lọc mới thấy."* He was told the trade-off beforehand: slip numbers then appear to skip in the default list.

**Stock check on backdated lines** (owner 2026-09-29, *"theo khuyến nghị"*, both questions answered A).
- **The check covers the slip's date through today, not the slip's date alone.** Any line written on an earlier date, whether by a new slip or by "Chỉnh sửa", must not push stock below zero at any later moment. Otherwise the costing engine stops with "issue exceeds quantity on hand" and the reports built on it stop opening. This part was a technical decision, reported to the owner.
- **Raising a line's quantity can be refused even when the difference seems available** (question 1, answer A). Example from ISL-00076: from 28/09 to 2026-09-29 Bột sữa B One never had more than 1.000 g in stock. In the first version, changing its line from 1.000 g to 1.500 g returned the 1.000 g today but issued 1.500 g on 28/09, so stock would sit 500 g below zero in between, and the edit was refused. The refusal says how much is left and suggests adding a separate 500 g line, which passes. Option B was to split the difference into a second line automatically; the owner did not take it.
- **Changing a quantity returns the old quantity on the slip's own date** (owner 2026-09-29, *"1"*). Found in review: with the return dated today, even *lowering* a line could be refused. Example put to him: 1.000 g of Bột sữa B One issued on the 10th, stock down to 200 g on the 15th, line lowered to 500 g today: between the 10th and today both 1.000 g and 500 g counted, so stock went to −300 g and the edit was refused. It also split one correction across two months. Now both halves land on the slip's date: lowering is not refused unless the book is already below zero somewhere after the slip's date, and raising is refused only when the extra part (500 g in the ISL-00076 example) is itself more than the stock left from the slip's date to today. He was told beforehand that the report of the slip's month changes after the edit. **Unchanged:** "Xoá" on a line and "Huỷ phiếu" still return goods today (`BR-INV-009`), as decided earlier the same day; the stocktake block still applies.
- **A new slip cannot be dated on or before the most recent confirmed stocktake** (question 2, answer A). This is the same block as for editing, for the same reason: the count already fixed the book at that date.

### BR-INV-014 — An issue slip carries no reason and no free-text note

**Status:** `APPROVED` — owner decision 2026-10-01. Replaces the earlier open item "Danh sách lý do xuất do chủ quán tự thêm, sửa, ngừng dùng".

**What he was shown.** Measured on the live database on 2026-10-01: 83 slips, 77 noted "Khác" with no detail, 6 noted "Hao hụt / hư hỏng", none "Dùng nội bộ". The "Khác" slips are mostly daily bar stock (Sữa tươi Mlekovita on 33 lines, Sữa đặc La rosee 19, the two coffee powders 13 each, Trứng gà 11). He was also told that every manual issue lands on the P&L's Giá vốn line whatever its reason (`BR-COGS-007`), so a "Hao hụt / hư hỏng" slip never reached the Hao hụt line. Asked whether the reason should decide the P&L line, he answered: *"Anh không cần lý do xuất nữa."* Asked whether to keep the optional detail box as "Ghi chú", he chose to drop it too (*"B"*).

**Rule.** The create screen has no "Lý do" select and no "Chi tiết" box; a new slip is saved with an empty note. Every manual issue stays on Giá vốn (`BR-COGS-007` unchanged), so no report figure moves. Old notes are erased too (owner 2026-10-01: *"Các phiếu cũ thực ra đều xuất để pha chế nhưng làm vội… em cho thay đổi lại hết lí do hoặc xoá hết nhé, tránh nhầm lẫn"*): 83 slips and their 155 issue lines, by a one-off script (removed 2026-10-17). Return rows keep their notes, which carry the cancel reason. The "Theo lần xuất" report titles a slip by its item names, not its note. The cancel reason ("Lý do huỷ phiếu") is a different field and stays required (`BR-INV-013`).

### BR-INV-009 — Reversing a mistaken issue slip lands today, at today's average, using BR-INV-008's mechanism

**Status:** `APPROVED` — owner decision 2026-08-08 (`259103e`, Plan D §5 I7 in full). **Implemented** (Plan D D7b, `0058_reverse_manual_issue.sql`, `reverse_manual_issue_atomic`), extended 2026-08-09 by D14 (below). Still the mechanism for issue slips; `BR-INV-013` (owner 2026-09-29) changes only the screen and adds the stocktake block.

A manual issue slip entered by mistake is never deleted and never edited. It is marked reversed and answered with a compensating entry: quantity `-`original, dated **today**, valued at **today's running average** — not the rate that was in effect at the moment of the mistake, and not backdated to that moment. Both rows stay visible and linked.

**Why today, not the original moment — this was the open question, and it was already decided once.** `BR-INV-008` puts goods found during a count back in the period they are *found*, not the period the shortfall happened in, and the owner accepted that shape knowingly. A mistaken slip is the same kind of event — quantity recorded as having left that never actually left — so it is corrected the same way. Two more reasons: Plan C spent a week removing the machinery that silently rewrote closed periods (Plan C, Task 6), and reversing at the original moment would rebuild that by hand; and the replay in `lib/costing/issue-costing.ts` is chronological, so an event inserted into the past would revalue the running average for every issue after it, not just the one being corrected.

**Mechanically, a reversal *is* a `BR-INV-008` found-stock event** — same code path, same sign (negative `base_quantity`), same live-average valuation — carrying a link to the slip it reverses and a note naming it. No second mechanism is built for this.

**What is conserved, and what is not.** Money is structurally conserved at any valuation rate: a reversal adds *v* to stock value and removes the same *v* from recognised cost, so `total paid = stock value + net cost recognised` holds regardless of which rate is used. Using **today's live average** additionally leaves the average itself unchanged — the specific invariant `BR-INV-008` exists to protect — which the original moment's rate would not have (it would restore the money correctly but move the average).

**What the owner gives up, stated plainly, the same price already accepted for found goods:** the month the mistake happened in keeps its wrong figure forever. The correction shows up in the month it is caught, not the month the mistake was made.

**Extended 2026-08-09 (Plan D D14) to two whole-event forms of the same mechanism, not a new valuation rule:**

- **Undoing a whole confirmed stocktake session.** Owner reason: *"không có gì chắc chắn nhân viên đúng 100% cả. Nếu sai thì phải hủy phiếu cũ tạo phiếu mới chứ."* Compensating rows only (one per `stock_issues` line the session wrote, one per `stock_ledger` ingredient correction it wrote), same today's-average valuation, original rows never touched. **Owner-only** — `requireOwner()` (`lib/auth/auth.ts`), stricter than every other action in the system, because a stocktake checks the person counting and the person being checked cannot be the one who can erase the check. Only the most recently confirmed session may be reversed, refused while any session is `OPEN`, a reason is required. The session gets a new status, `REVERSED`. A session abandoned before apply is not kept at all (`BR-INV-010`).
- **Cancelling a whole issue slip**, beside the existing per-line reversal — settles I11 (Plan D §5 I11). Reverses every not-yet-reversed line of a slip in one call, one reason. Same `requireAdmin()` level as the existing per-line reversal, deliberately not raised to owner-only — an issue slip records waste or internal use, not a check on the person who counted.

Implemented `supabase/migrations/0062_reverse_confirmed_stocktake_and_issue_slip.sql`; full case list in the plan's §5 "Undoing a confirmed count or a whole issue slip" (U1-U13).

### BR-INV-019 — The Tồn kho page shows quantity, value and last-count date, and an automatic "đủ dùng khoảng X ngày"

**Status:** `APPROVED` — owner 2026-10-15, Kho area audit questions Q1 and Q2. Built 2026-10-15 on the branch `feat/khuon-chung-ban-hang-kho`, not yet pushed: page `/admin/inventory/stock`, first entry of the Kho menu (`docs/superpowers/specs/2026-10-15-ton-kho-design.md`). Measured on the built page that day: 69 items, 18.013.339đ; Phin Đậm 2.500 g against 7.500 g issued in 30 days, "khoảng 10 ngày". Đủ dùng rounds down and counts staff slips only, not stocktake differences.

- **What each row shows** (Q1, *"Số lượng + tiền + ngày kiểm"*): the quantity on hand, what it is worth, and the date of the item's last stocktake count, or "chưa kiểm lần nào". The total value sits at the top. He was shown, measured that morning: a total of 18.118.999đ, and "Ly Uchako 700ml — 1.650 ly — 2.053.982đ — chưa kiểm lần nào". He chose this over two extra filters ("chưa kiểm bao giờ", "lâu chưa xuất") and over quantity only.
- **"Sắp hết" is worked out, never typed** (Q2, *"Tự tính đủ dùng X ngày"*): stock on hand divided by the item's issue slips over the last 30 days. Example shown: Bột cà phê truyền thống Phin Đậm, 2.500 g left, 8.000 g issued in 30 days, about 9 days. He chose this over setting a minimum on each of about 69 items, as on 2026-09-28. He was told an item staff never issue shows blank.

### BR-INV-023 — Purchase-unit conversions are edited only on the item's own page

**Status:** `APPROVED` — owner 2026-10-15, Kho area audit question Q10, *"Bỏ trang Bảng quy đổi"*. Not built yet (`docs/superpowers/specs/2026-10-15-kho-de-xuat.md`).

- The standalone "Bảng quy đổi" page, reached from a button on Hàng hoá, goes. It edited the same rows as the item page under a different delete rule.
- The "Quy đổi" column on the Hàng hoá list stays, read-only.
