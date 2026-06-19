# Development Tracking

Auto-maintained log of completed work. Newest first.

---

## 2026-06-19 — WS-4 Reports V2 Complete

**Spec:** `docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md`
**Plan:** `docs/superpowers/plans/2026-06-19-orders-reports-rebuild-ws4-reports.md`

### What landed

- **Pure report allocators:** `lib/report-v2-allocators.ts`
  - `breakdownRevenueByProduct(orders, lines)` — wraps WS-1 `allocateLineRevenue`; sum of all `revenue` fields equals sum of order `net_total`
  - `breakdownCOGSByIngredient(lines)` — wraps WS-3 `parseLineRecipeSnapshot`; sum of all `cogs` fields equals sum of line `cost_at_sale`
- **Server actions:** `app/actions/reports-v2.ts`
  - `getPnLDataV2(filters)` — reads V2 (latest COMPLETED versions only), sums stored `net_total` + `cost_at_sale`. Per-product breakdown via Task 1 allocator.
  - `getSalesDataV2(filters)` — time series (date/DOW/hour/month), best sellers by product+size, best toppings, category pie.
- **UI migration:**
  - `app/admin/reports/pnl/page.tsx` — calls `getPnLDataV2`, amber banner when 0 orders in range
  - `app/admin/reports/sales/page.tsx` — calls `getSalesDataV2`, amber banner when 0 orders in range
  - `app/admin/reports/stock/page.tsx` — UNCHANGED (self-balancing ledger already handles V2 EDIT_REVERSAL)
- **Scripts:**
  - `scripts/reconcile-v1-v2.ts` — compares V1 vs V2 totals; flags drift > 1đ/order
  - `scripts/test-pnl-v2.ts` — smoke test: create order via V2 → verify PnL shows it

### Pre-migration state (verified by reconciliation script)

- V1 has 396 orders, ~12.18M VND total revenue (legacy data)
- V2 has 4 orders (smoke test artifacts), 125k VND
- Reports PnL/Sales will show empty for any historical date range until WS-5 migrates V1 → V2
- Stock report unaffected — `getRealtimeStock` self-balances ledger entries

### Verification gates (all passed)

- `rtk npm test` — **100/100 pass** (10 test files; WS-4 adds 10 unit tests for allocators + 8 for reports-v2 action)
- `rtk tsc --noEmit` — 0 errors in WS-4 files
- `rtk npm run test:coverage` — 96.34% stmts / 100% funcs across 9 tracked files:
  - `report-v2-allocators.ts`: 97.1% (new)
  - `order-edit-cart.ts`: 100%
  - `order-cart.ts`: 96.27%
  - `sheets-db-v2.ts`: 97.53%
  - `sheets-db-v2-edit.ts`: 96.55%
  - `order-types.ts`: 95.11%
  - `order-cogs.ts`: 100%
  - `order-math.ts`: 92.44% (defensive 2-pass code)
  - `order-snapshot.ts`: 99.18%
- Reconciliation script runs cleanly, correctly flags drift > 1đ tolerance
- PnL smoke test PASSED: order created via V2 → PnL shows it with correct revenue 25k and margin 50.32%

### Known gaps deferred to WS-5

- V1 → V2 migration script not yet written — reports show empty for historical ranges
- Legacy `app/actions/pos.ts`, `order-edit.ts`, `orders.ts`, `reports.ts` + `lib/report-utils.ts` still in code — archived in WS-5
- V2 sheets contain smoke test orders (TEST*, PHD*, UCK*) — should be cleaned up before WS-5 cutover via `scripts/cleanup-test-orders-v2.ts`
- Reconciliation script depends on V1 still existing; after WS-5 archives V1, script won't have V1 side

### Commits (in order)

| Hash | Subject |
|---|---|
| 42541ad | feat(orders-v2): report allocators using stored V2 values |
| 5425abe | feat(orders-v2): getPnLDataV2 reads V2 with stored values |
| 18092a2 | feat(orders-v2): migrate Sales report UI to getSalesDataV2 |
| 7e40932 | feat(orders-v2): migrate PnL report UI to getPnLDataV2 |
| debaf41 | feat(orders-v2): V1 vs V2 reconciliation script |
| 6513d73 | test(orders-v2): PnL V2 smoke test script |
| 6b91242 | chore(orders-v2): add report allocators to coverage |

### Closeout follow-up (Claude review pass)

- Updated DEVELOPMENT-TRACKING.md with WS-4 section (Antigravity missed Task 7 Step 7)
- Verified reconciliation script correctly shows pre-migration drift (396 V1 vs 4 V2 orders)
- Verified PnL smoke test passes end-to-end

