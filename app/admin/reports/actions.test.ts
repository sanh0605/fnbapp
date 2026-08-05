import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireAdmin: requireAdminMock }));

vi.mock("@/lib/sheets_db", () => ({
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  findAllWhereInBatches: vi.fn(),
  findAll: vi.fn(),
}));

import {
  findAll,
  findAllNoCache,
  findAllWhere,
  findAllWhereInBatches,
} from "@/lib/sheets_db";
import { getHourlyHeatmapV2, getPnLDataV2, getSalesDataV2, computePeriodIssuedValue } from "./actions";
import { makeSuaDauStandaloneOrder, makeUCK000094MigratedOrder } from "@/lib/__tests__/fixtures";
import type { Purchase, Issue } from "@/lib/issue-costing";

beforeEach(() => {
  requireAdminMock.mockResolvedValue({
    ok: true,
    actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
  });
});

describe("computePeriodIssuedValue", () => {
  // Plan C Task 2: computeIssueCosting returns a cumulative total, not a
  // per-period one. A month's figure is the difference of two full replays
  // (through-end minus before-start), both fed the SAME complete purchase
  // set -- passing a narrower purchase set to either run would silently
  // invalidate the subtraction while still returning a plausible number.
  const purchases: Purchase[] = [
    { purchased_item_id: "SPM-X", at: "2026-06-01T00:00:00Z", base_quantity: 10, subtotal: 100 },
    { purchased_item_id: "SPM-X", at: "2026-07-10T00:00:00Z", base_quantity: 10, subtotal: 140 },
  ];

  it("returns only the period's own contribution, not the running total", () => {
    const issues: Issue[] = [
      { purchased_item_id: "SPM-X", at: "2026-06-15T00:00:00Z", base_quantity: 2, source: "STOCKTAKE" },
      { purchased_item_id: "SPM-X", at: "2026-07-20T00:00:00Z", base_quantity: 3, source: "STOCKTAKE" },
    ];

    // June alone: 2 units at 10.00/unit (only the first purchase exists yet) = 20.
    const june = computePeriodIssuedValue(
      purchases,
      issues,
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-06-30T23:59:59.999Z"),
    );
    expect(june).toBeCloseTo(20, 6);

    // July alone: stock going in is 8 (=80) + 10 (=140) = 18 units / 220 ->
    // avg 12.2222..., issuing 3 = 36.6666... This is NOT the cumulative
    // total through July (20 + 36.6666... = 56.6666...) -- proving the
    // subtraction isolates July rather than accumulating June into it.
    const july = computePeriodIssuedValue(
      purchases,
      issues,
      new Date("2026-07-01T00:00:00Z"),
      new Date("2026-07-31T23:59:59.999Z"),
    );
    expect(july).toBeCloseTo(36.666667, 4);
  });

  it("months sum to exactly one whole-period run -- only meaningful with real non-zero issues", () => {
    // Before the first stocktake, every period is 0đ and 0 === 0 proves
    // nothing about the subtraction being correct. This fixture uses three
    // months of real, distinct, non-zero issues so the invariant actually
    // gets exercised.
    const issues: Issue[] = [
      { purchased_item_id: "SPM-X", at: "2026-06-10T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" },
      { purchased_item_id: "SPM-X", at: "2026-07-15T00:00:00Z", base_quantity: 4, source: "STOCKTAKE" },
      { purchased_item_id: "SPM-X", at: "2026-08-05T00:00:00Z", base_quantity: 2, source: "STOCKTAKE" },
    ];
    expect(issues.every(i => i.base_quantity > 0)).toBe(true);

    const june = computePeriodIssuedValue(purchases, issues, new Date("2026-06-01T00:00:00Z"), new Date("2026-06-30T23:59:59.999Z"));
    const july = computePeriodIssuedValue(purchases, issues, new Date("2026-07-01T00:00:00Z"), new Date("2026-07-31T23:59:59.999Z"));
    const august = computePeriodIssuedValue(purchases, issues, new Date("2026-08-01T00:00:00Z"), new Date("2026-08-31T23:59:59.999Z"));
    const wholePeriod = computePeriodIssuedValue(purchases, issues, null, new Date("2026-08-31T23:59:59.999Z"));

    expect(june + july + august).toBeCloseTo(wholePeriod, 9);
    // Guard against the false-green shape: if this were 0, the assertion
    // above would pass trivially without proving anything.
    expect(wholePeriod).toBeGreaterThan(0);
  });

  it("returns 0 when no issues exist yet, and says so honestly rather than throwing", () => {
    const result = computePeriodIssuedValue(purchases, [], new Date("2026-06-01T00:00:00Z"), new Date("2026-06-30T23:59:59.999Z"));
    expect(result).toBe(0);
  });
});

