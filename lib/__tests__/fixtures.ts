/**
 * Golden case fixtures for order-math tests — built from REAL data.
 *
 * Sources:
 *   - UCK000094: real order, 9 lines, PRM-003 promo, 5k data corruption
 *   - PHD000540: real order, 1 line, combo case (promo + 21k order discount, customer paid 0)
 *
 * Each real order has TWO variants:
 *   - Raw:      as-it-is in the live database (with whatever corruption exists)
 *   - Migrated: the form WS-5 migration will produce (invariants satisfied)
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (sections 5, 6, 7)
 */

import type { OrderV2, OrderLineV2, LineForAllocation, ModifierSnapshot } from "@/lib/order-types";

// ============================================================================
// PRM-003 — real promotion snapshot (from live Promotions sheet)
// ============================================================================

export const PRM_003_SNAPSHOT = {
  id: "PRM-003",
  name: "KHAI TRƯƠNG ĐỒNG GIÁ",
  type: "PRODUCT_DISCOUNT" as const,
  discount_type: "FLAT_PRICE" as const,
  discount_value: 15000,
  applicable_products_json: JSON.stringify({
    "VAR-001": 15000, "VAR-002": 15000, "VAR-003": 15000, "VAR-004": 15000,
    "VAR-005": 15000, "VAR-006": 15000, "VAR-009": 15000, "VAR-011": 15000,
    "VAR-012": 15000, "VAR-013": 15000, "VAR-014": 15000, "VAR-015": 15000,
    "VAR-016": 15000, "VAR-017": 15000, "VAR-018": 15000, "VAR-019": 15000,
    "VAR-020": 15000, "VAR-021": 15000, "VAR-022": 15000, "VAR-023": 15000,
    "VAR-024": 15000, "VAR-025": 15000, "VAR-026": 15000, "VAR-027": 15000,
    "VAR-028": 15000, "VAR-029": 15000, "VAR-030": 15000, "VAR-032": 15000,
    "VAR-034": 15000, "VAR-035": 15000,
    "VAR-031": 25000, // Sữa dâu sấy giòn — exception: 25k instead of 15k
  }),
  code: "",
  start_date: "2026-05-31T17:00:00.000Z",
  end_date: "2026-06-30T16:59:00.000Z",
};

// ============================================================================
// Helper: build an OrderLineV2 from concise real-data inputs
// ============================================================================

interface LineSpec {
  line_no: number;
  line_id: string;
  product_id: string;
  product_name: string;
  variant_id: string;
  variant_size_name: string;
  unit_price: number;
  qty: number;
  modifiers?: ModifierSnapshot[];
  line_discount: number;
  order_discount_allocation: number;
}

function buildLine(orderId: string, spec: LineSpec): OrderLineV2 {
  const modifiers = spec.modifiers || [];
  const modsTotal = modifiers.reduce((s, m) => s + m.price * m.qty, 0);
  const gross = (spec.unit_price + modsTotal) * spec.qty;
  const manualItem = 0; // real data has no manual_item_discount
  const net = gross - spec.line_discount - manualItem - spec.order_discount_allocation;

  return {
    id: spec.line_id,
    order_id: orderId,
    line_no: spec.line_no,
    product_id: spec.product_id,
    product_snapshot_json: JSON.stringify({
      id: spec.product_id,
      name: spec.product_name,
      category_id: "CAT-DRINKS",
      category_name: "Đồ uống",
    }),
    variant_id: spec.variant_id,
    variant_snapshot_json: JSON.stringify({
      id: spec.variant_id,
      size_name: spec.variant_size_name,
      price: spec.unit_price,
    }),
    qty: spec.qty,
    unit_price: spec.unit_price,
    modifiers_snapshot_json: JSON.stringify(modifiers),
    gross_line_total: gross,
    promo_discount: spec.line_discount,
    manual_item_discount: manualItem,
    order_discount_allocation: spec.order_discount_allocation,
    net_line_total: net,
    cost_at_sale: 0, // not tracked in fixtures; migration script will populate
    recipe_snapshot_json: "{}", // not tracked in fixtures; migration script will populate
    promo_discount_reason: spec.line_discount > 0 ? "PRM-003" : "",
    manual_discount_reason: "",
  };
}

