# Codex Handoff — 2026-06-25

Yêu cầu gốc: review code changes của Claude (Phần A) + fix system-wide audit findings (Phần B).

Trạng thái từng item sẽ được update tại chỗ bằng marker:
- `[ ]` pending — Codex làm
- `[x]` done — Claude làm xong, Codex verify
- `[~]` partial — Claude làm một phần, Codex complete
- `[!]` skip — có lý do, đọc note

---

## Phần A — Review code changes của Claude (phiên 2026-06-25)

### Codex architecture update — MAC COGS direction

- User approved switching the primary COGS valuation direction from FIFO to MAC/weighted average cost.
- Inventory quantity control remains ledger-based through `Stock_Ledger.quantity_change`.
- FIFO should be treated as optional audit/debug only, not the primary P&L contract.
- Design note: `docs/superpowers/specs/2026-06-25-mac-cogs-inventory-design.md`.
- Roadmap phase added: Phase 5A — Chuyển chuẩn giá vốn từ FIFO sang MAC.
- Implementation is still pending; do not continue assuming `audit-cogs-drift.ts` FIFO recompute is the long-term source of truth.

### File cần đọc

**Overview docs (3 file):**
1. `DEVELOPMENT-TRACKING.md` — 2 entries đầu sau header
2. `docs/audits/2026-06-25-full-system-audit-roadmap.md` — Phase 2/3/4/5/6.1 đã check off
3. `docs/audits/script-cleanup-plan.md` — Phase 6.1 output

**Code modified (7 file):**
- `lib/report-v2-allocators.ts` — export `filterLedgerForFifoInit`, apply 2 chỗ
- `lib/report-v2-allocators.test.ts` — +2 regression tests WS-12
- `app/admin/reports/actions.ts` — apply filter + Phase 5.2 fields + Phase 5.3 timezone
- `app/admin/reports/sales/page.tsx` — +2 UI cards
- `app/admin/inventory/actions.ts` — `getRealtimeStock` non-inv filter + `submitStockAdjustment` reason required
- `lib/purchase-ledger-rebuild.ts` — 4 error msg tiếng Việt
- `lib/purchase-ledger-rebuild.test.ts` — update 2 regex match

**Code mới (2 file):**
- `lib/report-time.ts` — `toSaigonUtcRange` helper
- `lib/report-time.test.ts` — 6 tests

