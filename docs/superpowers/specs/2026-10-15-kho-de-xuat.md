# Kho: area audit and proposal

This page covers master-plan rows 6c and 6d for the Kho area: menu groups "Nhập hàng" (Phiếu nhập, Nhà cung cấp) and "Kho" (Phiếu xuất, Kiểm kê, Hàng hoá, Tài sản, Thời hạn khấu hao, Đơn vị tính, Phân loại hàng). It follows the owner's choice "Làm lại từng mảng" (2026-10-15), the same as `docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md`:
- keep the reconciled money and stock core;
- rebuild where the root is wrong;
- the till never stops.

Four read-only audits ran on 2026-10-15 against the live server: data structure, screens, flows and server correctness, missing features. Every number below was measured that day. Re-measure before use. Owner instruction the same day: *"việc nào anh chưa chốt thì anh sẽ chốt sau. Anh sẽ hỏi lại các việc cần chốt"*. So nothing here has been asked yet.

## Hiện trạng

1. **States.**
   - Purchase orders: DRAFT, COMPLETED, CANCELLED. Live: 203 of 203 are COMPLETED, PO-001 to PO-203.
   - Issue slips have no status; a cancel adds a reversal row per line. Live: 101 slips, 238 issue rows (189 manual, 49 from the stocktake).
   - Stocktake: OPEN, CONFIRMED, CANCELLED, REVERSED. Live: 1 session, STK-001, confirmed 09/08/2026 22:02, 50 lines. That was 67 days ago.
   - Assets: 83 ACTIVE, 1 INACTIVE (TS-067); 2 disposals.
   - Masters are all ACTIVE: 48 suppliers, 151 items, 24 units, 180 conversions, 3 categories, 3 purchase sources. INACTIVE and DELETED are used by 0 rows, because no screen or action can set them. Unit U-001 is ACTIVE but named "DELETED_gram", and six files hide it by that prefix.
2. **Buttons.**
   - "Huỷ phiếu" on an issue slip is a popup with a typed reason, the very example `BR-DATA-007` names.
   - "Thêm nguồn" on Phiếu nhập uses the browser's `window.prompt`, then tells the user to reload, losing the half-typed order.
   - Items and suppliers have no "Ngừng dùng". ADMIN sees "Xoá" on every row; the server refuses it whenever there is history.
   - Phiếu nhập detail shows "Sửa phiếu" and "Huỷ phiếu" on orders the stocktake has locked (`BR-INV-018`).
   - A disposal cannot be undone, and it locks its purchase order for good. `docs/03-workflows/assets.md` says otherwise.
3. **Lists.**
   - Kiểm kê has no list of past sessions; only the last confirmed one is reachable.
   - The count is one alphabetical list of 50+ cards on every device: no search, no "Chưa đếm" or "Lệch" filter, no variance in đồng.
   - Phiếu xuất mixes in stocktake rows.
   - The Phiếu nhập form offers stopped items and suppliers (moot today: none are stopped).
   - There is no Tồn kho page, although the menu decision of 2026-09-28 (overhaul spec 5.6) puts it first in Kho.
4. **Inputs.**
   - Purchase orders accept negative shipping, discount and total. The database has no value checks. 0 of 203 orders are affected.
   - The conversion rate on the Hàng hoá form accepts "0" and "-5". The Bảng quy đổi screen refuses them. 0 of 180 rows are affected.
   - An INACTIVE asset can be disposed, and two people disposing at once can go over the quantity. 0 of 2 disposals are over.
   - Purchase sources have no trim and no duplicate check.
   - Purchase-order codes are minted with `lpad(n,3)`, so PO-1000 becomes PO-100, which already exists, and from then on no purchase order saves. Today: PO-203, about 24 a month. STK and KH codes have the same flaw.
5. **Data served.**
   - Stock on the book for 69 tracked items: 34 above zero, 35 at zero, 0 below. Value 18.118.999đ (the costing engine). Largest is Ly Uchako 700ml, 1.650 cups, 2.053.982đ, never counted.
   - The figure is a book figure. Purchases are ground truth (`verify-cogs` gate 1). Issues are only what staff write down. Example: Sữa chua không đường Vinamilk was bought 4 times in 60 days and has 1 issue ever. 19 of 69 tracked items were never counted.
   - The till reads none of the 16 Kho tables (0 hits in `app/pos`, `lib/pos`, the order functions). Nothing here can stop the till.

