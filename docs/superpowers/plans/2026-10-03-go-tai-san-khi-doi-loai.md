# Gỡ tài sản khi đổi loại hàng khỏi "Thiết bị"

> **For agentic workers:** backend tasks (A, B) go to Sonnet; UI task (C) goes to Gemini via `agy`. Opus reviews, runs the gates, commits. Real-data write (task B `--apply`) only after the owner's yes on the dry-run output.

**Goal:** an item moved out of the equipment category stops depreciating. Owner decided 2026-10-03 ("Làm theo cách em khuyên", answering three numbered options):
1. Retire `TS-067` (Hộp đựng topping liền nắp) from the asset register: mark it, never delete. Dry run first.
2. From now on, saving an item whose category is not equipment while it still has assets asks "Gỡ tài sản này?" and retires them on yes. If any of those assets already has a disposal, the save is refused.
3. The reverse (an item moved into equipment) creates no asset for its past purchases. Only purchases completed afterwards create assets.

**Why:** assets are created once, when a purchase order first becomes completed, from the item's category at that moment (`BR-COGS-008`). Nothing ever looks back when the item's category changes. Measured 2026-10-03 (read-only): 84 assets, 1 whose item is no longer equipment: `TS-067`, item `SPM-134` moved to Vật tư tiêu hao (`NHH-002`, `CONSUMABLE`) on 2026-10-02, still `ACTIVE`, 0 disposals.

## Hiện trạng

1. **Trạng thái.** An asset is `ACTIVE` or `INACTIVE` (`assets.status`). `INACTIVE` already means "entered by mistake": the register (`app/admin/inventory/assets/actions.ts`) and the P&L depreciation line (`lib/reports/profit-and-loss.ts`) both skip it. There is no screen that sets it today. This plan adds one path that sets it (item save) and one script (task B). Nothing sets it back to `ACTIVE`; deliberately not served.
2. **Nút.** No new button. The item edit page's existing "Lưu" gains a yes/no box, the same kind the duplicate-name warning already uses (`confirm` from `lib/shared/dialog`, allowed by `BR-DATA-007`). "Có" retires and saves; "Không" saves nothing and leaves the form as typed.
3. **Danh sách.** Assets considered: those with `purchased_item_id` = the item, `status` ≠ `INACTIVE`. Excluded: `INACTIVE` ones (already retired). If any considered asset has a row in `asset_disposals`, the whole save is refused: part of it was already charged to a month as broken or disposed, and retiring it would erase that charge.
4. **Ô nhập.** The trigger is state, not transition: the chosen category's `system_type` ≠ `EQUIPMENT` and the item has considered assets. So an item already moved (like `SPM-134`) asks again on its next save, and a save that failed half-way can be retried. A form value `asset_removal_confirmed=true` is the yes; any other value is no.
5. **Dữ liệu.** Serves purchased items and their assets. Deliberately not served: purchase-order edits (owner 2026-10-03, option 3: settled in the Phiếu nhập wave), and creating assets for past purchases of an item moved into equipment (decision 3).

**Ripple, listed:** readers of `assets` rows: `app/admin/inventory/assets/actions.ts` (register, detail), `app/admin/reports/pnl/actions.ts` → `lib/reports/profit-and-loss.ts` (depreciation), `app/admin/inventory/items/actions.ts:337` (item delete guard counts asset rows of any status; an item with a retired asset still cannot be erased — unchanged, correct). Writer: `app/admin/inventory/purchase-orders/actions.ts` (insert only). Trigger on `assets`: only `trg_assets_touch` (moves `updated_at`).

**Worked example (real data, 2026-10-03):** Hộp đựng topping liền nắp, `SPM-134`, PO-127 line `POL-1dbc8105-0a44-47bf-ab30-ec2c8c83ccb8`, asset `TS-067`: acquired 2026-06-02, 200 cái, 80.352đ, 12 months, 6.696đ a month by the app's own `buildAssetSchedule`. Charged June–September: 26.784đ; October: 6.696đ. After retiring, the P&L's Khấu hao line drops by 6.696đ in each of June, July, August, September, October 2026 (recomputed live, no stored figure). The box's cost then reaches cost of goods through stock, as for any consumable.

Message in the yes/no box (example): *"Đổi sang loại này sẽ gỡ 1 tài sản khỏi trang Tài sản: TS-067 Hộp đựng topping liền nắp, 200 cái, 80.352đ. Khấu hao đã tính cho các tháng trước cũng bỏ theo. Tiếp tục?"*
Refusal (example): *"Không đổi loại được: tài sản TS-0xx của món này đã có lần thanh lý. Giữ loại Thiết bị."*

Đã xem: `updatePurchasedItem`, the duplicate-warning round trip in `PurchasedItemForm.tsx`, the asset readers above, the `assets` triggers, `scripts/clear-issue-slip-notes.ts` (dry-run pattern). Chưa xem: the item create path (a new item has no assets, so not affected).

---

### Task A (Sonnet): server

- `lib/assets/`: a pure function deciding, from the chosen category's `system_type`, the item's assets and disposals: `none` | `refuse` (with the asset ids that have disposals) | `ask` (assets to retire, count, total cost). Unit tests.
- `updatePurchasedItem` (`app/admin/inventory/items/actions.ts`): after the existing checks, before any write: `refuse` → `fail(...)`; `ask` without `asset_removal_confirmed=true` → return `{ needsAssetRemoval: { message } }` and write nothing; `ask` with it → update the item, then set those assets `status = 'INACTIVE'`. Item first: if the asset write fails, the next save asks again (state-based), so it is recoverable.
- Tests in the actions' test file, red on the old code first.

### Task B (Sonnet): one-off script

`scripts/retire-misfiled-assets.ts` (+ `-core.ts` + test): uses the Task A function over every item. Dry run prints each asset to retire (id, item name, quantity, total cost) and each refused one; `--apply` writes `INACTIVE`, then re-reads and prints the end state. Expected dry run 2026-10-03: 1 to retire (`TS-067`), 0 refused, of 84 assets.

### Task C (Gemini): form

`PurchasedItemForm.tsx`: handle `needsAssetRemoval` exactly as `needsDuplicateWarning` is handled — `confirm` box with the server's message, on yes resubmit with `asset_removal_confirmed=true`. Test.

### Task D (Opus)

Rule text in `BR-COGS-008` (`docs/02-rules/business-rules/cogs.md`), five gates, worktree build, commit. Ask the owner for `--apply` with the dry-run output.
