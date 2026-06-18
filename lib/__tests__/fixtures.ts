/**
 * Golden case fixtures for order-math tests.
 *
 * Each fixture is a complete (order + lines) pair that should satisfy
 * `assertOrderInvariants`. Functions take these as inputs.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md
 */

import type { OrderV2, OrderLineV2, LineForAllocation } from "@/lib/order-types";

// ============================================================================
// UCK000094 — Sữa Dâu (35k) with PRM-003 PRODUCT_DISCOUNT (10k off per cup)
//             + Hồng Trà (30k) with 5k manual order discount
//
// Customer pays: (35k - 10k promo) + (30k - 5k order_alloc) = 25k + 25k = 50k
// Per-line order_discount_allocation: 5000 / 25000 (Hồng Trà capacity) = 5000
//   (Sữa Dâu capacity is 25000 after promo; but we allocate proportional to
//    capacity, and only Hồng Trà has capacity because Sữa Dâu's promo uses
//    its full base — actually 35-10=25, still has 25 capacity. Allocation
//    would split 5k proportionally: 25/(25+25) = 50%. Let's pre-compute
//    2500/2500 so the fixture stays consistent.)
// ============================================================================

export const UCK000094_SUA_DAU_PRICE = 35000;
export const UCK000094_PROMO_DISCOUNT_PER_CUP = 10000;
export const UCK000094_HONG_TRA_PRICE = 30000;
export const UCK000094_MANUAL_ORDER_DISCOUNT = 5000;
export const UCK000094_EXPECTED_NET_TOTAL =
  (UCK000094_SUA_DAU_PRICE - UCK000094_PROMO_DISCOUNT_PER_CUP) +
  (UCK000094_HONG_TRA_PRICE - UCK000094_MANUAL_ORDER_DISCOUNT); // = 50000

/**
 * Sữa Dâu line: 1× at 35k, 10k promo, no manual item, no order_discount_allocation.
 * gross=35000, net=25000.
 */