**Clean results:**
- `verify-cogs`: 0 mismatches on 203 orders and 359 lines. Giá vốn 57.926.586đ reported, 57.926.586đ recomputed.
- `verify-pnl-monthly`: 0 mismatches over 8 months.
- Order totals against their lines: 0 of 203 off. Base quantities against conversions: 0 of 359 off. No float columns.
- 0 future dates, 0 double reversals, 0 double-click duplicates, 0 orphan assets of 84.

Seen: the four reports (scratchpad `kho-audit/1-data.md` to `4-gaps.md`, SQL beside them), and own checks of `cogs.md:150-170` and `lib/costing/issue-costing-inputs.ts:105-145`.

Not seen:
- any Kho screen in a browser;
- RLS and grants;
- whether `idx_stocktake_sessions_one_open` exists live;
- `lib/stock/purchased-item-onhand.ts` internals;
- the cash-book side of purchases (Thu chi area);
- MarketMan's help centre (failed to load; its facts come from marketing pages).

## Verdict: the root of the area

- **Keep:**
  - the purchase → stock → issue → cost chain, reconciled to 0 mismatches;
  - landed-cost spread over the order (`BR-COGS-006`);
  - per-line save while counting;
  - preview before applying a count;
  - the asset register and its bands;
  - the cancel page of Phiếu nhập, the model for every other cancel.
- **Wrong at the root, so fix before anything else:**
  1. **Giá vốn reads today's classification for past months.** `filterOutEquipmentIssues` and `selectCostedIssues` look up each item's *current* category and "không tính tồn kho" flag. One edit to a category's type (RAW to EQUIPMENT) takes every past issue of its items out of Giá vốn: up to 187 rows, 23.061.959đ, across closed months. `cogs.md:161` says earlier purchases stay counted as goods. Today's effect is 0đ (2 rows, netting to zero).
     - Direction: record on each issue row, at write time, whether it is costed, and let the engine read that value. CLAUDE.md asks for this choice to be stated: the value used at the time is stored; editing a category later recalculates nothing.
     - Until then: refuse a category type change while any of its items has issue rows.
  2. **Editing a confirmed count has no stock check.** `edit_confirmed_stocktake_atomic` only refuses a count below zero. The other three stock writers check that stock stays at or above zero to today (`BR-INV-005`). Lowering a count on STK-001 can push later stock negative and quietly skew Giá vốn. 0 edits so far.
  3. **Kiểm kê is built around one session**, not a list of sessions. That is why there is no history, the undo sits on the landing page, and the count cannot be narrowed. Rebuild it as KiotViet FnB and Toast do (below).

## Owner decisions, asked one at a time

None asked yet. The owner said he will come back to them.

