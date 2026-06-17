# Combo Audit Report

## PHD000522 Deep-Dive

### Order Details
- **ID**: ORD-1781659083295-182
- **Order No**: PHD000522
- **Created At**: 2026-06-17T01:18:03.295Z
- **Staff Name**: tuyen2612
- **Status**: COMPLETED
- **Voided**: FALSE
- **Subtotal**: 0
- **Discount Amount**: 6000
- **Total Amount**: 20000
- **Discount Type**: VND
- **Discount Reason**: 
- **Applied Promo ID**: none
- **Applied Promo Snapshot**: none

### Line Details
| variant_id | name | qty | unit_price | line_discount | discount_type | modifiers_json |
|---|---|---|---|---|---|---|
| VAR-002 | Cà phê sữa đá (500ml) | 1 | 20000 | 6000 | VND | `[{"id":"MOD-001","group_name":"Thêm Topping","name":"20ml cốt cà phê","price":"3000","status":"ACTIVE","created_at":"2026-06-01T09:48:51.639Z"},{"id":"MOD-001","group_name":"Thêm Topping","name":"20ml cốt cà phê","price":"3000","status":"ACTIVE","created_at":"2026-06-01T09:48:51.639Z"}]` |

### Computation Verification
- Sum of (unit_price * qty) + modifiers: **26000** (Matches subtotal: NO - actual is 0)
- Sum of line_discount across lines: **6000**
- Expected Total (subtotal - sum(line_discount) - order.discount_amount): **-12000**
- Actual Total Amount: **20000**
- Matches: **NO**

### Classification
- Is PRM-003 applied (line_discount > 0 on applicable variants)? **YES**
- Is manual order-level discount applied? **YES**
- Both active. Which code path produced this? **Unknown / Admin Edit**

### Timestamps
- Placed vs 122a633 (POS Combo Fix): **AFTER**
- Placed vs 7bac2d1 (Old POS bug): **AFTER**
- Post-creation edit? **Unlikely (No explicit signature)**

## All Combo Orders Scan

**Total Combo Orders**: 37

### Distribution by Tier
- AMBIGUOUS: 1
- UNKNOWN: 36

### Distribution by Staff
- tuyen2612: 37

### Distribution by Promo
- EMPTY: 4
- PRM-003: 33

### Distribution by Date
- 2026-06-16: 21
- 2026-06-17: 16

