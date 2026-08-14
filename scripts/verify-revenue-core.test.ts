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
  type RevenueOrder,
  type RevenueLine,
  type RevenuePayment,
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