| # | Question | Options | Recommendation | Source |
|---|---|---|---|---|
| Q1 | What does the Tồn kho page show? | (a) quantity only; (b) quantity, value, a total at the top, and each item's last-count date; (c) as (b) plus filters "chưa kiểm bao giờ" and "lâu chưa xuất" | **(b).** The value and the count date are what Hàng hoá lacks; the date tells him which figures are stale. Example today: total 18.118.999đ; "Ly Uchako 700ml — 1.650 ly — 2.053.982đ — chưa kiểm lần nào" | KiotViet "Giá trị kho"; MarketMan inventory value |
| Q2 | Warn "sắp hết" on Tồn kho? | (a) no; (b) an automatic "đủ dùng khoảng X ngày" from the last 30 days of issue slips, nothing to set; (c) a minimum he sets per item | **(b).** No 69 numbers to type, as he chose on 2026-09-28 (overhaul spec 5.7). Example: Bột cà phê truyền thống Phin Đậm, 2.500 g left, 8.000 g issued in 30 days, about 9 days. Its cost: an item staff never issue reads blank | KiotViet "Dự kiến hết hàng"; Toast and Square par |
| Q3 | Suppliers: CLAUDE.md says never delete, mark stopped. Today a never-used supplier can be deleted. | (a) "Ngừng hợp tác / Hợp tác lại", and "Xoá" only for a supplier with no order, as for a never-sold dish; (b) never delete | **(a).** It is the dish rule; a supplier typed by mistake can go | KiotViet "Ngừng hoạt động" |
| Q4 | Does the shop buy on credit? | (a) no, a completed order is paid in full; (b) yes, record the debt per supplier | **(a), later if needed.** 203 of 203 were paid on receipt | KiotViet công nợ |
| Q5 | Paying one purchase several ways (`BR-CASH-001`): split by amount or by percent? | (a) amount; (b) percent | **(a)**, as the till does for sales (`BR-SALE-013`). Asked only when the feature starts; 0 of 203 orders need it today | KiotViet "Tiền trả nhà cung cấp" |
| Q6 | 53 Shopee orders (26.048.237đ, March to September) are recorded as cash from the drawer. | (a) move all 53 to Chuyển khoản on an account he picks (data write); (b) he changes them one by one; (c) leave | **(a)** if he confirms he paid by bank. The drawer balance is what he checks against real cash. Lãi lỗ does not change. Crosses into Thu chi, so ask there | — |
| Q7 | How often to count? | (a) a full count monthly; (b) about 10 high-use items weekly, full count monthly; (c) as now | **(b).** A blank line already means "not counted" (`BR-INV-011`). Without a second count, Q1, Q2 and the Hao hụt line rest on a 67-day-old count | MarketMan, Supy, Toast cycle counts |
| Q8 | Group the count list by Phân loại hàng, or by place in the shop? | (a) Phân loại hàng; (b) a new "Khu vực" list | **(a) now.** (b) is a new table and screen | Toast storage areas |
| Q9 | Once Kiểm kê has its own list, should stocktake rows leave the Phiếu xuất list? | (a) move out; (b) keep both | **(a)**, after checking that the "Hàng đã xuất" report does not read that list | KiotViet, Sapo |
| Q10 | Remove the standalone Bảng quy đổi and edit conversions only on the item page? | (a) remove; (b) keep read-only | **(a).** Today two screens edit the same rows with different delete rules | Sapo, Toast |

Not asked, already decided:
- disposal money (2026-10-08, `BR-COGS-008`);
- no issue reasons (`BR-INV-014`);
- purchase and receiving stay one step (2026-09-29);
- sealed-package counting (2026-08-07);
- semi-products carry no stock (`BR-INV-006`);
- "Không rõ" supplier stays (spec 5.14).

## Technical work, no owner decision (Opus decides, reports)

| Item | Who | Migration | Till risk |
|---|---|---|---|
| Root 1: costed flag stored on each issue row; category type change refused meanwhile | Sonnet | yes | none |
| Root 2: stock check in `edit_confirmed_stocktake_atomic` | Sonnet | yes (function only) | none |
| Huỷ phiếu xuất becomes `/admin/inventory/issue-slips/[id]/cancel`, a copy of Huỷ phiếu nhập; drop its no-popups allow-list entry | Sonnet + Gemini | no | none |
| "Thêm nguồn" through the picker's own "Tạo mới", not `window.prompt`; a small page to rename and stop sources; unique name | Sonnet + Gemini | no | none |
| "Ngừng dùng / Dùng lại" for items (and suppliers after Q3); the Phiếu nhập form offers only active ones | Sonnet + Gemini | no | none |
| Phiếu nhập detail: show the supplier, hide "Sửa phiếu" and "Huỷ phiếu" when locked and say why, "N/A" in Vietnamese, one column on the detail template | Gemini | no | none |
| Validation: no negative money on purchase orders, conversion rate above 0 on the item form, no disposing an INACTIVE asset, disposal quantity checked in the database | Sonnet | yes (checks) | none |
| English server messages into Vietnamese, among them "Stocktake plan changed…", which must tell the user to press Xem trước again | Sonnet | yes (function text) | none |
| Saving an item with its conversions in one Postgres function (A6); the purchase-order edit trail written inside the save, or dropped (it has 0 readers) | Sonnet | yes | none |
| `cancelPurchaseOrder` also refreshes the asset list | Sonnet | no | none |
| Dead code: `InventoryForms.tsx`, the six old actions in `app/admin/inventory/actions.ts:98-320` (still callable, one still rewrites purchase history), dead props, one shared `safeReturnTo` | Sonnet | no | none |
| Dates with seconds, "Ví dụ:" hints, "Món khác" on supplier and item forms, 13 hand-drawn error boxes onto `Alert` | Gemini | no | none |
| Docs: `BR-INV-007`, `BR-INV-008` and the `BR-DATA-007` line on purchase-order cancels say "not built"; `assets.md` on bands and disposal undo; `inventory-catalog.md:120-122` | Opus | no | none |

