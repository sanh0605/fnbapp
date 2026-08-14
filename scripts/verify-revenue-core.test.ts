import { describe, it, expect } from "vitest";
import {
  checkHeaderArithmetic,
  checkLineSum,
  checkNoSupersededCompleted,
  checkPayments,
  computeMonthlyTotal,
  meetsMinimumOrderCount,
  type RevenueOrder,
  type RevenueLine,
  type RevenuePayment,
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
