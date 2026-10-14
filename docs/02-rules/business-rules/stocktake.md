# Stocktake rules

Moved here from `inventory.md` on 2026-10-14, when that file reached its 200-line ceiling; the codes keep their `BR-INV-*` names. Undoing a whole confirmed stocktake is part of `BR-INV-009` in `inventory.md`.

### BR-INV-011 — A blank line is not counted; a count covers only the items given a number

**Status:** `APPROVED` — owner decision 2026-09-28, confirming what `apply_stocktake_session_atomic` already does (it skips lines with no counted quantity).

A session may be confirmed with lines left blank. A blank line means **not checked this time**, never zero: its book quantity stays as it is and no shortfall or found row is written for it. The count is a count of the items that were given a number, and only those. Owner's words: *"Các món bỏ trống mặc định là chưa kiểm và xem như lần kiểm đó chỉ kiểm các món có nhập số lượng."* Someone who finds an item gone must type 0 for it; leaving it blank records nothing.

### BR-INV-010 — Cancelling a stocktake session keeps nothing

**Status:** `APPROVED` — owner decision 2026-09-28. **Implemented** `supabase/migrations/0103_stocktake_cancel_deletes_session.sql`.

A stocktake session cancelled before it is confirmed is deleted outright: the session, every counted line, and no `CANCELLED` status left behind. Owner's words: *"tất cả các phiếu kiểm kê khi bấm bắt đầu nhưng bấm huỷ thì sẽ không lưu lần kiểm kê đó cũng không lưu trạng thái bị huỷ."* This replaces the 2026-08-09 rule (Plan D D12) that kept a cancelled session whenever at least one line had been counted.

**Who may cancel:** the owner and managers (`requireAdmin()`), confirmed by the owner the same day — *"Chỉ anh và quản lý được huỷ."* Like a POS draft, an unconfirmed count has not touched stock, so it sits outside the "only ADMIN deletes outright" rule.

**The price, stated to the owner before the decision:** counting work abandoned by a cancel is gone with no trace. STK-003 had 11 items counted over 15/09–27/09 before it was cancelled; under this rule nothing of it would remain. The two cancelled sessions already stored (STK-002, STK-003) are deleted by the same migration.

**One-time exception to `BR-INV-009`, 2026-09-28: STK-004 erased, not reversed.** The owner asked to delete the 2026-09-27 count and everything linked to it. It had 32 of 68 items counted — not a real count — and its only effect was one found-goods row (Bột cacao DK Harvest, +500g) with nothing recorded after it for that item, so erasing moves no other figure. September's cost rises by the value of those 500g. The owner chose "only STK-004": later confirmed counts are still undone with Hoàn tác, as `BR-INV-009` says.

**Second one-time exception to `BR-INV-009`, 2026-09-28: every issue slip from 27/09 erased.** The owner asked to delete all issue slips from 2026-09-27 until the moment of asking: ISL-00075..ISL-00088, their 32 lines and the 25 rows reversing them (`supabase/migrations/0104_erase_issue_slips_since_0927.sql`). The 27/09 slips had already been cancelled by the owner that evening ("Lỗi hệ thống"), so erasing them only removes the trail. The six slips of 28/09 were live and looked like ordinary same-day use (Sữa tươi Mlekovita 1 l, Sữa yến mạch Oatside 2 l, Sữa đặc La rosee 1 l, Bột sữa B One 1 kg, two coffee powders 500 g each); the owner was told that erasing them leaves the book that much above the shelf until the next count, and chose to erase them anyway. Slips after this one-time clean-up are cancelled, not deleted.

**Numbers reused (measured 2026-09-29).** Because the erased ids were freed, the next slips took the same numbers: ISL-00075..ISL-00078 as they exist now were all created on 2026-09-29 (issue dates 27/09–29/09) and are not the slips erased above. A code seen in an older note or screenshot may therefore name a different slip.


### BR-INV-012 — The owner can edit a confirmed stocktake; the change lands on the count's own date

**Status:** `APPROVED` — owner decision 2026-09-28, last point settled 2026-10-14. Built 2026-10-14 on the branch `feat/no-popups`, not yet pushed (migration `0110`, function `edit_confirmed_stocktake_atomic`; pages `/admin/inventory/stocktake/[id]` and `/admin/inventory/stocktake/[id]/edit`). Design: `docs/superpowers/specs/2026-10-14-sua-phieu-kiem-ke-design.md`. `0110` ran on the server 2026-10-14 with the owner's approval (*"a"*).