describe("getPnLDataV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (findAllWhere as any).mockImplementation((sheet: string) => (
      (findAllNoCache as any)(sheet)
    ));
    (findAllWhereInBatches as any).mockImplementation((sheet: string) => (
      (findAllNoCache as any)(sheet)
    ));
  });

  it("rejects an unauthenticated report read before loading data", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });

    await expect(getPnLDataV2()).rejects.toThrow("Yêu cầu đăng nhập");
    expect(findAllWhere).not.toHaveBeenCalled();
    expect(findAllNoCache).not.toHaveBeenCalled();
    expect(findAll).not.toHaveBeenCalled();
  });

  it("returns empty result when no orders match filters", async () => {
    (findAllNoCache as any).mockResolvedValue([]);
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({ startDate: "2026-06-19", endDate: "2026-06-19" });

    expect(result.totalRevenue).toBe(0);
    expect(result.totalCOGS).toBe(0);
    expect(result.orderCount).toBe(0);
    expect(result.productProfitAnalysis).toEqual([]);
    expect(findAllWhere).toHaveBeenCalledWith("Orders_V2", {
      gte: { created_at: new Date("2026-06-18T17:00:00.000Z") },
      lte: { created_at: new Date("2026-06-19T16:59:59.999Z") },
      eq: { status: "COMPLETED" },
    });
  });

  it("loads order lines only for the server-filtered report orders", async () => {
    const fixture = makeSuaDauStandaloneOrder();
    (findAllWhere as any).mockResolvedValue([fixture.order]);
    (findAllWhereInBatches as any).mockResolvedValue(fixture.lines);
    (findAllNoCache as any).mockImplementation((sheet: string) => (
      sheet === "Stock_Ledger" ? [] : []
    ));
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(findAllWhereInBatches).toHaveBeenCalledWith(
      "Order_Lines_V2",
      "order_id",
      [fixture.order.id],
    );
    expect(findAllNoCache).not.toHaveBeenCalledWith("Order_Lines_V2");
    expect(result.totalCOGS).toBe(fixture.lines[0].cost_at_sale);
  });

  it("rounds totalCOGS UP at the display boundary, from the issue-costing engine's exact value (owner rule 2026-07-30)", async () => {
    const fixture = makeSuaDauStandaloneOrder();
    (findAllWhere as any).mockResolvedValue([fixture.order]);
    (findAllWhereInBatches as any).mockResolvedValue(fixture.lines);
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Orders") {
        return [{ id: "PO-001", status: "COMPLETED", transaction_date: "2026-06-01T00:00:00Z" }];
      }
      if (sheet === "Purchase_Order_Lines") {
        return [{ purchase_order_id: "PO-001", purchased_item_id: "SPM-X", base_quantity: 3, subtotal: 14998 }];
      }
      if (sheet === "Stock_Issues") {
        return [{ purchased_item_id: "SPM-X", issued_at: "2026-06-15T00:00:00Z", base_quantity: 1, source: "STOCKTAKE" }];
      }
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    // 14998 / 3 = 4999.333...; issuing 1 -> Math.ceil(4999.333...) = 5000, not Math.round's 4999.
    expect(result.totalCOGS).toBe(5000);
    expect(result.grossProfit).toBe(result.totalRevenue - 5000);
    // Per-product cogs is retired by design (spec section 9) -- always 0,
    // never a share of totalCOGS.
    expect(result.productProfitAnalysis[0].cogs).toBe(0);
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
    expect(result.orderCount).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalCOGS).toBe(0);
    expect(result.productProfitAnalysis.length).toBe(0); // but no products match
  });

  it("with categoryId, totals include only matching category lines", async () => {
    const orderId = "ord-category-mixed";
    const createdAt = "2026-06-15T10:00:00.000Z";
    const order = {
      id: orderId,
      order_no: "CAT-001",
      brand_id: "BR-002",
      status: "COMPLETED",
      version: 1,
      parent_order_id: "",
      superseded_by: "",
      created_at: createdAt,
      created_by_id: "U",
      created_by_name: "Test",
      completed_at: createdAt,
      voided_at: "",
      voided_by_id: "",
      void_reason: "",
      currency: "VND",
      gross_total: 50000,
      promo_discount_total: 0,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 50000,
      applied_promotion_id: "",
      applied_promotion_snapshot_json: "",
      pos_snapshot_json: "{}",
      payment_method: "CASH",
      payment_ref: "",
      migration_notes: "",
    };
    const drinkLine = {
      id: "ol-drink",
      order_id: orderId,
      line_no: 1,
      product_id: "PROD-DRINK",
      product_snapshot_json: JSON.stringify({ id: "PROD-DRINK", name: "Drink", category_id: "CAT-DRINK", category_name: "Drink" }),
      variant_id: "VAR-DRINK",
      variant_snapshot_json: JSON.stringify({ id: "VAR-DRINK", size_name: "500ml", price: 30000 }),
      qty: 1,
      unit_price: 30000,
      modifiers_snapshot_json: "[]",
      gross_line_total: 30000,
      promo_discount: 0,
      manual_item_discount: 0,
      order_discount_allocation: 0,
      net_line_total: 30000,
      cost_at_sale: 12000,
      recipe_snapshot_json: "{}",
      promo_discount_reason: "",
      manual_discount_reason: "",
    };
    const foodLine = {
      ...drinkLine,
      id: "ol-food",
      line_no: 2,
      product_id: "PROD-FOOD",
      product_snapshot_json: JSON.stringify({ id: "PROD-FOOD", name: "Food", category_id: "CAT-FOOD", category_name: "Food" }),
      variant_id: "VAR-FOOD",
      variant_snapshot_json: JSON.stringify({ id: "VAR-FOOD", size_name: "Default", price: 20000 }),
      gross_line_total: 20000,
      net_line_total: 20000,
      cost_at_sale: 7000,
    };

    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [order];
      if (sheet === "Order_Lines_V2") return [drinkLine, foodLine];
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({ categoryId: "CAT-DRINK" });

    expect(result.orderCount).toBe(1);
    expect(result.totalRevenue).toBe(30000);
    // categoryId scopes revenue (only matching lines belong in the report)
    // but not cost: issue-based COGS is a whole-period figure with no path
    // to attribute a purchased item to one product category. No purchase/
    // issue fixtures exist in this test, so it reads 0, not a category
    // share of cost_at_sale.
    expect(result.totalCOGS).toBe(0);
    expect(result.grossProfit).toBe(30000);
    expect(result.productProfitAnalysis.map(row => row.product_id)).toEqual(["PROD-DRINK"]);
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

    // Per-product cost/margin retired by design (spec section 9) -- always
    // 0 / revenue / 100%, never a MAC-derived split. The double-counting
    // bug this test used to guard (both variants sharing one ledger-index
    // MAC weight) is now structurally impossible: there is no split left to
    // double-count. What still matters, and is still asserted above, is
    // that the two variants stay two separate rows rather than merging.
    expect(rowA?.cogs).toBe(0);
    expect(rowB?.cogs).toBe(0);
    expect(rowA?.grossProfit).toBe(15000);
    expect(rowB?.grossProfit).toBe(15000);
    expect(rowA?.marginPct).toBe(100);
    expect(rowB?.marginPct).toBe(100);
  });

  it("splits COGS between product and topping rows without double-counting", async () => {
    const orderId = "ord-with-topping";
    const createdAt = "2026-06-15T10:00:00.000Z";
    const order = {
      id: orderId,
      order_no: "TOP-001",
      brand_id: "BR-002",
      status: "COMPLETED",
      version: 1,
      parent_order_id: "",
      superseded_by: "",
      created_at: createdAt,
      created_by_id: "U",
      created_by_name: "Test",
      completed_at: createdAt,
      voided_at: "",
      voided_by_id: "",
      void_reason: "",
      currency: "VND",
      gross_total: 25000,
      promo_discount_total: 0,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 25000,
      applied_promotion_id: "",
      applied_promotion_snapshot_json: "",
      pos_snapshot_json: "{}",
      payment_method: "CASH",
      payment_ref: "",
      migration_notes: "",
    };
    const line = {
      id: "ol-top",
      order_id: orderId,
      line_no: 1,
      product_id: "PROD-COFFEE",
      product_snapshot_json: JSON.stringify({ id: "PROD-COFFEE", name: "Coffee", category_id: "CAT-X", category_name: "X" }),
      variant_id: "VAR-COFFEE",
      variant_snapshot_json: JSON.stringify({ id: "VAR-COFFEE", size_name: "500ml", price: 20000 }),
      qty: 1,
      unit_price: 20000,
      modifiers_snapshot_json: JSON.stringify([{ id: "MOD-PEARL", name: "Pearl", price: 5000, qty: 1 }]),
      gross_line_total: 25000,
      promo_discount: 0,
      manual_item_discount: 0,
      order_discount_allocation: 0,
      net_line_total: 25000,
      cost_at_sale: 5000,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-COFFEE",
          ingredients: [{ ingredient_id: "ING-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 100 }],
        },
        modifiers: [{
          modifier_id: "MOD-PEARL",
          modifier_name: "Pearl",
          recipe: {
            target_type: "MODIFIER",
            target_id: "MOD-PEARL",
            ingredients: [{ ingredient_id: "ING-PEARL", ingredient_type: "BASE_INGREDIENT", quantity: 20 }],
          },
        }],
      }),
      promo_discount_reason: "",
      manual_discount_reason: "",
    };
    const ledger = [
      { id: "po-milk", transaction_type: "PO_RECEIPT", item_reference: "ING-MILK", quantity_change: 1000, unit_cost: 30, created_at: "2026-06-01T00:00:00.000Z" },
      { id: "po-pearl", transaction_type: "PO_RECEIPT", item_reference: "ING-PEARL", quantity_change: 1000, unit_cost: 100, created_at: "2026-06-01T00:00:00.000Z" },
    ];

    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [order];
      if (sheet === "Order_Lines_V2") return [line];
      if (sheet === "Stock_Ledger") return ledger;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    const result = await getPnLDataV2({});
    const productRow = result.productProfitAnalysis.find(p => p.product_id === "PROD-COFFEE");
    const toppingRow = result.productProfitAnalysis.find(p => p.product_id === "MOD:MOD-PEARL");

    // No purchase/issue fixtures in this test -> totalCOGS reads 0.
    expect(result.totalCOGS).toBe(0);
    // Per-product/topping cost retired by design (spec section 9) -- there
    // is no MAC split left to prove correct. What still matters, and is
    // still asserted here, is that the topping renders as its own row
    // rather than merging into the product's.
    expect(productRow).toBeDefined();
    expect(toppingRow).toBeDefined();
    expect(productRow?.cogs).toBe(0);
    expect(toppingRow?.cogs).toBe(0);
  });

  // "splits product and topping COGS by MAC weights instead of FIFO order"
  // deleted (Plan C Task 2): its sole purpose was proving the per-product
  // split used weighted-average batches rather than FIFO consumption order.
  // There is no split left to get right either way -- the previous test
  // ("splits COGS between product and topping rows...") already covers the
  // one structural fact that still applies, that a topping stays its own
  // row rather than merging into the product's.

  it("merges duplicate P&L topping rows into the latest active modifier id", async () => {
    const createdAt = "2026-06-15T10:00:00.000Z";
    const order = {
      id: "ord-pnl-dau-say",
      order_no: "PNL-DAU-001",
      brand_id: "BR-002",
      status: "COMPLETED",
      version: 1,
      parent_order_id: "",
      superseded_by: "",
      created_at: createdAt,
      created_by_id: "U",
      created_by_name: "Test",
      completed_at: createdAt,
      voided_at: "",
      voided_by_id: "",
      void_reason: "",
      currency: "VND",
      gross_total: 20000,
      promo_discount_total: 0,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 20000,
      applied_promotion_id: "",
      applied_promotion_snapshot_json: "",
      pos_snapshot_json: "{}",
      payment_method: "CASH",
      payment_ref: "",
      migration_notes: "",
    };
    const baseLine = {
      order_id: order.id,
      product_id: "PROD-COFFEE",
      product_snapshot_json: JSON.stringify({ id: "PROD-COFFEE", name: "Coffee", category_id: "CAT-X", category_name: "X" }),
      variant_id: "VAR-COFFEE",
      variant_snapshot_json: JSON.stringify({ id: "VAR-COFFEE", size_name: "500ml", price: 0 }),
      qty: 1,
      unit_price: 0,
      gross_line_total: 10000,
      promo_discount: 0,
      manual_item_discount: 0,
      order_discount_allocation: 0,
      net_line_total: 10000,
      cost_at_sale: 4754,
      recipe_snapshot_json: JSON.stringify({
        variant: { target_type: "PRODUCT_VARIANT", target_id: "VAR-COFFEE", ingredients: [] },
        modifiers: [{
          modifier_id: "MOD-OLD-DAU",
          modifier_name: "Dâu sấy",
          recipe: {
            target_type: "MODIFIER",
            target_id: "MOD-OLD-DAU",
            ingredients: [{ ingredient_id: "ING-DAU", ingredient_type: "BASE_INGREDIENT", quantity: 1 }],
          },
        }],
      }),
      promo_discount_reason: "",
      manual_discount_reason: "",
    };
    const oldLine = {
      ...baseLine,
      id: "ol-pnl-old-dau",
      line_no: 1,
      modifiers_snapshot_json: JSON.stringify([{ id: "MOD-OLD-DAU", name: "Dâu sấy", price: 10000, qty: 1 }]),
    };
    const newLine = {
      ...baseLine,
      id: "ol-pnl-new-dau",
      line_no: 2,
      recipe_snapshot_json: JSON.stringify({
        variant: { target_type: "PRODUCT_VARIANT", target_id: "VAR-COFFEE", ingredients: [] },
        modifiers: [{
          modifier_id: "MOD-NEW-DAU",
          modifier_name: "Dâu sấy",
          recipe: {
            target_type: "MODIFIER",
            target_id: "MOD-NEW-DAU",
            ingredients: [{ ingredient_id: "ING-DAU", ingredient_type: "BASE_INGREDIENT", quantity: 1 }],
          },
        }],
      }),
      modifiers_snapshot_json: JSON.stringify([{ id: "MOD-NEW-DAU", name: "Dâu sấy", price: 10000, qty: 1 }]),
    };
    const modifiers = [
      { id: "MOD-OLD-DAU", name: "Dâu sấy", status: "DELETED", created_at: "2026-06-01T00:00:00.000Z" },
      { id: "MOD-NEW-DAU", name: "Dâu sấy", status: "ACTIVE", created_at: "2026-06-20T00:00:00.000Z" },
    ];

    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [order];
      if (sheet === "Order_Lines_V2") return [oldLine, newLine];
      if (sheet === "Stock_Ledger") return [
        { id: "po-dau", transaction_type: "PO_RECEIPT", item_reference: "ING-DAU", quantity_change: 10, unit_cost: 4754, created_at: "2026-06-01T00:00:00.000Z" },
      ];
      return [];
    });
    (findAll as any).mockImplementation((sheet: string) => {
      if (sheet === "Modifiers") return modifiers;
      return [];
    });

    const result = await getPnLDataV2({});
    const dauSayRows = result.productProfitAnalysis.filter(row => row.product_name === "Dâu sấy");

    expect(dauSayRows).toHaveLength(1);
    expect(dauSayRows[0]).toMatchObject({
      product_id: "MOD:MOD-NEW-DAU",
      qty: 2,
      revenue: 20000,
      // Per-topping cost retired by design (spec section 9) -- always 0.
      // The fact still worth protecting here is modifier-id canonicalization
      // (both lines merge into one row), unrelated to cost.
      cogs: 0,
    });
  });
});

