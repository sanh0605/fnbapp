import { describe, it, expect } from "vitest";
import {
  checkHeaderArithmetic,
  checkLineSum,
  checkNoSupersededCompleted,
  checkPayments,
  computeMonthlyTotal,
  meetsMinimumOrderCount,
  checkLineGrossFormula,
  checkLineNetFormula,
  checkOrderLineSums,
  checkLineSanity,
  parsePromotionSnapshot,
  computeExpectedPromoDiscountForLine,
  checkPromoRecomputation,
  checkPromoEligibility,
  checkLineVariantCoverage,
  checkPromoAsymmetry,
  type RevenueOrder,
  type RevenueLine,
  type RevenuePayment,
  type RevenuePromoOrder,
  type RevenuePromoLine,
  type RevenueLineDetail,
} from "./verify-revenue-core";

function makeOrder(overrides: Partial<RevenueOrder> = {}): RevenueOrder {
  return {
    id: "ord-1",
    order_no: "UCK000001",
    superseded_by: "",
    created_at: "2026-06-15T10:00:00Z",
    gross_total: 20000,
    promo_discount_total: 0,
    manual_item_discount_total: 0,
    manual_order_discount: 0,
    net_total: 20000,
    ...overrides,
  };
}

describe("checkHeaderArithmetic", () => {
  it("no mismatch when net_total = gross - promo - manual item - manual order", () => {
    const order = makeOrder({
      gross_total: 100000,
      promo_discount_total: 10000,
      manual_item_discount_total: 5000,
      manual_order_discount: 2000,
      net_total: 83000,
    });
    expect(checkHeaderArithmetic([order])).toEqual([]);
  });

  it("reports a mismatch with the expected and actual values", () => {
    const order = makeOrder({
      gross_total: 100000,
      promo_discount_total: 10000,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 85000, // should be 90000
    });
    expect(checkHeaderArithmetic([order])).toEqual([
      { order_no: order.order_no, order_id: order.id, expected: 90000, actual: 85000 },
    ]);
  });
});

describe("checkLineSum", () => {
  it("no mismatch when lines sum to net_total", () => {
    const order = makeOrder({ net_total: 30000 });
    const lines: RevenueLine[] = [
      { order_id: order.id, net_line_total: 20000 },
      { order_id: order.id, net_line_total: 10000 },
    ];
    const result = checkLineSum([order], lines);
    expect(result.mismatches).toEqual([]);
    expect(result.checkedCount).toBe(1);
    expect(result.noLineOrders).toEqual([]);
  });

  it("reports a mismatch when lines do not sum to net_total", () => {
    const order = makeOrder({ net_total: 30000 });
    const lines: RevenueLine[] = [{ order_id: order.id, net_line_total: 20000 }];
    const result = checkLineSum([order], lines);
    expect(result.mismatches).toEqual([
      { order_no: order.order_no, order_id: order.id, expected: 20000, actual: 30000 },
    ]);
    expect(result.checkedCount).toBe(1);
  });

  // UCK000269's shape (plan section 3): a real order with net_total > 0 and
  // zero lines. This must land in noLineOrders, not mismatches -- there is
  // nothing to sum, so "0 != net_total" is not a meaningful arithmetic
  // violation the way a partial line loss is.
  it("an order with zero lines is reported separately, not as a mismatch", () => {
    const order = makeOrder({ id: "ord-269", order_no: "UCK000269", net_total: 15000 });
    const result = checkLineSum([order], []);
    expect(result.mismatches).toEqual([]);
    expect(result.checkedCount).toBe(0);
    expect(result.noLineOrders).toEqual([{ order_no: "UCK000269", order_id: "ord-269", net_total: 15000 }]);
  });

  it("does not subtract manual_order_discount a second time (2026-08-14 correction) -- lines already net it out", () => {
    // A line's net_line_total already has the order-level discount
    // allocated into it (order_discount_allocation, per the schema) -- the
    // sum of lines equals net_total directly, with no further subtraction.
    const order = makeOrder({
      gross_total: 50000,
      manual_order_discount: 5000,
      net_total: 45000,
    });
    const lines: RevenueLine[] = [{ order_id: order.id, net_line_total: 45000 }];
    const result = checkLineSum([order], lines);
    expect(result.mismatches).toEqual([]);
  });

  it("only sums lines belonging to the order being checked", () => {
    const orderA = makeOrder({ id: "A", order_no: "UCK-A", net_total: 10000 });
    const orderB = makeOrder({ id: "B", order_no: "UCK-B", net_total: 20000 });
    const lines: RevenueLine[] = [
      { order_id: "A", net_line_total: 10000 },
      { order_id: "B", net_line_total: 20000 },
    ];
    const result = checkLineSum([orderA, orderB], lines);
    expect(result.mismatches).toEqual([]);
    expect(result.checkedCount).toBe(2);
  });
});