// ============================================================================
// Standalone Sữa Dâu — 1-line order, NO order-level discount.
// Verifies the audit headline: 1 Sữa Dâu = 25.000đ.
// ============================================================================

export function makeSuaDauStandaloneOrder(): { order: OrderV2; lines: OrderLineV2[] } {
  const orderId = "ord-sua-dau-standalone";
  const line = buildLine(orderId, {
    line_no: 1,
    line_id: "ol-sua-dau-standalone",
    product_id: "PROD-024",
    product_name: "Sữa dâu sấy giòn",
    variant_id: "VAR-031",
    variant_size_name: "700ml",
    unit_price: 35000,
    qty: 1,
    line_discount: 10000, // FLAT_PRICE 25k → discount = 35k - 25k = 10k
    order_discount_allocation: 0,
  });

  const order: OrderV2 = {
    id: orderId,
    order_no: "SUA-DAU-001",
    brand_id: "BR-002",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-06-12T12:21:26.776Z",
    created_by_id: "USER-TUYEN2612",
    created_by_name: "tuyen2612",
    completed_at: "2026-06-12T12:21:26.776Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: 35000,
    promo_discount_total: 10000,
    manual_item_discount_total: 0,
    manual_order_discount: 0,
    net_total: 25000,
    applied_promotion_id: "PRM-003",
    applied_promotion_snapshot_json: JSON.stringify(PRM_003_SNAPSHOT),
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };

  return { order, lines: [line] };
}

// ============================================================================
// UCK000094 — real 9-line order
//
// Real situation per User (2026-06-18):
//   - Order has PRM-003 promo (105k total line_discount)
//   - NO manual order-level discount was given
//   - Customer actually paid 161.000đ (= gross 266k − promo 105k)
//   - Legacy system recorded order.total_amount = 156.000đ due to a calc bug
//     (the same double-counting bug the rebuild is fixing).
//
// Migration action:
//   - net_total corrected from 156k → 161k to match sum of line nets
//   - manual_order_discount stays 0 (no order-level discount existed)
//   - All per-line order_discount_allocation stay 0
// ============================================================================

const UCK000094_LINE_SPECS_BASE = [
  { line_no: 1, line_id: "OL-1781266888341-0-387", product_id: "PROD-017", product_name: "Trà dâu",            variant_id: "VAR-024", unit_price: 27000, qty: 1, line_discount: 12000 },
  { line_no: 2, line_id: "OL-1781266888342-1-570", product_id: "PROD-025", product_name: "Trà sữa truyền thống", variant_id: "VAR-032", unit_price: 18000, qty: 1, line_discount: 3000  },
  { line_no: 3, line_id: "OL-1781266888342-2-629", product_id: "PROD-019", product_name: "Yogurt dâu",          variant_id: "VAR-026", unit_price: 32000, qty: 1, line_discount: 17000, modifiers: [{ id: "MOD-004", name: "Trân châu trắng", price: 5000, qty: 1 }] },
  { line_no: 4, line_id: "OL-1781266888342-3-983", product_id: "PROD-021", product_name: "Yogurt xoài",         variant_id: "VAR-028", unit_price: 32000, qty: 1, line_discount: 17000, modifiers: [{ id: "MOD-004", name: "Trân châu trắng", price: 5000, qty: 1 }] },
  { line_no: 5, line_id: "OL-1781266888342-4-121", product_id: "PROD-019", product_name: "Yogurt dâu",          variant_id: "VAR-026", unit_price: 32000, qty: 2, line_discount: 34000 },
  { line_no: 6, line_id: "OL-1781266888343-5-873", product_id: "PROD-015", product_name: "Trà đào dầm",         variant_id: "VAR-022", unit_price: 27000, qty: 1, line_discount: 12000 },
  { line_no: 7, line_id: "OL-1781266888343-6-316", product_id: "PROD-026", product_name: "Hồng trà sủi bọt",    variant_id: "VAR-033", unit_price: 6000,  qty: 1, line_discount: 0     },
  { line_no: 8, line_id: "OL-1781266888343-7-433", product_id: "PROD-011", product_name: "Hồng trà chanh",      variant_id: "VAR-016", unit_price: 15000, qty: 1, line_discount: 0     },
  { line_no: 9, line_id: "OL-1781266888343-8-157", product_id: "PROD-024", product_name: "Sữa dâu sấy giòn",    variant_id: "VAR-031", unit_price: 35000, qty: 1, line_discount: 10000 },
];

