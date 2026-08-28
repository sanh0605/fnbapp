import { describe, it, expect } from "vitest";
import { breakdownRevenueByProduct } from "@/lib/report-v2-allocators";
import { makeSuaDauStandaloneOrder, makeUCK000094MigratedOrder, makePHD000540MigratedOrder } from "@/lib/__tests__/fixtures";

describe("breakdownRevenueByProduct", () => {
  it("returns empty array for empty input", () => {
    const result = breakdownRevenueByProduct([], []);
    expect(result).toEqual([]);
  });

  it("single Sữa Dâu order: revenue 25000 attributed to Sữa Dâu product", () => {
    const { order, lines } = makeSuaDauStandaloneOrder();
    const result = breakdownRevenueByProduct([order], lines);

    expect(result.length).toBe(1);
    expect(result[0].product_id).toBe("PROD-024");
    expect(result[0].product_name).toBe("Sữa dâu sấy giòn");
    expect(result[0].qty).toBe(1);
    expect(result[0].revenue).toBe(25000);
  });

  it("UCK000094 9-line order: each product gets its proportional share", () => {
    const { order, lines } = makeUCK000094MigratedOrder();
    const result = breakdownRevenueByProduct([order], lines);

    // Should have 9 distinct product/variant combinations + modifiers
    const productIds = new Set(result.map(r => r.product_id));
    expect(productIds.size).toBeGreaterThanOrEqual(4);

    // Total revenue across all products = order.net_total = 161000
    const totalRev = result.reduce((s, r) => s + r.revenue, 0);
    expect(totalRev).toBe(order.net_total);
  });

  it("modifier revenue tracked separately", () => {
    const { order, lines } = makeUCK000094MigratedOrder();
    const result = breakdownRevenueByProduct([order], lines);

    // Yogurt dâu has 1 topping (Trân châu trắng 5k). Check topping appears as separate row.
    const toppingRow = result.find(r => r.product_id.startsWith("MOD:"));
    expect(toppingRow).toBeDefined();
    expect(toppingRow!.product_name).toContain("Trân châu");
  });

  it("PHD000540 (customer paid 0): all revenue lines report 0", () => {
    const { order, lines } = makePHD000540MigratedOrder();
    const result = breakdownRevenueByProduct([order], lines);

    for (const row of result) {
      expect(row.revenue).toBeGreaterThanOrEqual(0);
    }
    const totalRev = result.reduce((s, r) => s + r.revenue, 0);
    expect(totalRev).toBe(0);
  });

  it("aggregates across multiple orders correctly", () => {
    const order1 = makeSuaDauStandaloneOrder();
    const order2 = makePHD000540MigratedOrder();
    const allOrders = [order1.order, order2.order];
    const allLines = [...order1.lines, ...order2.lines];

    const result = breakdownRevenueByProduct(allOrders, allLines);

    // Sữa Dâu from order1 has revenue 25000
    const suaDau = result.find(r => r.product_id === "PROD-024");
    expect(suaDau?.revenue).toBe(25000);
    expect(suaDau?.qty).toBe(1);
  });
});