describe("checkNoSupersededCompleted", () => {
  it("no violation when superseded_by is empty", () => {
    expect(checkNoSupersededCompleted([makeOrder({ superseded_by: "" })])).toEqual([]);
  });

  it("reports a COMPLETED order carrying a non-empty superseded_by", () => {
    const order = makeOrder({ superseded_by: "ord-2" });
    expect(checkNoSupersededCompleted([order])).toEqual([
      { order_no: order.order_no, order_id: order.id, superseded_by: "ord-2" },
    ]);
  });
});

describe("checkPayments", () => {
  it("no mismatch when payments sum to net_total", () => {
    const order = makeOrder({ net_total: 25000 });
    const payments: RevenuePayment[] = [
      { order_id: order.id, amount: 15000 },
      { order_id: order.id, amount: 10000 },
    ];
    const result = checkPayments([order], payments);
    expect(result.mismatches).toEqual([]);
    expect(result.ordersWithPayments).toBe(1);
    expect(result.netTotalWithPayments).toBe(25000);
    expect(result.paymentSumTotal).toBe(25000);
    expect(result.ordersWithoutPayments).toBe(0);
  });

  it("reports a mismatch when payments do not sum to net_total", () => {
    const order = makeOrder({ net_total: 25000 });
    const payments: RevenuePayment[] = [{ order_id: order.id, amount: 20000 }];
    const result = checkPayments([order], payments);
    expect(result.mismatches).toEqual([
      { order_no: order.order_no, order_id: order.id, expected: 20000, actual: 25000 },
    ]);
  });

  it("an order with no payment rows is reported separately, not as a mismatch (order_payments begins 2026-07-19)", () => {
    const order = makeOrder({ net_total: 15000 });
    const result = checkPayments([order], []);
    expect(result.mismatches).toEqual([]);
    expect(result.ordersWithoutPayments).toBe(1);
    expect(result.netTotalWithoutPayments).toBe(15000);
    expect(result.ordersWithPayments).toBe(0);
  });
});

describe("computeMonthlyTotal", () => {
  it("sums only orders within the given Asia/Saigon month bounds", () => {
    const juneOrder = makeOrder({ id: "j1", created_at: "2026-06-15T10:00:00Z", net_total: 10000 });
    const julyOrder = makeOrder({ id: "j2", created_at: "2026-07-01T00:30:00Z", net_total: 20000 });
    const result = computeMonthlyTotal([juneOrder, julyOrder], "2026-06", "2026-06-01", "2026-06-30");
    expect(result).toEqual({ label: "2026-06", total: 10000, orderCount: 1 });
  });

  it("includes an order at the exact last instant of the month in Saigon time", () => {
    // 2026-06-30T23:59:59.999 Asia/Ho_Chi_Minh == 2026-06-30T16:59:59.999Z
    const order = makeOrder({ created_at: "2026-06-30T16:59:59.999Z", net_total: 5000 });
    const result = computeMonthlyTotal([order], "2026-06", "2026-06-01", "2026-06-30");
    expect(result.orderCount).toBe(1);
  });

  it("excludes an order one millisecond into the next month", () => {
    // 2026-07-01T00:00:00.000 Asia/Ho_Chi_Minh == 2026-06-30T17:00:00.000Z
    const order = makeOrder({ created_at: "2026-06-30T17:00:00.000Z", net_total: 5000 });
    const result = computeMonthlyTotal([order], "2026-06", "2026-06-01", "2026-06-30");
    expect(result.orderCount).toBe(0);
  });
});

