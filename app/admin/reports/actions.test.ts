import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sheets_db", () => ({
  findAllNoCache: vi.fn(),
  findAll: vi.fn(),
}));

import { findAllNoCache, findAll } from "@/lib/sheets_db";
import { getPnLDataV2 } from "./actions";
import { makeSuaDauStandaloneOrder, makeUCK000094MigratedOrder } from "@/lib/__tests__/fixtures";

describe("getPnLDataV2", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns empty result when no orders match filters", async () => {
    (findAllNoCache as any).mockResolvedValue([]);
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({ startDate: "2026-06-19", endDate: "2026-06-19" });

    expect(result.totalRevenue).toBe(0);
    expect(result.totalCOGS).toBe(0);
    expect(result.orderCount).toBe(0);
    expect(result.productProfitAnalysis).toEqual([]);
  });

  it("aggregates single Sữa Dâu order correctly", async () => {
    const suaDau = makeSuaDauStandaloneOrder();
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [suaDau.order];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});

    expect(result.orderCount).toBe(1);
    expect(result.totalRevenue).toBe(25000);
    expect(result.productProfitAnalysis.length).toBeGreaterThan(0);
    const suaDauRow = result.productProfitAnalysis.find(p => p.product_id === "PROD-024");
    expect(suaDauRow?.revenue).toBe(25000);
  });

  it("filters by date range", async () => {
    const order1 = makeSuaDauStandaloneOrder(); // created_at 2026-06-12
    const order2 = makeUCK000094MigratedOrder(); // created_at 2026-06-12
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [order1.order, order2.order];
      if (sheet === "Order_Lines_V2") return [...order1.lines, ...order2.lines];
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    // Date range that excludes both orders
    const result = await getPnLDataV2({ startDate: "2026-01-01", endDate: "2026-01-31" });
    expect(result.orderCount).toBe(0);
  });

  it("filters by brandId", async () => {
    const suaDau = makeSuaDauStandaloneOrder(); // brand_id BR-002
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [suaDau.order];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({ brandId: "BR-999" }); // wrong brand
    expect(result.orderCount).toBe(0);
  });

  it("filters by categoryId (via product_snapshot)", async () => {
    const suaDau = makeSuaDauStandaloneOrder();
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [suaDau.order];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({ categoryId: "CAT-NONEXISTENT" });
    expect(result.orderCount).toBe(1); // order still counted
    expect(result.productProfitAnalysis.length).toBe(0); // but no products match
  });

  it("excludes SUPERSEDED orders", async () => {
    const suaDau = makeSuaDauStandaloneOrder();
    const superseded = { ...suaDau.order, status: "SUPERSEDED", superseded_by: "ord-v2-mock" };
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [superseded];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});
    expect(result.orderCount).toBe(0);
  });

  it("excludes VOIDED orders", async () => {
    const suaDau = makeSuaDauStandaloneOrder();
    const voided = { ...suaDau.order, status: "VOIDED" };
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [voided];
      if (sheet === "Order_Lines_V2") return suaDau.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});
    expect(result.orderCount).toBe(0);
  });

  it("UCK000094: totalRevenue = 161000 (sum of line nets)", async () => {
    const uck = makeUCK000094MigratedOrder();
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [uck.order];
      if (sheet === "Order_Lines_V2") return uck.lines;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});
    expect(result.totalRevenue).toBe(161000);
  });

  it("BUG-FIX: per-variant COGS attribution (no double-counting across variants)", async () => {
    const orderId = "ord-multi-variant";
    const baseTs = "2026-06-15T10:00:00.000Z";
    const order = {
      id: orderId,
      order_no: "MULTI-001",
      brand_id: "BR-002",
      status: "COMPLETED",
      version: 1,
      parent_order_id: "",
      superseded_by: "",
      created_at: baseTs,
      created_by_id: "U",
      created_by_name: "Test",
      completed_at: baseTs,
      voided_at: "",
      voided_by_id: "",
      void_reason: "",
      currency: "VND",
      gross_total: 30000,
      promo_discount_total: 0,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 30000,
      applied_promotion_id: "",
      applied_promotion_snapshot_json: "",
      pos_snapshot_json: "{}",
      payment_method: "CASH",
      payment_ref: "",
      migration_notes: "",
    };

    const lineA = {
      id: "ol-a",
      order_id: orderId,
      line_no: 1,
      product_id: "PROD-MULTI",
      product_snapshot_json: JSON.stringify({ id: "PROD-MULTI", name: "Multi Variant Drink", category_id: "CAT-X", category_name: "X" }),
      variant_id: "VAR-A",
      variant_snapshot_json: JSON.stringify({ id: "VAR-A", size_name: "500ml", price: 15000 }),
      qty: 1,
      unit_price: 15000,
      modifiers_snapshot_json: "[]",
      gross_line_total: 15000,
      promo_discount: 0,
      manual_item_discount: 0,
      order_discount_allocation: 0,
      net_line_total: 15000,
      cost_at_sale: 5000,
      recipe_snapshot_json: "{}",
      promo_discount_reason: "",
      manual_discount_reason: "",
    };
    const lineB = {
      ...lineA,
      id: "ol-b",
      line_no: 2,
      variant_id: "VAR-B",
      variant_snapshot_json: JSON.stringify({ id: "VAR-B", size_name: "700ml", price: 15000 }),
      gross_line_total: 15000,
      net_line_total: 15000,
      cost_at_sale: 7000,
    };

    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [order];
      if (sheet === "Order_Lines_V2") return [lineA, lineB];
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});

    const multiRows = result.productProfitAnalysis.filter(p => p.product_id === "PROD-MULTI");
    expect(multiRows.length).toBe(2);

    const rowA = multiRows.find(r => r.variant_id === "VAR-A");
    const rowB = multiRows.find(r => r.variant_id === "VAR-B");

    expect(rowA?.cogs).toBe(5000);
    expect(rowB?.cogs).toBe(7000);

    const totalMultiCogs = multiRows.reduce((s, r) => s + r.cogs, 0);
    expect(totalMultiCogs).toBe(12000);

    expect(rowA?.marginPct).toBeCloseTo(66.67, 1);
    expect(rowB?.marginPct).toBeCloseTo(53.33, 1);
  });
});