### Next: WS-5 (Migration + Cutover)

Claude to draft. Will define V1 → V2 migration script following spec §7.2 reconstruction rules, dry-run mode, cutover runbook, and legacy code archival.

---

## 2026-06-19 — WS-3 Admin Edit Path Complete

**Spec:** `docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md`
**Plan:** `docs/superpowers/plans/2026-06-19-orders-reports-rebuild-ws3-edit-path.md`

### What landed

- **Snapshot definitions:** `LineRecipeSnapshot`, `ModifierRecipeEntry`, `parseLineRecipeSnapshot` in `lib/order-types.ts` to support both variant and modifier ingredients.
- **Edit business logic:** `lib/order-edit-cart.ts` → `buildEditedOrderFromCart` which reconstructs an `OrderV2` with `version + 1` and `parent_order_id` chaining.
- **Sheets DB Edit Path:** `lib/sheets-db-v2-edit.ts` → `supersedeOrderV2` handles batched transaction: old order → SUPERSEDED, new order → COMPLETED, insert events, insert reversal stock ledger, insert new stock ledger.
- **Server Actions:**
  - `app/actions/order-edit-v2.ts` → `editOrderV2` (resolves reference data, computes COGS at original sale time, calls supersede).
  - `app/actions/orders-v2.ts` → `getOrdersV2`, `getOrderDetailV2` (builds timeline/events), `voidOrderV2`.
- **Admin UI Migration:**
  - `app/admin/orders/page.tsx` & `OrderTable.tsx`: Migrated to V2 read path, removed destructive delete.
  - `OrderDetailModal.tsx`: Displays version timeline, full money breakdown, and events log.
  - `OrderEditModal.tsx`: Replaced payload construction with V2 cart shape, required edit reason, passing expectedVersion for optimistic locking.
- **Smoke test scripts:**
  - `scripts/test-edit-order-v2.ts`
  - `scripts/test-void-order-v2.ts`

### Verification gates (all passed)

- `rtk npm test` — 82/82 tests pass (added tests for `order-edit-cart`, `sheets-db-v2-edit`)
- `rtk tsc --noEmit` — 0 errors in WS-3 files
- `rtk npm run test:coverage` — >90% coverage on new edit files.
- Live smoke test: Edit script correctly verified `SUPERSEDED` old version and `COMPLETED` new version, with proper 1-to-1 stock ledger reversals. Void script correctly set `VOIDED` with proper reversals.
- Browser smoke test: Version timeline correctly shows `v1 (đã thay thế)` and `v2`. Voiding works and logs events.

### Known gaps (deferred to WS-4 / WS-5)

- Reports still read V1 — WS-4 will switch PnL/Sales/Stock to read V2.
- Legacy `app/actions/pos.ts`, `order-edit.ts`, `orders.ts` still in code — WS-5 archives them.
- `Stock_Ledger` mixes V1 (`ORD-*` ids) and V2 (`ord-*` ids) reference_ids — WS-4 will distinguish.

### Commits (in order)

| Hash | Subject |
|---|---|
| 8382aad | feat(orders-v2): capture modifier recipes in line snapshot |
| ac99b2d | feat(orders-v2): buildEditedOrderFromCart for supersede-and-replace |
| 04171d4 | feat(orders-v2): supersedeOrderV2 batched write for edit |
| 7591982 | feat(orders-v2): editOrderV2 server action |
| aed9ee5 | feat(orders-v2): getOrdersV2 + getOrderDetailV2 + voidOrderV2 |
| 401c0cc | feat(orders-v2): migrate Orders admin to V2 read path + void |
| 396b400 | feat(orders-v2): admin detail + edit modals migrated to V2 |
| 9844d38 | test(orders-v2): smoke tests for edit and void flows |
| 3f3e139 | docs(tracking): WS-3 edit path complete |

### Closeout follow-up (Claude review pass)

- Fixed `vitest.config.ts` to include `order-edit-cart.ts` + `sheets-db-v2-edit.ts` in coverage tracking.
- Corrected commit hashes above (earlier version listed fabricated hashes).
- Final coverage: 95.55% stmts / 96% funcs across 8 tracked files. `order-edit-cart.ts` at 100%/.

### Next: WS-4 (Reports)

Claude to draft plan. Will define `getPnLDataV2`, `getSalesDataV2`, `getRealtimeStockV2` that read V2 sheets only. Replaces `lib/report-utils.ts` with V2-based allocation. Adds reconciliation check (V1 vs V2 totals) for migrated data.

## 2026-06-19 — WS-2 POS Write Path Complete

**Spec:** `docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md`
**Plan:** `docs/superpowers/plans/2026-06-18-orders-reports-rebuild-ws2-pos-write-path.md`