describe("meetsMinimumOrderCount", () => {
  it("true when the actual count is at or above the floor", () => {
    expect(meetsMinimumOrderCount(2086, 2086)).toBe(true);
    expect(meetsMinimumOrderCount(2200, 2086)).toBe(true);
  });

  it("false when the actual count falls below the floor -- the trap this guards: a silent 1.000-row truncation", () => {
    expect(meetsMinimumOrderCount(1000, 2086)).toBe(false);
  });
});

// Plan H, task H2 -- line-level arithmetic.

function makeLine(overrides: Partial<RevenueLineDetail> = {}): RevenueLineDetail {
  return {
    order_id: "ord-1",
    order_no: "UCK000001",
    line_no: 1,
    product_name: "Cà phê sữa",
    variant_id: "V1",
    unit_price: 20000,
    qty: 1,
    modifiers: [],
    gross_line_total: 20000,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 0,
    net_line_total: 20000,
    ...overrides,
  };
}

describe("checkLineGrossFormula", () => {
  it("no mismatch: gross = (unit_price + sum(modifier.price * modifier.qty)) * qty, no modifiers", () => {
    const line = makeLine({ unit_price: 20000, qty: 2, modifiers: [], gross_line_total: 40000 });
    const result = checkLineGrossFormula([line]);
    expect(result.mismatches).toEqual([]);
    expect(result.checkedCount).toBe(1);
    expect(result.emptyModifierCount).toBe(1);
  });

  it("no mismatch with modifiers, including a modifier qty above 1 (the same modifier picked twice)", () => {
    // (20000 + 5000*2 + 3000*1) * 2 = (20000 + 13000) * 2 = 66000
    const line = makeLine({
      unit_price: 20000,
      qty: 2,
      modifiers: [{ price: 5000, qty: 2 }, { price: 3000, qty: 1 }],
      gross_line_total: 66000,
    });
    const result = checkLineGrossFormula([line]);
    expect(result.mismatches).toEqual([]);
    expect(result.emptyModifierCount).toBe(0);
  });

  it("reports a mismatch with expected/actual/product name", () => {
    const line = makeLine({ unit_price: 20000, qty: 2, gross_line_total: 45000 }); // should be 40000
    const result = checkLineGrossFormula([line]);
    expect(result.mismatches).toEqual([
      { order_no: "UCK000001", order_id: "ord-1", line_no: 1, product_name: "Cà phê sữa", expected: 40000, actual: 45000 },
    ]);
  });

  // H7's reconstructed line: empty modifiers is correct, not a violation --
  // but a pass here only exercises the (unit_price * qty) term, never the
  // modifier-summing term. The script must say this explicitly, not let a
  // clean run imply the modifier arithmetic was exercised when it wasn't.
  it("a line with an empty modifier list (H7's reconstructed UCK000269 line) passes trivially, counted separately", () => {
    const line = makeLine({
      order_no: "UCK000269",
      product_name: "Trà sữa truyền thống",
      unit_price: 18000,
      qty: 1,
      modifiers: [],
      gross_line_total: 18000,
    });
    const result = checkLineGrossFormula([line]);
    expect(result.mismatches).toEqual([]);
    expect(result.emptyModifierCount).toBe(1);
  });
});

describe("checkLineNetFormula", () => {
  it("no mismatch: net = gross - promo - manual_item - order_alloc", () => {
    const line = makeLine({
      gross_line_total: 50000,
      promo_discount: 5000,
      manual_item_discount: 2000,
      order_discount_allocation: 1000,
      net_line_total: 42000,
    });
    expect(checkLineNetFormula([line])).toEqual([]);
  });

  it("reports a mismatch", () => {
    const line = makeLine({
      gross_line_total: 50000,
      promo_discount: 5000,
      manual_item_discount: 0,
      order_discount_allocation: 0,
      net_line_total: 44000, // should be 45000
    });
    expect(checkLineNetFormula([line])).toEqual([
      { order_no: "UCK000001", order_id: "ord-1", line_no: 1, product_name: "Cà phê sữa", expected: 45000, actual: 44000 },
    ]);
  });
});