export const UCK000094_ORDER_ID = "ORD-1781266886776-149";
export const UCK000094_GROSS_TOTAL = 266000;
export const UCK000094_PROMO_TOTAL = 105000;
export const UCK000094_LEGACY_BUGGY_TOTAL = 156000; // legacy recorded (wrong)
export const UCK000094_CORRECT_NET_TOTAL = 161000; // = gross − promo; what customer actually paid

function buildUCK000094Lines(): OrderLineV2[] {
  return UCK000094_LINE_SPECS_BASE.map(spec =>
    buildLine(UCK000094_ORDER_ID, {
      ...spec,
      variant_size_name: "700ml",
      order_discount_allocation: 0, // no order-level discount
    }),
  );
}

function buildUCK000094Order(netTotal: number, migrationNotes: string): OrderV2 {
  return {
    id: UCK000094_ORDER_ID,
    order_no: "UCK000094",
    brand_id: "BR-002",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-06-12T12:21:26.776Z",
    created_by_id: "USER-TUYEN2612",
    created_by_name: "tuyen2612",
    completed_at: "2026-06-12T12:21:26.776Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: UCK000094_GROSS_TOTAL,
    promo_discount_total: UCK000094_PROMO_TOTAL,
    manual_item_discount_total: 0,
    manual_order_discount: 0, // confirmed by User: no order-level discount existed
    net_total: netTotal,
    applied_promotion_id: "PRM-003",
    applied_promotion_snapshot_json: JSON.stringify(PRM_003_SNAPSHOT),
    pos_snapshot_json: "{}",
    payment_method: "BANK_TRANSFER",
    payment_ref: "",
    migration_notes: migrationNotes,
  };
}

/** UCK000094 in RAW form — legacy data with buggy total_amount (156k). FAILS invariants. */
export function makeUCK000094RawOrder(): { order: OrderV2; lines: OrderLineV2[] } {
  return {
    order: buildUCK000094Order(
      UCK000094_LEGACY_BUGGY_TOTAL,
      "RAW form — legacy order.total_amount=156000 reflects the double-counting bug; sum of line nets is 161000.",
    ),
    lines: buildUCK000094Lines(),
  };
}

/** UCK000094 in MIGRATED form — net_total corrected to 161k. PASSES invariants. */
export function makeUCK000094MigratedOrder(): { order: OrderV2; lines: OrderLineV2[] } {
  return {
    order: buildUCK000094Order(
      UCK000094_CORRECT_NET_TOTAL,
      "Migrated: net_total corrected from legacy 156000 to 161000 to match sum of line nets (gross 266000 − promo 105000). No order-level discount existed; the 5k discrepancy was a legacy calc bug, not a real discount.",
    ),
    lines: buildUCK000094Lines(),
  };
}

// ============================================================================
// PHD000540 — real 1-line combo case
// PRM-003 PRODUCT_DISCOUNT + 21k manual order discount on a 21k order.
// Customer paid 0. Raw data has double-counting bug (gross - all = -3k).
// Migrated form adjusts order_discount to 18k.
// ============================================================================

export const PHD000540_ORDER_ID = "ORD-1781743016326-678";

function buildPHD000540Line(orderAlloc: number): OrderLineV2 {
  return buildLine(PHD000540_ORDER_ID, {
    line_no: 1,
    line_id: "OL-1781743017714-0-833",
    product_id: "PROD-001",
    product_name: "Trà sữa truyền thống",
    variant_id: "VAR-001",
    variant_size_name: "700ml",
    unit_price: 18000,
    qty: 1,
    modifiers: [{ id: "MOD-001", name: "20ml cốt cà phê", price: 3000, qty: 1 }],
    line_discount: 3000, // FLAT_PRICE 15k → 18k - 15k = 3k
    order_discount_allocation: orderAlloc,
  });
}