Owner's answers to the three questions put to him on 2026-09-28 (*"1b 2a 3a"*):

- **Where the change lands (1b).** Editing a counted quantity on a confirmed stocktake rewrites that count's shortfall or found-goods row **on the count's own date**, not today. The owner was told beforehand that this means a month's cost of goods, and so its profit report, changes after he may already have read it. This is a deliberate exception to the "corrections land today" pattern of `BR-INV-009`, and applies to stocktakes and, since 2026-09-29, to quantity changes in an issue slip's "Chỉnh sửa" (`BR-INV-013`).
- **Who may edit (2a).** The owner only — `requireOwner()`, the same guard as undoing a confirmed stocktake, and for the same reason: the person being checked must not be able to change the check.
- **Where a shortfall shows (3a).** A stocktake shortfall appears in the issue-slip list alongside ordinary slips, labelled "Kiểm kê". Opening it opens the stocktake; it carries no cancel button there. It stays a separate source (`STOCKTAKE`) for cost purposes, so `BR-COGS-007`'s split of cost of goods from loss is unchanged.
- **How that row behaves** (owner 2026-09-29, *"1A 2A 3A"*, answered with STK-001 as the example: 49 items short, none found):
  - No separate issue slip (no `ISL-` code) is created for a shortfall. The list row is the stocktake itself (`STK-…`), so nothing is recorded twice. It leaves the list only when the stocktake is undone.
  - A stocktake that found only surplus and nothing short does not appear in the issue-slip list. Found goods are seen on the stocktake page.
  - When a stocktake has both, the row's value is the shortfall only; found goods are not netted against it.

- **Only the most recent confirmed stocktake can be edited** (owner 2026-10-14, *"a"*, question Q4). If a later stocktake exists, editing an earlier one would break the later one's arithmetic. Example put to the owner, with Sữa tươi and made-up numbers:
  - count 1 finds 10 against a book of 15 (short 5);
  - count 2 later finds 8 against a book of 10 (short 2);
  - editing count 1 to 12 would mean count 2 should be short 4, but it would still say 2, and the book would read 10 while the shelf holds 8.
  The owner chose to forbid this rather than have later counts recomputed, the same limit as undoing a stocktake today. To correct an older count, undo stocktakes from the newest back.
- **No reason box and no edit history on screen** (owner 2026-10-14, *"1a 2b 3b"*, confirmed on the real example STK-001, line SKL-00004, Bột cà phê truyền thống Phin Đậm: book 6.000 g, counted 4.000 g, short 2.000 g on 09/08; edited to 5.000 g it becomes short 1.000 g on 09/08 and August's cost of goods falls accordingly). His words: *"do anh đều được nghe lí do sửa rồi mới sửa, nên khi nào người khác thay thế thì mới cần thêm vào"*. He hears the reason before he edits; add both only when someone else takes over editing.

### BR-INV-017 — Confirming a stocktake recomputes the book as of the count, so a slip entered late is not counted twice

**Status:** `APPROVED` — owner 2026-10-14, audit item A2, chose *"Tự tính lại lúc xác nhận"* over "refuse and recount". Not built yet.

**The example he was shown.** At 15:00 Sữa tươi is counted at 8 cartons against a book of 10, so the stocktake reads short 2. Before it is confirmed, a manager enters an issue slip for 2 cartons used at 14:00. The book now reads 8 and matches the count, but the stocktake still says short 2. Confirming it would take the 2 cartons off twice: the book would read 6 while the shelf holds 8, and the cost of goods would be counted twice.

- **When the stocktake is confirmed,** each counted line's book quantity is worked out again as of the moment it was counted, from every movement dated before that moment, including slips and purchase orders entered after the count. The shortfall or found goods come from that figure. In the example: book 8, counted 8, nothing written.
- **No recount is needed.** The confirmed stocktake names the lines whose book figure changed since the count.
- Today the book figure is frozen when the line is counted (`theoretical_at_count`, migration `0092`) and `apply_stocktake_session_atomic` (`0089`) writes from that frozen figure.