describe("getSalesDataV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (findAllWhere as any).mockImplementation((sheet: string) => (
      (findAllNoCache as any)(sheet)
    ));
    (findAllWhereInBatches as any).mockImplementation((sheet: string) => (
      (findAllNoCache as any)(sheet)
    ));
  });

  it("merges historical duplicate toppings into the latest active modifier id", async () => {
    const createdAt = "2026-06-15T10:00:00.000Z";
    const order = {
      id: "ord-strawberry-topping",
      order_no: "TOP-DAU-001",
      brand_id: "BR-002",
      status: "COMPLETED",
      version: 1,
      parent_order_id: "",
      superseded_by: "",
      created_at: createdAt,
      created_by_id: "U",
      created_by_name: "Test",
      completed_at: createdAt,
      voided_at: "",
      voided_by_id: "",
      void_reason: "",
      currency: "VND",
      gross_total: 20000,
      promo_discount_total: 0,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 20000,
      applied_promotion_id: "",
      applied_promotion_snapshot_json: "",
      pos_snapshot_json: "{}",
      payment_method: "CASH",
      payment_ref: "",
      migration_notes: "",
    };
    const baseLine = {
      order_id: order.id,
      product_id: "PROD-COFFEE",
      product_snapshot_json: JSON.stringify({ id: "PROD-COFFEE", name: "Coffee", category_id: "CAT-X", category_name: "X" }),
      variant_id: "VAR-COFFEE",
      variant_snapshot_json: JSON.stringify({ id: "VAR-COFFEE", size_name: "500ml", price: 0 }),
      qty: 1,
      unit_price: 0,
      gross_line_total: 10000,
      promo_discount: 0,
      manual_item_discount: 0,
      order_discount_allocation: 0,
      net_line_total: 10000,
      cost_at_sale: 0,
      recipe_snapshot_json: "{}",
      promo_discount_reason: "",
      manual_discount_reason: "",
    };
    const oldLine = {
      ...baseLine,
      id: "ol-old-dau",
      line_no: 1,
      modifiers_snapshot_json: JSON.stringify([{ id: "MOD-OLD-DAU", name: "Dâu sấy", price: 10000, qty: 1 }]),
    };
    const newLine = {
      ...baseLine,
      id: "ol-new-dau",
      line_no: 2,
      modifiers_snapshot_json: JSON.stringify([{ id: "MOD-NEW-DAU", name: "Dâu sấy", price: 10000, qty: 1 }]),
    };
    const modifiers = [
      { id: "MOD-OLD-DAU", name: "Dâu sấy", status: "DELETED", created_at: "2026-06-01T00:00:00.000Z" },
      { id: "MOD-NEW-DAU", name: "Dâu sấy", status: "ACTIVE", created_at: "2026-06-20T00:00:00.000Z" },
    ];

    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [order];
      if (sheet === "Order_Lines_V2") return [oldLine, newLine];
      return [];
    });
    (findAll as any).mockImplementation((sheet: string) => {
      if (sheet === "Modifiers") return modifiers;
      return [];
    });

    const result = await getSalesDataV2({});
    const dauSayRows = result.bestToppings.filter(row => row.name === "Dâu sấy");

    expect(dauSayRows).toHaveLength(1);
    expect(dauSayRows[0]).toMatchObject({
      modifier_id: "MOD-NEW-DAU",
      qty: 2,
      revenue: 20000,
    });
    expect(findAllWhere).toHaveBeenCalledWith("Orders_V2", {
      eq: { status: "COMPLETED" },
    });
  });

  it("routes a standalone topping product (CAT-007) with no modifier link into bestToppings, not bestSellers", async () => {
    // Production bug 2026-07-27: buildStandaloneToppingMap only added a CAT-007
    // product to the map when its migration_notes carried a linked modifier id.
    // Every CAT-007 product created without running that link step (which was
    // all 7 of them in production) fell through into bestSellers/bestDrinks
    // instead of bestToppings -- "Kem muối phô mai" and "Đào miếng" showed up
    // in the "Top sale - Nước" table. Fix: fall back to the product's own id.
    const createdAt = "2026-07-01T10:00:00.000Z";
    const order = {
      id: "ord-standalone-topping",
      order_no: "TOP-STANDALONE-001",
      brand_id: "BR-001",
      status: "COMPLETED",
      version: 1,
      parent_order_id: "",
      superseded_by: "",
      created_at: createdAt,
      created_by_id: "U",
      created_by_name: "Test",
      completed_at: createdAt,
      voided_at: "",
      voided_by_id: "",
      void_reason: "",
      currency: "VND",
      gross_total: 10000,
      promo_discount_total: 0,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 10000,
      applied_promotion_id: "",
      applied_promotion_snapshot_json: "",
      pos_snapshot_json: "{}",
      payment_method: "CASH",
      payment_ref: "",
      migration_notes: "",
    };
    const line = {
      order_id: order.id,
      id: "ol-standalone-topping",
      line_no: 1,
      product_id: "PROD-033",
      product_snapshot_json: JSON.stringify({
        id: "PROD-033",
        name: "Kem muối phô mai",
        category_id: "CAT-007",
        category_name: "Topping",
      }),
      variant_id: "VAR-033",
      variant_snapshot_json: JSON.stringify({ id: "VAR-033", size_name: "1 phần", price: 10000 }),
      qty: 1,
      unit_price: 10000,
      gross_line_total: 10000,
      promo_discount: 0,
      manual_item_discount: 0,
      order_discount_allocation: 0,
      net_line_total: 10000,
      cost_at_sale: 0,
      recipe_snapshot_json: "{}",
      promo_discount_reason: "",
      manual_discount_reason: "",
      modifiers_snapshot_json: "[]",
    };
    const products = [
      { id: "PROD-033", name: "Kem muối phô mai", category_id: "CAT-007", migration_notes: "" },
    ];

    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [order];
      if (sheet === "Order_Lines_V2") return [line];
      return [];
    });
    (findAll as any).mockImplementation((sheet: string) => {
      if (sheet === "Products") return products;
      return [];
    });

    const result = await getSalesDataV2({});

    expect(result.bestSellers.find(p => p.product_id === "PROD-033")).toBeUndefined();
    const toppingRow = result.bestToppings.find(t => t.name === "Kem muối phô mai");
    expect(toppingRow).toBeDefined();
    expect(toppingRow?.qty).toBe(1);
    expect(toppingRow?.revenue).toBe(10000);
  });

  it("loads sales lines only for the server-filtered report orders", async () => {
    const fixture = makeSuaDauStandaloneOrder();
    (findAllWhere as any).mockResolvedValue([fixture.order]);
    (findAllWhereInBatches as any).mockResolvedValue(fixture.lines);
    (findAllNoCache as any).mockResolvedValue([]);
    (findAll as any).mockResolvedValue([]);

    const result = await getSalesDataV2({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(findAllWhereInBatches).toHaveBeenCalledWith(
      "Order_Lines_V2",
      "order_id",
      [fixture.order.id],
    );
    expect(findAllNoCache).not.toHaveBeenCalledWith("Order_Lines_V2");
    expect(result.totalOrders).toBe(1);
  });

  it("attributes revenue per payment line for a split/mixed-payment order, not per order", async () => {
    const fixture = makeSuaDauStandaloneOrder();
    // net_total for this fixture is 25000 (see order-cart tests) — split it
    // across two methods to confirm the breakdown attributes by amount, not
    // by the single legacy payment_method column.
    const payments = [
      { order_id: fixture.order.id, method: "CASH", amount: 15000, reference: "" },
      { order_id: fixture.order.id, method: "BANK_TRANSFER", amount: 10000, reference: "TX-1" },
    ];
    (findAllWhere as any).mockResolvedValue([fixture.order]);
    (findAllWhereInBatches as any).mockImplementation((sheet: string) => {
      if (sheet === "Order_Lines_V2") return fixture.lines;
      if (sheet === "Order_Payments") return payments;
      return [];
    });
    (findAllNoCache as any).mockResolvedValue([]);
    (findAll as any).mockResolvedValue([]);

    const result = await getSalesDataV2({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(findAllWhereInBatches).toHaveBeenCalledWith(
      "Order_Payments",
      "order_id",
      [fixture.order.id],
    );
    const cash = result.paymentBreakdown.find(b => b.method === "CASH");
    const bank = result.paymentBreakdown.find(b => b.method === "BANK_TRANSFER");
    expect(cash).toMatchObject({ orderCount: 1, revenue: 15000 });
    expect(bank).toMatchObject({ orderCount: 1, revenue: 10000 });
    // The order's full net_total is still represented across the split, not
    // double-counted under one method.
    const totalAttributed = result.paymentBreakdown.reduce((s, b) => s + b.revenue, 0);
    expect(totalAttributed).toBe(fixture.order.net_total);
  });

  it("falls back to the legacy payment_method for an order with no order_payments rows", async () => {
    const fixture = makeSuaDauStandaloneOrder();
    (findAllWhere as any).mockResolvedValue([fixture.order]);
    (findAllWhereInBatches as any).mockImplementation((sheet: string) => {
      if (sheet === "Order_Lines_V2") return fixture.lines;
      if (sheet === "Order_Payments") return [];
      return [];
    });
    (findAllNoCache as any).mockResolvedValue([]);
    (findAll as any).mockResolvedValue([]);

    const result = await getSalesDataV2({
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(result.paymentBreakdown).toHaveLength(1);
    expect(result.paymentBreakdown[0]).toMatchObject({
      method: fixture.order.payment_method,
      orderCount: 1,
      revenue: fixture.order.net_total,
    });
  });
});

describe("getHourlyHeatmapV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (findAllWhere as any).mockImplementation((sheet: string) => (
      (findAllNoCache as any)(sheet)
    ));
  });

  it("pushes the completed-status and UTC date range into the order query", async () => {
    (findAllNoCache as any).mockResolvedValue([]);

    const result = await getHourlyHeatmapV2({
      startDate: "2026-07-01",
      endDate: "2026-07-02",
    });

    expect(result).toHaveLength(7 * 24);
    expect(findAllWhere).toHaveBeenCalledWith("Orders_V2", {
      gte: { created_at: new Date("2026-06-30T17:00:00.000Z") },
      lte: { created_at: new Date("2026-07-02T16:59:59.999Z") },
      eq: { status: "COMPLETED" },
    });
  });
});