**Audit scripts mới (10 file trong `scripts/`):**
- `audit-void-orders.ts` (3.3)
- `audit-order-total-consistency.ts` (3.4)
- `audit-stock-ledger-schema.ts` (4.1)
- `audit-stock-adjustments.ts` (4.3)
- `audit-po-save-ledger.ts` (2.3)
- `audit-negative-periods-classification.ts` (4.4)
- `generate-script-cleanup-plan.ts` (6.1)
- `verify-cogs-allocation-impact.ts` (verify)
- `spotcheck-mod004.ts` (verify)
- `audit-dao-mieng-report-cogs.ts` (Codex's, kept)

### 8 Review points (Claude đã note trong `DEVELOPMENT-TRACKING.md`)

- [ ] **R1** `filterLedgerForFifoInit` — có cần loại thêm `STOCK_ADJUST`/`EDIT_CONSUME`? So sánh `lib/cogs-drift-audit.ts:136-143`.
- [ ] **R2** `toSaigonUtcRange` — behavior với ISO input không timezone suffix.
- [ ] **R3** `getRealtimeStock` cache staleness 60s cho `is_non_inventory` toggle.
- [ ] **R4** `sales/page.tsx:37-51` redundant date conversion — có nên đơn giản hoá?
- [ ] **R5** Pre-existing TS error `lib/modifier-recipe.test.ts:21`.
- [ ] **R6** 7 audit scripts mới — review naming, output, read-only contract.
- [ ] **R7** `submitStockAdjustment` reason validation — UI form phải pass reason.
- [ ] **R8** Vietnamese error messages render đúng qua UI toast.

### Verify commands

```bash
rtk node_modules/.bin/vitest run                                       # 166/166
rtk node_modules/.bin/vite-node.cmd scripts/audit-cogs-drift.ts        # 0 mismatch
rtk node_modules/.bin/vite-node.cmd scripts/audit-current-stock.ts     # 0 negative
rtk node_modules/.bin/vite-node.cmd scripts/audit-order-ledger.ts      # 0 mismatch
rtk node_modules/.bin/vite-node.cmd scripts/audit-purchase-ledger.ts   # 0 mismatch
rtk node_modules/.bin/vite-node.cmd scripts/audit-void-orders.ts       # clean
rtk node_modules/.bin/vite-node.cmd scripts/audit-stock-ledger-schema.ts
rtk node_modules/.bin/vite-node.cmd scripts/audit-order-total-consistency.ts
rtk node_modules/.bin/vite-node.cmd scripts/audit-po-save-ledger.ts
rtk node_modules/.bin/tsc --noEmit                                     # 1 pre-existing error
```

### Bug Đào miếng — Root cause

3 hàm truyền full ledger vào `FIFOTracker.init()`. Init consume `SALES_CONSUME` → batches depleted → late-processed lines thấy 0 stock → modifier COGS = 0. Fix: filter `SALES_CONSUME` + `EDIT_REVERSAL` trước init (mirror `auditCogsDrift`). Evidence: `scripts/verify-cogs-allocation-impact.ts` shows MOD-006 0→4209, MOD-004 121891→76776, total unchanged.

---

## Phần B — System-wide audit findings

### B.1 — UI/UX Issues

#### Date/Time display
- [x] **UI-1** HIGH Tạo `lib/datetime.ts` helper `formatDateTime(iso, opts?)` dùng `Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })`. Thay 2 helper trùng `OrderTable.tsx:134` + `OrderDetailModal.tsx:28`. **Done by Claude** — `lib/datetime.ts` + 9 tests, apply ở `OrderTable.tsx`, `OrderDetailModal.tsx`, `StockTable.tsx`.
- [x] **UI-2** HIGH `StockTable.tsx:80` và các trang `.toLocaleString("vi-VN")` thiếu `timeZone` option. **Done by Claude** — dùng `formatDateTime` helper mới.
- [ ] **UI-3** HIGH `SalesFilter.tsx:84` push URL `.toISOString()` raw → không friendly. Đổi sang `YYYY-MM-DD`. *(Defer — cần backward-compat với URL cũ)*

#### Sizing & touch target
- [x] **UI-4** HIGH Touch target < 44px: `OrderDetailModal.tsx:64` close button, `SalesFilter.tsx:111-113` preset buttons. **Done by Claude** — tăng `min-h-[36px]` + `aria-label="Đóng"`. Codex verify `OrderTable.tsx:280` "Hủy đơn" button.
- [x] **UI-5** HIGH `sales/page.tsx:256` heatmap cell `text-[8px]`. **Done by Claude** — `text-[10px]`.
- [x] **UI-6** MED `pnl/page.tsx:128,184,243` `max-h-[484px]`. **Done by Claude** — `max-h-[60vh]` (3 chỗ + StockTable 1 chỗ).

#### Layout & consistency
- [x] **UI-7** HIGH `ModifiersClient.tsx:131` text English `"active recipes"`. **Done by Claude** — `"phiên bản hoạt động"`.
- [ ] **UI-8** MED `PurchaseOrderForm.tsx:213` placeholder. *(Defer — cần đọc CustomDatePicker)*
- [ ] **UI-9** HIGH `PurchaseOrderForm.tsx:165` gửi `transaction_date.toISOString()`. *(Defer — cần đọc CustomDatePicker + server parse)*
- [x] **UI-10** MED Format tiền `XXđ` → `XX đ`. **Done by Claude** — sweep trong `OrderDetailModal.tsx` (6 chỗ).
- [x] **UI-11** MED `OrderTable.tsx:137` show giây. **Done by Claude** — dùng `formatDateTime(dateString)` mặc định không giây.
- [ ] **UI-12** MED Heatmap mobile. *(Defer — cần design)*
- [ ] **UI-13** MED Mobile table card fallback. *(Defer — large)*
- [ ] **UI-14** MED PO form grid fallback. *(Defer — cần đọc PO form)*
- [ ] **UI-15** MED PO inputs `w-32` overflow. *(Defer — cần đọc PO form)*
- [x] **UI-16** MED `StockTable.tsx:103` icon `🔍`. **Done by Claude** — `aria-hidden="true"`.
- [ ] **UI-17** MED `ItemsClient.tsx:106` item.id raw UUID. *(Defer — UX decision)*

#### Low severity
- [x] **UI-18** LOW `OrderTable.tsx:359` className conflict. **Done by Claude** — removed `bg-white` duplicate.
- [x] **UI-19** LOW backdrop opacity khác nhau. **Done by Claude** — unified `bg-black/50 backdrop-blur-sm` ở OrderDetailModal.
- [ ] **UI-20** LOW `created_by` hardcoded. *(Defer — cần session integration)*
- [x] **UI-21** LOW PnL emoji icons. **Done by Claude** — `aria-hidden="true"` 3 chỗ.

### B.2 — Code Architecture

#### Type Safety
- [ ] **CODE-1** HIGH `app/admin/orders/actions.ts:111-162, 208-228` `any[]` + `Number(x) || 0` lặp. Tạo `coerceOrder`/`coerceLine` shared ở `lib/order-types.ts`.
- [ ] **CODE-2** MED `app/admin/orders/actions.ts:349` `require()` runtime. Đổi import tĩnh.
- [ ] **CODE-3** MED `lib/report-v2-allocators.ts:43-48, 145, 262` `any[]`. Typed `LedgerEntry[]` + `SemiProductContext`.
- [ ] **CODE-4** LOW `app/admin/inventory/actions.ts:411` `submitStockAdjustment(data: any)`. Typed input.

#### Error Handling
- [x] **CODE-5** HIGH `lib/report-v2-allocators.ts:190, 214` `try { JSON.parse } catch {}` silent skip SP. **Done by Claude** — added `parseSpIngredients` helper throws on malformed JSON; replaced both `try/catch {}` blocks; throws with SP id in message.
- [ ] **CODE-6** MED `app/admin/inventory/purchase-orders/actions.ts:51` `JSON.parse(linesJson)` không try/catch.
- [ ] **CODE-7** LOW `app/admin/orders/actions.ts:117-121` silent catch. Log warning nếu non-empty.

#### Data Integrity
- [ ] **CODE-8** CRITICAL `app/admin/orders/actions.ts:337-351` `voidOrderV2` 3 writes không transaction. Fail bước 3 → order VOIDED nhưng không reversal.
- [ ] **CODE-9** CRITICAL `app/admin/inventory/purchase-orders/actions.ts:81-93` update PO loop remove; fail giữa → mất dữ liệu.
- [ ] **CODE-10** HIGH `app/admin/orders/actions.ts:472` `editOrderV2` race condition.
- [ ] **CODE-11** HIGH `app/pos/actions.ts:138-155` `assignOrderNo` race → trùng order_no.
- [ ] **CODE-12** MED `findAll` (cache 5min) cho reference data trong write-path.

#### Performance
- [ ] **CODE-13** HIGH `app/admin/orders/actions.ts:113-115, 209-210` `.find()` O(n) per line → O(n²). Dùng Lodash `keyBy`.
- [ ] **CODE-14** HIGH `app/admin/inventory/actions.ts:182-227` `updatePurchasedItem` N+1 queries.
- [ ] **CODE-15** HIGH `app/admin/inventory/purchase-orders/actions.ts:116-164` loop insert. Accumulate + `insertMany`.
- [ ] **CODE-16** MED `app/admin/reports/actions.ts:321-322` tạo Set mỗi iteration.
- [ ] **CODE-17** MED `lib/cogs-drift-audit.ts:146-163` re-consume prior lines O(n²).

#### Code Duplication
- [ ] **CODE-18** HIGH `buildLineConsumptionRows` + `costConsumptionRowsFIFO` trùng 3 chỗ (`pos/actions`, `admin/orders/actions`, `cogs-drift-audit`). Đưa vào `lib/inventory-consumption.ts`.
- [ ] **CODE-19** MED `coerceOrder`/`coerceLine` trùng. Export từ `lib/order-types.ts`.
- [ ] **CODE-20** MED Block filter "COMPLETED + superseded_by empty" lặp 4 lần. Helper `filterEligibleOrders`.
- [ ] **CODE-21** MED SEMI_PRODUCT resolution trùng. Helper `resolveSemiProduct`.

#### Security
- [ ] **CODE-22** CRITICAL Không server action nào check `session.user.role === "ADMIN"` cho `voidOrderV2`, `editOrderV2`, `savePurchaseOrder`, `approveStockAdjustment`. Guard `requireAdmin(session)`.
- [ ] **CODE-23** LOW `lib/sheets_db.ts:132-149` `generateNewId` predictable. OK cho ledger.
- [ ] **CODE-24** MED `lib/sheets_db.ts:69-87` sheet name dynamic. Whitelist `ALLOWED_SHEETS`.

---

## Priority

| Priority | Items |
|---|---|
| **P0 — Critical** | CODE-22 (auth), CODE-8 (void txn), CODE-9 (PO txn), CODE-11 (order_no race) |
| **P1 — High** | UI-1/2/3 (datetime), UI-4/5 (sizing), UI-7 (English), UI-9 (PO date), UI-10 (tiền), CODE-5 (silent SP), CODE-13/14/15 (perf), CODE-18 (dedup) |
| **P2 — Medium** | UI-6/8/11-17 (cosmetic), CODE-1/10/12/16/17/19-21 |
| **P3 — Low / defer** | UI-18-21, CODE-2/3/4/7/23/24, Phase 6.3-6.5/7/8 |

---

## Output mong đợi từ Codex

1. **Phần A**: Confirm/reject R1-R8. Flag thêm edge cases.
2. **Phần B**: Làm item `[ ]` còn lại theo priority. Mỗi fix commit riêng với `Codex:` prefix.
3. Update file này: chuyển `[ ]` → `[x]` khi xong, note commit sha.
4. Update `DEVELOPMENT-TRACKING.md` entry mới.
5. Không push.

## Quy tắc (CLAUDE.md)

- Code/comments: English only
- User-facing strings: tiếng Việt
- CamelCase, no emojis
- Surgical changes, simplicity first
- Transactions cho critical flows
- Lodash khi có thể
- Tuân thủ `docs/domain-dictionary.md`