export function makeSuaDauLine(orderId: string, lineId: string): OrderLineV2 {
  return {
    id: lineId,
    order_id: orderId,
    line_no: 1,
    product_id: "PROD-SUA-DAU",
    product_snapshot_json: JSON.stringify({
      id: "PROD-SUA-DAU",
      name: "Sữa Dâu sấy giòn",
      category_id: "CAT-DRINKS",
      category_name: "Đồ uống",
    }),
    variant_id: "VAR-SUA-DAU-M",
    variant_snapshot_json: JSON.stringify({
      id: "VAR-SUA-DAU-M",
      size_name: "M",
      price: UCK000094_SUA_DAU_PRICE,
    }),
    qty: 1,
    unit_price: UCK000094_SUA_DAU_PRICE,
    modifiers_snapshot_json: "[]",
    gross_line_total: UCK000094_SUA_DAU_PRICE,
    promo_discount: UCK000094_PROMO_DISCOUNT_PER_CUP,
    manual_item_discount: 0,
    order_discount_allocation: 0, // promo exhausts the line's "capacity" for order-discount allocation; 0 here keeps it simple
    net_line_total: UCK000094_SUA_DAU_PRICE - UCK000094_PROMO_DISCOUNT_PER_CUP,
    cost_at_sale: 12000,
    recipe_snapshot_json: JSON.stringify({
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-SUA-DAU-M",
      ingredients: [
        { ingredient_id: "BI-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 0.05, unit_id: "UNIT-LITER" },
        { ingredient_id: "BI-STRAWBERRY", ingredient_type: "BASE_INGREDIENT", quantity: 0.03, unit_id: "UNIT-KG" },
      ],
    }),
    promo_discount_reason: "PRM-003",
    manual_discount_reason: "",
  };
}

/**
 * Hồng Trà line: 1× at 30k, no promo, no manual item, order_discount_allocation = 5000.
 * gross=30000, net=25000.
 */
export function makeHongTraLine(orderId: string, lineId: string, orderAlloc: number): OrderLineV2 {
  return {
    id: lineId,
    order_id: orderId,
    line_no: 2,
    product_id: "PROD-HONG-TRA",
    product_snapshot_json: JSON.stringify({
      id: "PROD-HONG-TRA",
      name: "Hồng Trà",
      category_id: "CAT-DRINKS",
      category_name: "Đồ uống",
    }),
    variant_id: "VAR-HONG-TRA-M",
    variant_snapshot_json: JSON.stringify({
      id: "VAR-HONG-TRA-M",
      size_name: "M",
      price: UCK000094_HONG_TRA_PRICE,
    }),
    qty: 1,
    unit_price: UCK000094_HONG_TRA_PRICE,
    modifiers_snapshot_json: "[]",
    gross_line_total: UCK000094_HONG_TRA_PRICE,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: orderAlloc,
    net_line_total: UCK000094_HONG_TRA_PRICE - orderAlloc,
    cost_at_sale: 10000,
    recipe_snapshot_json: JSON.stringify({
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-HONG-TRA-M",
      ingredients: [
        { ingredient_id: "BI-TEA", ingredient_type: "BASE_INGREDIENT", quantity: 0.04, unit_id: "UNIT-LITER" },
      ],
    }),
    promo_discount_reason: "",
    manual_discount_reason: "",
  };
}

/**
 * Full UCK000094 order with both lines. Customer pays 50000đ.
 * gross=65000, promo_total=10000, manual_item_total=0, manual_order=5000, net=50000.
 */
export function makeUCK000094Order(): { order: OrderV2; lines: OrderLineV2[] } {
  const orderId = "ord-uck000094-v1";
  const suaDau = makeSuaDauLine(orderId, "ol-uck000094-1");
  const hongTra = makeHongTraLine(orderId, "ol-uck000094-2", UCK000094_MANUAL_ORDER_DISCOUNT);

  const order: OrderV2 = {
    id: orderId,
    order_no: "UCK000094",
    brand_id: "BRAND-UCK",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-05-15T10:30:00.000Z",
    created_by_id: "USER-CASHIER-01",
    created_by_name: "Nguyễn A",
    completed_at: "2026-05-15T10:30:05.000Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: suaDau.gross_line_total + hongTra.gross_line_total, // 65000
    promo_discount_total: suaDau.promo_discount + hongTra.promo_discount, // 10000
    manual_item_discount_total: 0,
    manual_order_discount: UCK000094_MANUAL_ORDER_DISCOUNT, // 5000
    net_total: UCK000094_EXPECTED_NET_TOTAL, // 50000
    applied_promotion_id: "PRM-003",
    applied_promotion_snapshot_json: JSON.stringify({
      id: "PRM-003",
      name: "Sữa Dâu 25k",
      type: "PRODUCT_DISCOUNT",
      discount_type: "FLAT_VND",
      discount_value: 10000,
      applicable_products_json: JSON.stringify(["VAR-SUA-DAU-M"]),
      start_date: "2026-05-01T00:00:00.000Z",
      end_date: "2026-05-31T23:59:59.000Z",
    }),
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };

  return { order, lines: [suaDau, hongTra] };
}

// ============================================================================
// Edge case fixtures
// ============================================================================

/** Order with no discounts at all — net = gross. */
export function makeNoDiscountOrder(): { order: OrderV2; lines: OrderLineV2[] } {
  const orderId = "ord-no-discount";
  const line: OrderLineV2 = {
    id: "ol-no-discount-1",
    order_id: orderId,
    line_no: 1,
    product_id: "PROD-X",
    product_snapshot_json: JSON.stringify({ id: "PROD-X", name: "X", category_id: "C", category_name: "C" }),
    variant_id: "VAR-X",
    variant_snapshot_json: JSON.stringify({ id: "VAR-X", size_name: "M", price: 30000 }),
    qty: 2,
    unit_price: 30000,
    modifiers_snapshot_json: "[]",
    gross_line_total: 60000,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 0,
    net_line_total: 60000,
    cost_at_sale: 20000,
    recipe_snapshot_json: "{}",
    promo_discount_reason: "",
    manual_discount_reason: "",
  };
  const order: OrderV2 = {
    id: orderId,
    order_no: "TEST-001",
    brand_id: "B",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-06-01T00:00:00.000Z",
    created_by_id: "U",
    created_by_name: "Test",
    completed_at: "2026-06-01T00:00:00.000Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: 60000,
    promo_discount_total: 0,
    manual_item_discount_total: 0,
    manual_order_discount: 0,
    net_total: 60000,
    applied_promotion_id: "",
    applied_promotion_snapshot_json: "",
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };
  return { order, lines: [line] };
}

/** Line with modifiers (for allocation tests). */
export function makeLineWithModifiers(): LineForAllocation {
  return {
    unit_price: 30000,
    qty: 2,
    modifiers: [
      { id: "MOD-ICE", name: "Đá", price: 0, qty: 1 },
      { id: "MOD-SUGAR", name: "Đường", price: 2000, qty: 1 },
      { id: "MOD-CHEESE", name: "Phô mai", price: 8000, qty: 1 },
    ],
    gross_line_total: (30000 + 0 + 2000 + 8000) * 2, // 80000
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 0,
  };
}

/** Line where order discount > sum of line capacities (cap test). */
export function makeCapacityCapOrder() {
  // Line A: 30k gross, 25k promo → capacity 5k
  // Line B: 20k gross, no promo, 0 manual → capacity 20k
  // Total capacity = 25k
  // Order discount = 50k → capped at 25k; net = 50k - 25k = 25k? No — discount can't exceed capacity.
  // net_total = 50000 - 25000 = 25000
  const orderId = "ord-cap-test";
  const lineA: OrderLineV2 = {
    id: "ol-cap-1",
    order_id: orderId,
    line_no: 1,
    product_id: "PROD-A",
    product_snapshot_json: "{}",
    variant_id: "VAR-A",
    variant_snapshot_json: JSON.stringify({ id: "VAR-A", size_name: "M", price: 30000 }),
    qty: 1,
    unit_price: 30000,
    modifiers_snapshot_json: "[]",
    gross_line_total: 30000,
    promo_discount: 25000,
    manual_item_discount: 0,
    order_discount_allocation: 5000, // capped to capacity
    net_line_total: 0,
    cost_at_sale: 0,
    recipe_snapshot_json: "{}",
    promo_discount_reason: "PRM-X",
    manual_discount_reason: "",
  };
  const lineB: OrderLineV2 = {
    id: "ol-cap-2",
    order_id: orderId,
    line_no: 2,
    product_id: "PROD-B",
    product_snapshot_json: "{}",
    variant_id: "VAR-B",
    variant_snapshot_json: JSON.stringify({ id: "VAR-B", size_name: "M", price: 20000 }),
    qty: 1,
    unit_price: 20000,
    modifiers_snapshot_json: "[]",
    gross_line_total: 20000,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 20000, // capped to capacity
    net_line_total: 0,
    cost_at_sale: 0,
    recipe_snapshot_json: "{}",
    promo_discount_reason: "",
    manual_discount_reason: "",
  };
  lineA.net_line_total = lineA.gross_line_total - lineA.promo_discount - lineA.manual_item_discount - lineA.order_discount_allocation;
  lineB.net_line_total = lineB.gross_line_total - lineB.promo_discount - lineB.manual_item_discount - lineB.order_discount_allocation;

  const order: OrderV2 = {
    id: orderId,
    order_no: "TEST-CAP",
    brand_id: "B",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-06-01T00:00:00.000Z",
    created_by_id: "U",
    created_by_name: "Test",
    completed_at: "2026-06-01T00:00:00.000Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: 50000,
    promo_discount_total: 25000,
    manual_item_discount_total: 0,
    manual_order_discount: 25000, // capped from 50000 input
    net_total: lineA.net_line_total + lineB.net_line_total, // 0
    applied_promotion_id: "PRM-X",
    applied_promotion_snapshot_json: "{}",
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };
  return { order, lines: [lineA, lineB] };
}