function buildPHD000540Order(orderDiscount: number, migrationNotes: string): OrderV2 {
  return {
    id: PHD000540_ORDER_ID,
    order_no: "PHD000540",
    brand_id: "BR-002",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: "2026-06-18T00:36:56.326Z",
    created_by_id: "USER-TUYEN2612",
    created_by_name: "tuyen2612",
    completed_at: "2026-06-18T00:36:56.326Z",
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: 21000,
    promo_discount_total: 3000,
    manual_item_discount_total: 0,
    manual_order_discount: orderDiscount,
    net_total: 0, // customer paid 0
    applied_promotion_id: "PRM-003",
    applied_promotion_snapshot_json: JSON.stringify(PRM_003_SNAPSHOT),
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: migrationNotes,
  };
}

/** PHD000540 in RAW form — original order.discount_amount was 21000. FAILS invariants. */
export function makePHD000540RawOrder(): { order: OrderV2; lines: OrderLineV2[] } {
  return {
    order: buildPHD000540Order(
      21000,
      "RAW form — original order.discount_amount=21000. With 3000 promo, gross - all = -3000 (negative net). Customer actually paid 0; order_discount should have been 18000.",
    ),
    lines: [buildPHD000540Line(21000)], // single line absorbs full 21k allocation
  };
}

/** PHD000540 in MIGRATED form — order_discount adjusted 21k → 18k. PASSES invariants. */
export function makePHD000540MigratedOrder(): { order: OrderV2; lines: OrderLineV2[] } {
  return {
    order: buildPHD000540Order(
      18000,
      "Migrated: original order.discount_amount=21000; adjusted to 18000 to remove 3000 overlap with promo (double-counting bug). gross(21000) - promo(3000) - manual_order(18000) = 0 = net_total.",
    ),
    lines: [buildPHD000540Line(18000)],
  };
}

// ============================================================================
// Synthetic fixtures — for testing math edge cases not covered by real data
// ============================================================================

/** Order with no discounts at all — net = gross. */
export function makeNoDiscountOrder(): { order: OrderV2; lines: OrderLineV2[] } {
  const orderId = "ord-no-discount";
  const line = buildLine(orderId, {
    line_no: 1,
    line_id: "ol-no-discount-1",
    product_id: "PROD-X",
    product_name: "X",
    variant_id: "VAR-X",
    variant_size_name: "M",
    unit_price: 30000,
    qty: 2,
    line_discount: 0,
    order_discount_allocation: 0,
  });
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

/** LineForAllocation with multiple modifiers — for testing proportional allocation. */
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

/** Edge case: order discount > sum of line capacities. Each line capped at capacity. */
export function makeCapacityCapOrder(): { order: OrderV2; lines: OrderLineV2[] } {
  const orderId = "ord-cap-test";
  const lineA = buildLine(orderId, {
    line_no: 1,
    line_id: "ol-cap-1",
    product_id: "PROD-A",
    product_name: "A",
    variant_id: "VAR-A",
    variant_size_name: "M",
    unit_price: 30000,
    qty: 1,
    line_discount: 25000, // capacity = 30k - 25k = 5k
    order_discount_allocation: 5000,
  });
  const lineB = buildLine(orderId, {
    line_no: 2,
    line_id: "ol-cap-2",
    product_id: "PROD-B",
    product_name: "B",
    variant_id: "VAR-B",
    variant_size_name: "M",
    unit_price: 20000,
    qty: 1,
    line_discount: 0,
    order_discount_allocation: 20000, // capacity = 20k
  });
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
    manual_order_discount: 25000, // capped from a higher input
    net_total: 0,
    applied_promotion_id: "",
    applied_promotion_snapshot_json: "",
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };
  return { order, lines: [lineA, lineB] };
}