### What landed

- **Pure helpers:**
  - `lib/order-snapshot.ts` — 6 snapshot builders (product/variant/modifier×2/promo/recipe)
  - `lib/order-cogs.ts` — `computeLineCostAtSale` MAC pinned at sale time
  - `lib/order-cart.ts` — `buildOrderFromCart`: cart → OrderV2 + OrderLineV2[] with all 5 money fields, snapshots, and `assertOrderInvariants` called internally
  - `lib/sheets-db-v2.ts` — `insertOrderV2Records` batched write with cleanup-on-failure
- **Server action:** `app/actions/pos-v2.ts` → `submitOrderV2`. Orchestrates: validate → load ref data → build order (asserts invariants) → compute COGS → assign order_no → insert V2 rows + Order_Events + Stock_Ledger in one batched op
- **POS UI:** `components/POSScreen.tsx` migrated to call `submitOrderV2` with V2 payload shape. Old client-side discount math (92 lines) replaced with payload construction (35 lines)
- **Smoke test scripts:**
  - `scripts/test-submit-order-v2.ts` — CLI script for full pipeline verification
- **Core file modification:** `lib/sheets_db.ts` — added `getHeadersNoCache` + `CLI_MODE` bypass for scripts running outside Next.js context

### Bug fix in WS-1 code (commit fd65b96)

Property test surfaced bug in `allocateOrderDiscount` (WS-1 code): single-pass algorithm could lose residual if last line had insufficient capacity. Fixed with 2-pass approach: proportional allocation in pass 1, redistribute any residual in pass 2. All WS-1 fixtures still pass.

### Verification gates (all passed)

- `rtk npm test` — 67/67 tests pass (35 from WS-1 + 32 new in WS-2 + 2 documentation tests for 2-pass behavior)
- `rtk tsc --noEmit` — clean for all WS-2 files
- `rtk npm run test:coverage` — 96.04% stmts / 100% funcs across 6 tracked files:
  - `order-cart.ts`: 93.27%
  - `order-cogs.ts`: 100%
  - `order-math.ts`: 92.44% (defensive 2-pass code partially uncovered — genuinely hard to trigger deterministically)
  - `order-snapshot.ts`: 99.18%
  - `order-types.ts`: 100%
  - `sheets-db-v2.ts`: 97.53%
- Live smoke test: Sữa Dâu @ 35k → auto-applies PRM-003 promo → net 25k stored in Orders_V2 with full snapshot + Order_Events CREATED + Stock_Ledger SALES_CONSUME
- CLI smoke test: produces real order rows in V2 sheets (TEST157569 etc.)

### Known gaps (deferred to WS-3 / WS-4)

- **Modifier recipe consumption** in Stock_Ledger — variant recipes only; topping consumption deferred to WS-3 (edit flow also needs it)
- **Cost_at_sale per ingredient** in Stock_Ledger — currently allocates line cost by ingredient quantity ratio (approximate). Per-ingredient MAC would be more accurate; refine later
- **Stock_Ledger reference_id mixing** — V1 orders (format `ORD-timestamp-rand`) and V2 orders (format `ord-uuid`) both write to same Stock_Ledger sheet. WS-4 reports need to distinguish via prefix or added column
- **allocateOrderDiscount 2-pass coverage** — defensive code path partially uncovered (lines 60-70); deterministic trigger not found

### Commits (in order)

| Hash | Subject |
|---|---|
| 5e5ce91 | feat(orders-v2): snapshot helpers from raw DB rows |
| 2e454c1 | feat(orders-v2): MAC COGS computation pinned at sale time |
| ebc60fa | feat(orders-v2): cart math with snapshot+invariants |
| b370a7d | feat(orders-v2): V2 sheet write helpers |
| dea324c | feat(orders-v2): submitOrderV2 server action |
| 8989c4d | feat(orders-v2): migrate POS checkout to submitOrderV2 |
| f33b09c | test(orders-v2): smoke test script for submitOrderV2 pipeline |
| fd65b96 | fix(order-math): properly distribute allocation remainder |

### Next: WS-3 (Admin Edit Path)

Claude to draft plan. Will define `editOrderV2` with supersede-and-replace pattern (old order → SUPERSEDED, new order → COMPLETED with version+1), Stock_Ledger `EDIT_REVERSAL` rows, Order_Events EDITED records with delta_json, and `previous_order_id` chaining. Also closes the modifier recipe gap from WS-2.

---

## 2026-06-18 — WS-1 Foundation Complete

**Spec:** `docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md`
**Plan:** `docs/superpowers/plans/2026-06-18-orders-reports-rebuild-ws1-foundation.md`

