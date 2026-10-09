// lib/reports/sales-totals.test.ts
import { describe, expect, it } from "vitest";
import { computeSalesTotals } from "./sales-totals";

describe("computeSalesTotals -- the three cards of Doanh số", () => {
  const orders = [{ id: "A", net_total: 50000 }, { id: "B", net_total: 30000 }, { id: "C", net_total: 20000 }];
  it("without a category: every order", () => {
    expect(computeSalesTotals(orders, null)).toEqual({ totalRevenue: 100000, totalOrders: 3, avgOrderValue: 100000 / 3 });
  });
  it("with a category: only its lines, orders counted once", () => {
    const lines = [{ order_id: "A", net_line_total: 25000 }, { order_id: "A", net_line_total: 10000 }, { order_id: "C", net_line_total: 20000 }];
    expect(computeSalesTotals(orders, lines)).toEqual({ totalRevenue: 55000, totalOrders: 2, avgOrderValue: 27500 });
  });
  it("no orders: zeros, no division by zero", () => {
    expect(computeSalesTotals([], null)).toEqual({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
  });
});