describe("checkOrderLineSums", () => {
  it("no mismatch when all four line-column sums equal their header totals", () => {
    const order = makeOrder({
      gross_total: 60000,
      promo_discount_total: 6000,
      manual_item_discount_total: 2000,
      manual_order_discount: 1000,
    });
    const lines: RevenueLineDetail[] = [
      makeLine({ gross_line_total: 40000, promo_discount: 4000, manual_item_discount: 1000, order_discount_allocation: 600 }),
      makeLine({ line_no: 2, gross_line_total: 20000, promo_discount: 2000, manual_item_discount: 1000, order_discount_allocation: 400 }),
    ];
    expect(checkOrderLineSums([order], lines)).toEqual([]);
  });

  it("catches an error that cancels between two discount columns -- the shape H1's net-total check cannot see", () => {
    // promo_discount summed too high by 1000, manual_item_discount summed
    // too low by 1000 -- net (gross - promo - manual_item - alloc) stays
    // correct even though neither individual column is.
    const order = makeOrder({
      gross_total: 40000,
      promo_discount_total: 5000,
      manual_item_discount_total: 1000,
      manual_order_discount: 0,
      net_total: 34000,
    });
    const lines: RevenueLineDetail[] = [
      makeLine({
        gross_line_total: 40000,
        promo_discount: 6000, // header says 5000 -- off by +1000
        manual_item_discount: 0, // header says 1000 -- off by -1000
        order_discount_allocation: 0,
        net_line_total: 34000, // still correct: 40000 - 6000 - 0 - 0 = 34000
      }),
    ];
    const mismatches = checkOrderLineSums([order], lines);
    expect(mismatches).toEqual([
      { order_no: order.order_no, order_id: order.id, field: "promo_discount_total", expected: 6000, actual: 5000 },
      { order_no: order.order_no, order_id: order.id, field: "manual_item_discount_total", expected: 0, actual: 1000 },
    ]);
  });

  it("skips an order with zero lines (nothing to sum), same convention as checkLineSum", () => {
    const order = makeOrder({ id: "ord-269", order_no: "UCK000269" });
    expect(checkOrderLineSums([order], [])).toEqual([]);
  });
});

describe("checkLineSanity", () => {
  it("no violation for a normal line", () => {
    expect(checkLineSanity([makeLine({ qty: 1, unit_price: 20000 })])).toEqual([]);
  });

  it("reports qty <= 0", () => {
    const line = makeLine({ qty: 0 });
    expect(checkLineSanity([line])).toEqual([
      { order_no: line.order_no, order_id: line.order_id, line_no: line.line_no, product_name: line.product_name, qty: 0, unit_price: line.unit_price, reason: "qty 0 is not > 0" },
    ]);
  });

  it("reports unit_price < 0", () => {
    const line = makeLine({ unit_price: -100 });
    expect(checkLineSanity([line])).toEqual([
      { order_no: line.order_no, order_id: line.order_id, line_no: line.line_no, product_name: line.product_name, qty: line.qty, unit_price: -100, reason: "unit_price -100 is not >= 0" },
    ]);
  });

  it("unit_price of exactly 0 is not a violation (>= 0, not > 0)", () => {
    expect(checkLineSanity([makeLine({ unit_price: 0 })])).toEqual([]);
  });
});

// Plan H, task H3 -- promotion discount recomputation.

// PRM-003's real shape (FLAT_PRICE), verified live 2026-08-14/17: sole
// variant VAR-032 overridden to 15000, VAR-031 to 25000.
const FLAT_PRICE_SNAPSHOT_RAW = {
  id: "PRM-003",
  discount_type: "FLAT_PRICE",
  discount_value: 15000,
  applicable_products_json: JSON.stringify({ "VAR-032": 15000, "VAR-031": 25000 }),
  start_date: "2026-05-31T17:00:00.000Z",
  end_date: "2026-06-30T16:59:00.000Z",
};

// PRM-004's real shape (FLAT_VND, the type system's name for the branch
// that has no explicit name in the charging code).
const FLAT_VND_SNAPSHOT_RAW = {
  id: "PRM-004",
  discount_type: "FLAT_VND",
  discount_value: 10000,
  applicable_products_json: JSON.stringify({ "VAR-020": 10000, "VAR-021": 10000 }),
  start_date: "2026-06-30T17:00:00.000Z",
  end_date: "2026-07-15T05:59:00.000Z",
};

const PERCENT_SNAPSHOT_RAW = {
  id: "PRM-999",
  discount_type: "PERCENT",
  discount_value: 20,
  applicable_products_json: JSON.stringify(["VAR-050"]), // array form
  start_date: "2026-01-01T00:00:00.000Z",
  end_date: "2026-12-31T23:59:00.000Z",
};

