# Phase 3 Briefing — Promo Classification Results

## Summary
- Total COMPLETED orders processed: 651
- Date range processed: 2026-04-20T01:25:46.485544+00:00 → 2026-06-16T02:20:40.846Z
- Generated at: 2026-06-16T08:26:56.398Z

## Tier counts (table)
| Tier | Count | Action implication |
|---|---|---|
| CONFIRMED | 283 | line_discount already correct — no fix needed |
| INFERRED_HIGH | 12 | line_discount correct, applied_promotion_id missing — backfill candidate |
| INFERRED_MEDIUM | 0 | n/a |
| INFERRED_LOW | 0 | n/a — backfill in 6b6c038 already recovered these |
| AMBIGUOUS | 1 | needs manual review |
| NO_PROMO | 355 | no PRODUCT_DISCOUNT applicable |

## Section 1: 12 INFERRED_HIGH orders (backfill candidates)

| order_no | created_at | matchedPromoId | matchedPromoName | order.discount_amount | applicable_variants_in_cart |
|---|---|---|---|---|---|
| PHD000467 | 2026-06-11T00:53:20.336Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-001 |
| PHD000468 | 2026-06-11T00:53:34.082Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-001 |
| PHD000476 | 2026-06-11T23:45:18.212Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-001 |
| PHD000479 | 2026-06-12T00:13:00.374Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-001 |
| UCK000094 | 2026-06-12T12:21:26.776Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-024, VAR-032, VAR-026, VAR-028, VAR-026, VAR-022, VAR-016, VAR-031 |
| UCK000100 | 2026-06-12T13:42:57.791Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-030 |
| UCK000108 | 2026-06-13T11:43:20.433Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-018 |
| UCK000109 | 2026-06-13T11:43:29.445Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-018 |
| UCK000114 | 2026-06-13T13:50:35.051Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-016 |
| UCK000124 | 2026-06-14T12:57:22.946Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-018 |
| PHD000490 | 2026-06-15T04:05:16.970Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-001 |
| PHD000497 | 2026-06-16T00:30:27.346Z | PRM-003 | KHAI TRƯƠNG ĐỒNG GIÁ | 0 | VAR-001 |

Two sample orders:

**PHD000467** (2026-06-11T00:53:20.336Z)
- Cà phê đá (500ml): qty 1, unit_price 18000, line_discount 3000 (Applicable: true)

Applicable lines expected vs actual:
- VAR-001: expected 3000, actual 3000, diff 0

**PHD000468** (2026-06-11T00:53:34.082Z)
- Cà phê đá (500ml): qty 1, unit_price 18000, line_discount 3000 (Applicable: true)

Applicable lines expected vs actual:
- VAR-001: expected 3000, actual 3000, diff 0

Question for User: should we backfill applied_promotion_id on these 12 orders?
(Risk: very low — line_discount already proves the promo applied.)

## Section 2: 5 ghost-promo orders (PRM-003 set, no applicable variant)

### PHD000352
- created_at: 2026-05-30T00:56:55.42161+00:00, staff: tuyen2612
- order.discount_amount: 0, subtotal: 20000, total: 15000
- Line: Cà phê sữa đá (500ml), qty 1, unit_price 20000, line_discount 5000

### PHD000354
- created_at: 2026-05-30T01:29:53.721094+00:00, staff: tuyen2612
- order.discount_amount: 0, subtotal: 23000, total: 15000
- Line: Matcha latte (500ml), qty 1, unit_price 23000, line_discount 8000

### PHD000355
- created_at: 2026-05-30T01:50:05.710102+00:00, staff: tuyen2612
- order.discount_amount: 0, subtotal: 20000, total: 15000
- Line: Cà phê sữa đá (500ml), qty 1, unit_price 20000, line_discount 5000

### PHD000351
- created_at: 2026-05-30T00:51:29.87922+00:00, staff: tuyen2612
- order.discount_amount: 0, subtotal: 6000, total: 0
- Line: Cà phê đá (500ml), qty 1, unit_price 21000, line_discount 6000

### PHD000353
- created_at: 2026-05-30T01:16:53.832157+00:00, staff: tuyen2612
- order.discount_amount: 0, subtotal: 27000, total: 21000
- Line: Cà phê đá (500ml), qty 1, unit_price 21000, line_discount 6000

PRM-003 applicable_products_json current state:
```json
{"VAR-001":15000,"VAR-002":15000,"VAR-003":15000,"VAR-004":15000,"VAR-005":15000,"VAR-006":15000,"VAR-009":15000,"VAR-011":15000,"VAR-012":15000,"VAR-013":15000,"VAR-014":15000,"VAR-015":15000,"VAR-016":15000,"VAR-017":15000,"VAR-018":15000,"VAR-019":15000,"VAR-020":15000,"VAR-021":15000,"VAR-022":15000,"VAR-023":15000,"VAR-024":15000,"VAR-025":15000,"VAR-026":15000,"VAR-027":15000,"VAR-028":15000,"VAR-029":15000,"VAR-030":15000,"VAR-032":15000,"VAR-034":15000,"VAR-035":15000,"VAR-031":25000}
```

Interpretation: These orders have PRM-003 set in `applied_promotion_id`, but none of their cart items are in the current applicable_products_json. Since we do not have historical promo state, it is possible the variants were removed from the promo after the sale, or the cashier scanned the code out of habit even though the cart did not qualify.

Question for User: clear applied_promotion_id on these 5 orders, leave as-is, or deeper investigation?

## Section 3: 1 AMBIGUOUS order

- order_no: PHD000503
- created_at: 2026-06-16T02:20:40.846Z
- applied_promotion_id: none
- order.discount_amount: 18000
- Lines:
  - VAR-001: qty 1, unit_price 18000, line_discount 18000
- candidatePromoIds: PRM-003
- Why ambiguous: relevantPromos.length === 1 BUT line evidence does not fit any inferred tier

Question for User: manual classification or skip?

## Section 4: Schema repair status

Missing columns from DBOrder interface:
- subtotal_amount
- applied_promotion_snapshot_json (CRITICAL)
- discount_reason

Question for User: run schema repair script (Phase 5) to add missing columns?

## Section 5: Cross-check on CONFIRMED orders

Among 283 CONFIRMED orders, orders with order.discount_amount > 0: 0
Since this is 0, the UCK000094-style combo (PRODUCT_DISCOUNT + manual order discount) does not exist in the confirmed pool. No redistribution fix is needed.
