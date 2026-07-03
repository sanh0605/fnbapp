import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sheets_db", () => ({
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  findAll: vi.fn(),
}));

import { findAllNoCache, findAllWhere, findAll } from "@/lib/sheets_db";
import { getHourlyHeatmapV2, getPnLDataV2, getSalesDataV2 } from "./actions";
import { makeSuaDauStandaloneOrder, makeUCK000094MigratedOrder } from "@/lib/__tests__/fixtures";

describe("getPnLDataV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (findAllWhere as any).mockImplementation((sheet: string) => (
      (findAllNoCache as any)(sheet)
    ));
  });

  it("reuses one request-scoped stock-ledger index across both P&L MAC breakdowns", async () => {
    const fixture = makeSuaDauStandaloneOrder();
    const order = {
      ...fixture.order,
      id: "order-index",
      created_at: "2026-07-01T00:00:00Z",
    };
    const baseLine = {
      ...fixture.lines[0],
      order_id: order.id,
      cost_at_sale: 5000,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-INDEX",
          ingredients: [
            { ingredient_id: "BI-A", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" },
            { ingredient_id: "BI-B", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "U" },
          ],
        },
        modifiers: [],
      }),
    };
    const lines = [
      { ...baseLine, id: "line-index-1" },
      { ...baseLine, id: "line-index-2" },
    ];

    let itemReferenceReads = 0;
    const ledger = ["BI-A", "BI-B"].map(itemReference => ({
      get item_reference() {
        itemReferenceReads += 1;
        return itemReference;
      },
      transaction_type: "PO_RECEIPT",
      unit_cost: "100",
      quantity_change: "10",
      created_at: "2026-06-01T00:00:00Z",
    }));

    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Orders_V2") return [order];
      if (sheet === "Order_Lines_V2") return lines;
      if (sheet === "Stock_Ledger") return ledger;
      return [];
    });
    (findAll as any).mockResolvedValue([]);

    await getPnLDataV2({});

    expect(itemReferenceReads).toBe(ledger.length * 3);
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
    expect(result.totalCOGS).toBe(12000);
    expect(result.grossProfit).toBe(18000);
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

    expect(rowA?.cogs).toBe(5000);
    expect(rowB?.cogs).toBe(7000);

    const totalMultiCogs = multiRows.reduce((s, r) => s + r.cogs, 0);
    expect(totalMultiCogs).toBe(12000);

    expect(rowA?.marginPct).toBeCloseTo(66.67, 1);
    expect(rowB?.marginPct).toBeCloseTo(53.33, 1);
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

    expect(result.totalCOGS).toBe(5000);
    expect(productRow?.cogs).toBe(3000);
    expect(toppingRow?.cogs).toBe(2000);
    expect(result.productProfitAnalysis.reduce((sum, row) => sum + row.cogs, 0)).toBe(5000);
  });

  it("splits product and topping COGS by MAC weights instead of FIFO order", async () => {
    const orderId = "ord-mac-split";
    const createdAt = "2026-06-15T10:00:00.000Z";
    const order = {
      id: orderId,
      order_no: "MAC-001",
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
      id: "ol-mac-split",
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
      cost_at_sale: 130,
      recipe_snapshot_json: JSON.stringify({
        variant: {
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-COFFEE",
          ingredients: [{ ingredient_id: "ING-MILK", ingredient_type: "BASE_INGREDIENT", quantity: 1 }],
        },
        modifiers: [{
          modifier_id: "MOD-PEARL",
          modifier_name: "Pearl",
          recipe: {
            target_type: "MODIFIER",
            target_id: "MOD-PEARL",
            ingredients: [{ ingredient_id: "ING-PEARL", ingredient_type: "BASE_INGREDIENT", quantity: 1 }],
          },
        }],
      }),
      promo_discount_reason: "",
      manual_discount_reason: "",
    };
    const ledger = [
      { id: "po-milk-1", transaction_type: "PO_RECEIPT", item_reference: "ING-MILK", quantity_change: 1, unit_cost: 10, created_at: "2026-06-01T00:00:00.000Z" },
      { id: "po-milk-2", transaction_type: "PO_RECEIPT", item_reference: "ING-MILK", quantity_change: 1, unit_cost: 50, created_at: "2026-06-02T00:00:00.000Z" },
      { id: "po-pearl", transaction_type: "PO_RECEIPT", item_reference: "ING-PEARL", quantity_change: 10, unit_cost: 100, created_at: "2026-06-01T00:00:00.000Z" },
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

    expect(result.totalCOGS).toBe(130);
    expect(productRow?.cogs).toBe(30);
    expect(toppingRow?.cogs).toBe(100);
    expect(result.productProfitAnalysis.reduce((sum, row) => sum + row.cogs, 0)).toBe(130);
  });

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
      cogs: 9508,
    });
  });
});

describe("getSalesDataV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (findAllWhere as any).mockImplementation((sheet: string) => (
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