// A migrated (V1-origin) order's real shape, verified live: extra fields
// (brand_id, created_at, status) and min_order_value/discount_value as
// STRINGS, not numbers.
const MIGRATED_SHAPE_SNAPSHOT_RAW = {
  id: "PRM-003",
  discount_type: "FLAT_PRICE",
  discount_value: "15000",
  applicable_products_json: JSON.stringify({ "VAR-032": 15000 }),
  start_date: "2026-05-31T17:00:00.000Z",
  end_date: "2026-06-30T16:59:00.000Z",
  min_order_value: "0",
  brand_id: "",
  status: "ACTIVE",
  created_at: "2026-06-06T03:33:49.436Z",
};

describe("parsePromotionSnapshot", () => {
  it("returns null for a missing snapshot (null, undefined, or empty object) -- the unrecomputable case", () => {
    expect(parsePromotionSnapshot(null)).toBeNull();
    expect(parsePromotionSnapshot(undefined)).toBeNull();
    expect(parsePromotionSnapshot({})).toBeNull();
  });

  it("parses a native (V2) shape snapshot, minOrderValue null -- the field is not in this shape at all", () => {
    const parsed = parsePromotionSnapshot(FLAT_PRICE_SNAPSHOT_RAW)!;
    expect(parsed.id).toBe("PRM-003");
    expect(parsed.discountType).toBe("FLAT_PRICE");
    expect(parsed.discountValue).toBe(15000);
    expect(parsed.applicable.get("VAR-032")).toBe(15000);
    expect(parsed.applicable.get("VAR-031")).toBe(25000);
    expect(parsed.minOrderValue).toBeNull();
  });

  it("parses a migrated (V1-origin) shape snapshot -- string-typed discount_value/min_order_value coerced to number", () => {
    const parsed = parsePromotionSnapshot(MIGRATED_SHAPE_SNAPSHOT_RAW)!;
    expect(parsed.discountValue).toBe(15000);
    expect(parsed.minOrderValue).toBe(0);
  });

  it("parses the array form of applicable_products_json, override value 0 for every listed variant", () => {
    const parsed = parsePromotionSnapshot(PERCENT_SNAPSHOT_RAW)!;
    expect(parsed.applicable.get("VAR-050")).toBe(0);
  });

  it("a malformed applicable_products_json degrades to an empty map, not null -- matches lib/order-cart.ts's own parseApplicable leniency", () => {
    const parsed = parsePromotionSnapshot({ ...FLAT_PRICE_SNAPSHOT_RAW, applicable_products_json: "{not valid json" })!;
    expect(parsed).not.toBeNull();
    expect(parsed.applicable.size).toBe(0);
  });
});