### What landed

- **Test infrastructure:** vitest 1.6 + fast-check 3.23 installed; vitest.config.ts wired with `@/` alias and coverage on `lib/order-math.ts` + `lib/order-types.ts`
- **Types:** `lib/order-types.ts` — strict interfaces for `OrderV2`, `OrderLineV2`, `OrderEvent`, enums (`ORDER_STATUS`, `EVENT_TYPE`, `PAYMENT_METHOD`, `STOCK_TXN_TYPE`), snapshot sub-types, `InvariantError`. Field names match spec §5 1:1.
- **Pure math:** `lib/order-math.ts`
  - `allocateOrderDiscount(lines, orderDiscount)` — proportional split, capacity caps, residual absorbed by last line
  - `allocateLineRevenue(line)` — single-ratio allocation across variant + modifiers (eliminates the additive+multiplicative bug from old `computeLineRevenue`)
  - `assertOrderInvariants(order, lines)` — 7 invariants, ±1đ tolerance, throws `InvariantError` on first violation
- **Fixtures grounded in REAL data** (`lib/__tests__/fixtures.ts`):
  - UCK000094 — full 9-line order with PRM-003 promo; RAW (legacy 156k buggy total) + MIGRATED (corrected 161k)
  - PHD000540 — real combo case (PRM-003 + 21k order discount, customer paid 0); RAW (double-counted -3k) + MIGRATED (order_discount adjusted 21k → 18k)
  - Standalone Sữa Dâu — verifies audit headline: 1 cup = 25.000đ
- **35 tests pass** (32 unit + 3 property-based, ~1500 fast-check runs)
- **Coverage:** 99.48% statements / 94.87% branches / 100% functions / 99.48% lines on `order-math.ts` + `order-types.ts`
- **Sheets created live:** `Orders_V2` (26 cols), `Order_Lines_V2` (19 cols), `Order_Events` (11 cols). Verified by `scripts/verify-v2-schema.ts`.
- **Operator scripts:**
  - `scripts/verify-v2-schema.ts` — read-only header check
  - `scripts/create-v2-sheets.ts` — idempotent sheet creation (dry-run default, --live to write)
  - `scripts/inspect-uck000094.ts` — debug: print real order data
  - `scripts/find-promo-plus-order-discount.ts` — debug: find combo orders

### Key facts learned (for downstream workstreams)

- **UCK000094 reality:** No order-level discount existed. The 5k discrepancy in legacy data was a double-counting bug. Migration corrects `net_total` 156k → 161k.
- **PHD000540 reality:** Combo case. Original `order.discount_amount=21000` double-counted 3k with promo; migration adjusts to 18000. Customer really paid 0.
- **Sữa Dâu = 25.000đ** is the audit headline, verified per-cup. Holds for orders without order-level discount. With proportional order_discount_allocation, per-line revenue drops slightly (e.g., UCK000094's Sữa Dâu would report less if it had order discount — but per User correction, it does not).
- **PRM-003 is FLAT_PRICE** (not FLAT_VND). `discount_value` is target price (15k for most variants, 25k for VAR-031 Sữa Dâu).

### Verification gates (all passed)

- `rtk tsc --noEmit` — 0 errors in WS-1 files
- `rtk npm test` — 35/35 pass
- `rtk npm run test:coverage` — exceeds 95% target
- `npx tsx scripts/verify-v2-schema.ts` — all 3 V2 sheets match spec §5

### Commits (in order)

| Hash | Subject |
|---|---|
| eec749d | chore(test): install vitest + fast-check for V2 foundation |
| 4aa07c0 | feat(orders-v2): add strict TypeScript types for Orders_V2, Order_Lines_V2, Order_Events |
| d5a87be | test(orders-v2): add golden case fixtures including UCK000094 *(later superseded by 2c2f51c)* |
| b1b11e6 | feat(orders-v2): TDD allocateOrderDiscount |
| 96d2d3f | feat(orders-v2): TDD allocateLineRevenue with single-ratio allocation |
| 2c2f51c | redo(orders-v2): ground WS-1 fixtures in real data; complete Task 6 guardian |
| c95ec78 | test(orders-v2): property-based tests for invariants and allocators |
| 8916329 | feat(orders-v2): schema verification script for V2 sheets |
| 7826fb5 | feat(orders-v2): idempotent sheet creation script + verify range fix |
| 3c6cb40 | chore(orders-v2): execute sheet creation script live |

### Next: WS-2 (POS write path)

Claude to draft plan. Will define `submitOrderV2` server action, snapshot helpers, order_discount_allocation at order time, and POS UI changes (clear visual separation of 3 discount types: system promo / manual per-item / manual per-order).
