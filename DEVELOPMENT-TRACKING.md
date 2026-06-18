# Development Tracking

Auto-maintained log of completed work. Newest first.

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