describe("computeExpectedPromoDiscountForLine", () => {
  it("FLAT_PRICE: per-unit discount on the variant's own price, modifiers untouched", () => {
    const snapshot = parsePromotionSnapshot(FLAT_PRICE_SNAPSHOT_RAW)!;
    // unit_price 18000, target 15000 -> 3000/unit; qty 2 -> 6000; gross 40000 (includes modifiers) -- not capped
    const discount = computeExpectedPromoDiscountForLine(snapshot, "VAR-032", 18000, 2, 40000);
    expect(discount).toBe(6000);
  });

  it("PERCENT: applies to the whole line gross (variant + modifiers), not the variant alone", () => {
    const snapshot = parsePromotionSnapshot(PERCENT_SNAPSHOT_RAW)!;
    // gross 50000 (variant + modifiers), 20% -> 10000
    const discount = computeExpectedPromoDiscountForLine(snapshot, "VAR-050", 40000, 1, 50000);
    expect(discount).toBe(10000);
  });

  it("FLAT_VND: per unit, ignores any per-variant map override and always uses discount_value", () => {
    const snapshot = parsePromotionSnapshot(FLAT_VND_SNAPSHOT_RAW)!;
    // VAR-020's map override is 10000 (same as discount_value here) -- use a
    // different override to prove it is genuinely ignored.
    snapshot.applicable.set("VAR-020", 99); // if this were used, discount would be 99*qty, not 10000*qty
    const discount = computeExpectedPromoDiscountForLine(snapshot, "VAR-020", 30000, 3, 90000);
    expect(discount).toBe(30000); // 10000 * 3, the override was ignored
  });

  it("uncovered variant returns 0", () => {
    const snapshot = parsePromotionSnapshot(FLAT_PRICE_SNAPSHOT_RAW)!;
    expect(computeExpectedPromoDiscountForLine(snapshot, "VAR-999", 18000, 1, 18000)).toBe(0);
  });

  it("caps at gross_line_total (min()), even when the raw formula would exceed it", () => {
    const snapshot = parsePromotionSnapshot(FLAT_VND_SNAPSHOT_RAW)!;
    // discount_value 10000 * qty 5 = 50000, but gross is only 30000
    const discount = computeExpectedPromoDiscountForLine(snapshot, "VAR-020", 6000, 5, 30000);
    expect(discount).toBe(30000);
  });

  it("reproduces production's own `||` quirk: a real 0 override falls through to discount_value, not treated as a genuine 0 target", () => {
    const snapshot = parsePromotionSnapshot(FLAT_PRICE_SNAPSHOT_RAW)!;
    snapshot.applicable.set("VAR-ZERO", 0); // a hypothetical genuine free-target override
    // targetPrice = 0 || 15000 = 15000 (discount_value), not 0 -- matching
    // lib/order-cart.ts's computePromoForLine exactly, not fixed here.
    const discount = computeExpectedPromoDiscountForLine(snapshot, "VAR-ZERO", 18000, 1, 18000);
    expect(discount).toBe(3000); // (18000 - 15000) * 1, NOT (18000 - 0) * 1 = 18000
  });
});

function makePromoOrder(overrides: Partial<RevenuePromoOrder> = {}): RevenuePromoOrder {
  return {
    order_id: "ord-1",
    order_no: "UCK000001",
    created_at: "2026-06-10T10:00:00Z",
    gross_total: 18000,
    applied_promotion_id: "PRM-003",
    promo_discount_total: 3000,
    snapshot: parsePromotionSnapshot(FLAT_PRICE_SNAPSHOT_RAW),
    ...overrides,
  };
}

function makePromoLine(overrides: Partial<RevenuePromoLine> = {}): RevenuePromoLine {
  return {
    order_id: "ord-1",
    order_no: "UCK000001",
    line_no: 1,
    product_name: "Trà sữa truyền thống",
    variant_id: "VAR-032",
    unit_price: 18000,
    qty: 1,
    gross_line_total: 18000,
    promo_discount: 3000,
    ...overrides,
  };
}

describe("checkPromoRecomputation", () => {
  it("no mismatch when the recomputed line and order totals match what was actually charged", () => {
    const order = makePromoOrder();
    const line = makePromoLine();
    const result = checkPromoRecomputation([order], new Map([["ord-1", [line]]]));
    expect(result.lineMismatches).toEqual([]);
    expect(result.orderMismatches).toEqual([]);
    expect(result.recomputedOrderCount).toBe(1);
    expect(result.unrecomputable).toEqual([]);
  });

  it("reports a line-level mismatch", () => {
    const order = makePromoOrder({ promo_discount_total: 5000 });
    const line = makePromoLine({ promo_discount: 5000 }); // should be 3000 (18000-15000)
    const result = checkPromoRecomputation([order], new Map([["ord-1", [line]]]));
    expect(result.lineMismatches).toEqual([
      { order_no: "UCK000001", order_id: "ord-1", line_no: 1, product_name: "Trà sữa truyền thống", expected: 3000, actual: 5000 },
    ]);
  });

  it("an order with applied_promotion_id but an empty snapshot is unrecomputable, not silently passed", () => {
    const order = makePromoOrder({ snapshot: null });
    const result = checkPromoRecomputation([order], new Map());
    expect(result.recomputedOrderCount).toBe(0);
    expect(result.unrecomputable).toEqual([
      { order_no: "UCK000001", order_id: "ord-1", reason: "applied_promotion_id set but applied_promotion_snapshot_json is empty" },
    ]);
  });

  it("an order with no applied_promotion_id is skipped entirely (not unrecomputable, not a mismatch)", () => {
    const order = makePromoOrder({ applied_promotion_id: "", promo_discount_total: 0, snapshot: null });
    const result = checkPromoRecomputation([order], new Map());
    expect(result.recomputedOrderCount).toBe(0);
    expect(result.unrecomputable).toEqual([]);
  });
});