### Design direction: Kiểm kê rebuilt

New screen structure, so it gets its own design page and plan:
- `/admin/inventory/stocktake` becomes a list of sessions: code, date with seconds, state, who, variance in đồng. Code descending. "Tạo" is disabled while one is open.
- The open session: tabs Tất cả / Chưa đếm / Lệch / Khớp, a search box, lines grouped by Phân loại hàng (Q8), "Giá trị lệch" = quantity off × unit cost, per line and in total. A table on a computer, cards on a phone. The per-line save stays.
- One apply button opens the preview; the yes/no stays as the last step.
- Undo a confirmed session from `/stocktake/[id]/cancel`, not from the landing page.
- Sources: KiotViet FnB kiểm kho (https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/fnb-hang-hoa/kiem-kho/), Toast xtraCHEF counts (https://support.toasttab.com/en/article/xtraCHEF-Inventory-Counts).

### Tồn kho page

New screen, full four steps after Q1 and Q2. No new table is needed:
- quantity from `computeOnHandByPurchasedItem()`;
- value from the costing engine;
- last count from `stocktake_lines`;
- recent use from manual `stock_issues`.

The page must say the figure is "theo sổ" and show each item's last-count date.

## Data writes, each needs the owner's approval to run

1. Unit "DELETED_gram" (U-001, ACTIVE, unused): mark it stopped. Then remove the six `DELETED_` filters.
2. Test row POE-001 ("verify-script") in the purchase-order edit trail: erase it.
3. Two issue slips probably dated 12 hours early by the old time box (fixed 2026-10-05): ISL-00054 (Trứng gà, entered 08/09 17:22, dated 05:21) and ISL-00088 (entered 05/10 15:42, dated 03:42). Move them 12 hours later. This only changes the cost order within the day.
4. Shopee orders to Chuyển khoản, only if Q6 says (a).
5. Disposal money: the cash category "Thu thanh lý tài sản". The two old disposals take 0đ.

## Structure work, one migration batch

The till is not exposed (no reader in the till). Order matters only for `issue_slips.note`:
1. code stops reading it;
2. the migration;
3. code stops sending it.

Otherwise issue slips stop saving.

- Mint PO, STK and KH codes without cutting.
- Restore `bank_accounts` before `purchase_orders` in the backup restore. Today `bank_account_id` is null on 203 of 203, so this is latent; the first transfer-paid order would be lost on restore.
- Purchase-order lines and the edit trail: `RESTRICT` instead of `CASCADE`. The stocktake-lines cascade stays, because cancelling an open count relies on it (`BR-INV-010`).
- Foreign key on `stocktake_lines.item_reference` (0 of 50 orphans), and its type check narrowed to the one live type. A deferred foreign key on `assets.purchase_order_line_id` (0 of 84 orphans today, 10 before 2026-10-05), since an order edit deletes and re-inserts its lines.
- Drop the dead columns:
  - `purchased_items.default_unit_id` (null on 151 of 151);
  - `suppliers.parent_id` (null on 48 of 48);
  - `units.abbreviation` (null on 24 of 24);
  - `issue_slips.note` ('' on 101 of 101);
  - `asset_depreciation_bands.status` (never read);
  - `purchase_order_lines.base_unit` (null on 278 of 359; equal to the conversion's base unit on the other 81).
- `purchase_order_lines.unit` holds an id on 252 of 359 rows and a name on 107: backfill to one kind.
- Drop DELETED from the six master status checks.
- Value checks on money and quantity columns (0 violations today).
- The costed flag on issue rows (root 1) and the disposal money column (`BR-COGS-008`) ride in the same batch.

## Order of work

1. Root 2 (stocktake edit check) and root 1's interim refusal. Small, and both protect closed months.
2. The two popup breaks (Huỷ phiếu xuất, Thêm nguồn) and the Phiếu nhập detail fixes.
3. Validation, Vietnamese messages, dead code, text and alert clean-up, in parallel where files do not overlap.
4. Q3, then "Ngừng dùng" for items and suppliers.
5. Q1 and Q2, then the Tồn kho page (four steps).
6. Q8 to Q10, then the Kiểm kê rebuild (four steps).
7. The structure batch with root 1's stored flag and the disposal money column. Data writes 1 to 3 and 5 go with it, each approved separately.
8. Q4 to Q6 when Thu chi is reached; Q7 at any time, since it is a habit, not code.