### Combo Orders Table
| order_no | created_at | staff_name | applied_promotion_id | sum(line_discount) | order.discount_amount | subtotal | total |
|---|---|---|---|---|---|---|---|
| PHD000503 | 2026-06-16T02:20:40.846Z | tuyen2612 |  | 18000 | 18000 | 0 | 0 |
| UCK000150 | 2026-06-16T09:44:25.335Z | tuyen2612 | PRM-003 | 3000 | 3000 | 0 | 15000 |
| UCK000151 | 2026-06-16T11:44:45.784Z | tuyen2612 | PRM-003 | 157000 | 157000 | 0 | 202000 |
| UCK000152 | 2026-06-16T12:01:38.838Z | tuyen2612 | PRM-003 | 24000 | 24000 | 0 | 30000 |
| UCK000153 | 2026-06-16T12:45:17.677Z | tuyen2612 | PRM-003 | 17000 | 17000 | 0 | 15000 |
| UCK000154 | 2026-06-16T12:54:01.067Z | tuyen2612 | PRM-003 | 34000 | 34000 | 0 | 30000 |
| UCK000155 | 2026-06-16T12:54:17.281Z | tuyen2612 | PRM-003 | 12000 | 12000 | 0 | 15000 |
| UCK000156 | 2026-06-16T13:50:51.088Z | tuyen2612 | PRM-003 | 62000 | 62000 | 0 | 146000 |
| UCK000157 | 2026-06-16T13:51:01.147Z | tuyen2612 | PRM-003 | 12000 | 12000 | 0 | 15000 |
| UCK000158 | 2026-06-16T13:51:34.986Z | tuyen2612 | PRM-003 | 24000 | 24000 | 0 | 30000 |
| UCK000159 | 2026-06-16T13:51:46.860Z | tuyen2612 | PRM-003 | 3000 | 3000 | 0 | 15000 |
| UCK000160 | 2026-06-16T13:51:57.113Z | tuyen2612 | PRM-003 | 12000 | 12000 | 0 | 15000 |
| UCK000161 | 2026-06-16T13:52:07.609Z | tuyen2612 | PRM-003 | 17000 | 17000 | 0 | 15000 |
| UCK000162 | 2026-06-16T14:01:01.194Z | tuyen2612 |  | 20000 | 12000 | 0 | 45000 |
| UCK000163 | 2026-06-16T15:36:06.353Z | tuyen2612 | PRM-003 | 12000 | 12000 | 0 | 15000 |
| PHD000504 | 2026-06-16T23:25:04.390Z | tuyen2612 |  | 21000 | 21000 | 0 | 0 |
| PHD000505 | 2026-06-16T23:50:27.336Z | tuyen2612 | PRM-003 | 6000 | 6000 | 0 | 30000 |
| PHD000506 | 2026-06-16T23:50:37.763Z | tuyen2612 | PRM-003 | 17000 | 17000 | 0 | 30000 |
| PHD000507 | 2026-06-16T23:50:47.235Z | tuyen2612 | PRM-003 | 7000 | 7000 | 0 | 15000 |
| PHD000508 | 2026-06-16T23:50:57.173Z | tuyen2612 | PRM-003 | 11000 | 11000 | 0 | 30000 |
| PHD000509 | 2026-06-16T23:56:18.788Z | tuyen2612 | PRM-003 | 8000 | 8000 | 0 | 15000 |
| PHD000510 | 2026-06-17T00:09:07.342Z | tuyen2612 | PRM-003 | 7000 | 7000 | 0 | 15000 |
| PHD000511 | 2026-06-17T00:09:15.836Z | tuyen2612 | PRM-003 | 5000 | 5000 | 0 | 15000 |
| PHD000512 | 2026-06-17T00:14:00.054Z | tuyen2612 | PRM-003 | 8000 | 8000 | 0 | 15000 |
| PHD000513 | 2026-06-17T00:14:08.117Z | tuyen2612 | PRM-003 | 5000 | 5000 | 0 | 15000 |
| PHD000514 | 2026-06-17T00:33:05.674Z | tuyen2612 | PRM-003 | 9000 | 9000 | 0 | 15000 |
| PHD000515 | 2026-06-17T00:38:01.773Z | tuyen2612 | PRM-003 | 7000 | 7000 | 0 | 18000 |
| PHD000516 | 2026-06-17T00:38:10.820Z | tuyen2612 | PRM-003 | 5000 | 5000 | 0 | 15000 |
| PHD000517 | 2026-06-17T00:44:11.080Z | tuyen2612 | PRM-003 | 7000 | 7000 | 0 | 15000 |
| PHD000518 | 2026-06-17T00:55:16.221Z | tuyen2612 | PRM-003 | 9000 | 9000 | 0 | 15000 |
| PHD000519 | 2026-06-17T00:55:28.196Z | tuyen2612 | PRM-003 | 9000 | 9000 | 0 | 15000 |
| PHD000520 | 2026-06-17T01:02:33.800Z | tuyen2612 | PRM-003 | 7000 | 7000 | 0 | 15000 |
| PHD000521 | 2026-06-17T01:15:10.373Z | tuyen2612 | PRM-003 | 8000 | 8000 | 0 | 15000 |
| PHD000522 | 2026-06-17T01:18:03.295Z | tuyen2612 |  | 6000 | 6000 | 0 | 20000 |
| PHD000523 | 2026-06-17T01:25:04.697Z | tuyen2612 | PRM-003 | 10000 | 10000 | 0 | 30000 |
| PHD000524 | 2026-06-17T01:27:15.795Z | tuyen2612 | PRM-003 | 5000 | 5000 | 0 | 15000 |
| PHD000525 | 2026-06-17T01:58:54.327Z | tuyen2612 | PRM-003 | 5000 | 5000 | 0 | 15000 |

## Code Path Audit

### POS Checkout (`app/actions/pos.ts`)
- **Can produce combo?**: YES.
- **Intentional?**: YES. Commit `122a633` explicitly modified `components/POSScreen.tsx` to preserve `PRODUCT_DISCOUNT` on applicable variants even when a manual order-level discount is entered. The frontend calculates both arrays, and `pos.ts` blindly writes whatever `cart.discount_amount` (lines) and `orderData.discount_amount` it receives.

### Admin Edit Order (`app/actions/order-edit.ts`)
- **Can produce combo?**: YES.
- **Intentional?**: LIKELY INTENTIONAL / UNRESTRICTED. The admin panel (`OrderEditModal.tsx`) allows modifying the `discount_amount` field on individual items AND the total order `discount_amount`. The backend `order-edit.ts` blindly writes both. It does set `discount_reason: 'Chỉnh sửa sau khi thanh toán'` and strips the `applied_promotion_id` to `''` when doing so.

### Migration Scripts
- `fix-product-discount-overrides.ts`: Modifies `line_discount` and `order.discount_amount`. However, its design (Option A) explicitly redistributes the `order.discount_amount` onto lines and sets the order's discount to 0. So it **REMOVES** combos, it doesn't create them.
- `fix-subtotal-and-line-discounts.ts`: Backfilled subtotal, did not create combos.

### Deployment Status
- **122a633 Deployed?**: YES. Checking the `.next/server` folder shows build artifacts updated around `2026-06-16 18:06`, which is after the commit `122a633` was merged (11:30). Vercel/Netlify likely automatically deployed this.

## Open Questions for Claude

- The admin order edit modal deliberately wipes `applied_promotion_id` when an edit is made. Does this conflict with the classification engine's expectation that manually modified orders retain their promo context? Should `applied_promotion_snapshot_json` also be wiped during an admin edit?