describe("checkPromoEligibility", () => {
  it("no violation when the order date falls inside the window and min_order_value (when present) is satisfied", () => {
    expect(checkPromoEligibility([makePromoOrder()])).toEqual([]);
  });

  it("flags an order dated before the promotion's own start_date", () => {
    const order = makePromoOrder({ created_at: "2026-05-01T00:00:00Z" });
    const violations = checkPromoEligibility([order]);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("before the promotion's own start_date");
  });

  it("flags an order dated after the promotion's own end_date", () => {
    const order = makePromoOrder({ created_at: "2026-07-01T00:00:00Z" });
    const violations = checkPromoEligibility([order]);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toContain("after the promotion's own end_date");
  });

  it("flags gross_total below min_order_value when the snapshot shape carries that field (migrated orders)", () => {
    const order = makePromoOrder({ gross_total: 5000, snapshot: parsePromotionSnapshot({ ...MIGRATED_SHAPE_SNAPSHOT_RAW, min_order_value: "10000" }) });
    const violations = checkPromoEligibility([order]);
    expect(violations.some(v => v.reason.includes("min_order_value"))).toBe(true);
  });

  it("does not check min_order_value when the snapshot shape does not carry it (native orders) -- there is nothing to check against", () => {
    const order = makePromoOrder({ gross_total: 1 }); // native FLAT_PRICE_SNAPSHOT_RAW has no min_order_value
    expect(checkPromoEligibility([order])).toEqual([]);
  });

  it("skips an unrecomputable order (no snapshot)", () => {
    const order = makePromoOrder({ snapshot: null });
    expect(checkPromoEligibility([order])).toEqual([]);
  });
});

describe("checkLineVariantCoverage", () => {
  it("no violation when the discounted line's variant is covered", () => {
    const order = makePromoOrder();
    const line = makePromoLine();
    expect(checkLineVariantCoverage([order], [line])).toEqual([]);
  });

  it("flags a line carrying promo_discount whose variant the promotion does not cover", () => {
    const order = makePromoOrder();
    const line = makePromoLine({ variant_id: "VAR-999", promo_discount: 3000 });
    expect(checkLineVariantCoverage([order], [line])).toEqual([
      { order_no: "UCK000001", order_id: "ord-1", line_no: 1, product_name: "Trà sữa truyền thống", variant_id: "VAR-999", promo_discount: 3000 },
    ]);
  });

  it("a line with zero promo_discount is never flagged, even on an uncovered variant", () => {
    const order = makePromoOrder();
    const line = makePromoLine({ variant_id: "VAR-999", promo_discount: 0 });
    expect(checkLineVariantCoverage([order], [line])).toEqual([]);
  });

  it("skips lines belonging to an unrecomputable order", () => {
    const order = makePromoOrder({ snapshot: null });
    const line = makePromoLine({ variant_id: "VAR-999", promo_discount: 3000 });
    expect(checkLineVariantCoverage([order], [line])).toEqual([]);
  });
});

describe("checkPromoAsymmetry", () => {
  it("no case for a normal order (promo id + discount, or neither)", () => {
    expect(checkPromoAsymmetry([
      { order_id: "1", order_no: "A", applied_promotion_id: "PRM-003", promo_discount_total: 3000 },
      { order_id: "2", order_no: "B", applied_promotion_id: "", promo_discount_total: 0 },
    ])).toEqual([]);
  });

  it("flags applied_promotion_id set but promo_discount_total 0", () => {
    const cases = checkPromoAsymmetry([{ order_id: "1", order_no: "A", applied_promotion_id: "PRM-003", promo_discount_total: 0 }]);
    expect(cases).toEqual([{ order_no: "A", order_id: "1", promo_discount_total: 0, shape: "promo_id_set_zero_discount" }]);
  });

  it("flags promo_discount_total > 0 but no applied_promotion_id", () => {
    const cases = checkPromoAsymmetry([{ order_id: "1", order_no: "A", applied_promotion_id: "", promo_discount_total: 5000 }]);
    expect(cases).toEqual([{ order_no: "A", order_id: "1", promo_discount_total: 5000, shape: "discount_set_no_promo_id" }]);
  });
});
