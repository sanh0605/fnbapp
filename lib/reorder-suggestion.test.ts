import { describe, expect, it } from "vitest";
import { computeReorderSuggestions, type ReorderSuggestionInput } from "@/lib/reorder-suggestion";

const baseInput = (overrides: Partial<ReorderSuggestionInput> = {}): ReorderSuggestionInput => ({
  stockLedger: [],
  baseIngredients: [],
  semiProducts: [],
  units: [{ id: "U-KG", name: "Kg" }, { id: "U-GOI", name: "Goi" }],
  purchasedItems: [],
  uomConversions: [],
  purchaseOrders: [],
  purchaseOrderLines: [],
  ...overrides,
});

const asOf = new Date("2026-07-22T00:00:00Z");
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe("computeReorderSuggestions", () => {
  it("flags not-enough-data when consumption history is too thin", () => {
    const input = baseInput({
      baseIngredients: [{ id: "ING-A", name: "Duong", base_unit: "U-KG" }],
      stockLedger: [
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(1) },
      ],
    });

    const [result] = computeReorderSuggestions(input, { asOf });

    expect(result.hasSufficientData).toBe(false);
    expect(result.avgDailyConsumption).toBeNull();
    expect(result.reorderPoint).toBeNull();
    expect(result.isLowStock).toBe(false);
  });

  it("computes avg daily consumption, reorder point, and low-stock flag from sales + production consume", () => {
    const input = baseInput({
      baseIngredients: [{ id: "ING-A", name: "Duong", base_unit: "U-KG" }],
      stockLedger: [
        { item_reference: "ING-A", transaction_type: "PO_RECEIPT", quantity_change: 100, created_at: daysAgo(20) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -5, created_at: daysAgo(10) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -5, created_at: daysAgo(8) },
        { item_reference: "ING-A", transaction_type: "PRODUCTION_CONSUME", quantity_change: -4, created_at: daysAgo(6) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -5, created_at: daysAgo(2) },
      ],
    });

    const [result] = computeReorderSuggestions(input, { asOf, lookbackDays: 14 });

    // total consumption over 14 days = 5+5+4+5 = 19; avg/day = 19/14
    expect(result.hasSufficientData).toBe(true);
    expect(result.avgDailyConsumption).toBeCloseTo(19 / 14, 6);
    // current stock = 100 - 19 = 81
    expect(result.currentStock).toBeCloseTo(81, 6);
    // no PO history -> default lead time (3 days), safety buffer 1.3
    expect(result.leadTimeIsDefault).toBe(true);
    const expectedReorderPoint = (19 / 14) * 3 * 1.3;
    expect(result.reorderPoint).toBeCloseTo(expectedReorderPoint, 6);
    expect(result.isLowStock).toBe(false);
  });

  it("ignores consumption events outside the lookback window", () => {
    const input = baseInput({
      baseIngredients: [{ id: "ING-A", name: "Duong", base_unit: "U-KG" }],
      stockLedger: [
        { item_reference: "ING-A", transaction_type: "PO_RECEIPT", quantity_change: 100, created_at: daysAgo(60) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -50, created_at: daysAgo(30) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(5) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(4) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(3) },
      ],
    });

    const [result] = computeReorderSuggestions(input, { asOf, lookbackDays: 14 });

    expect(result.hasSufficientData).toBe(true);
    expect(result.avgDailyConsumption).toBeCloseTo(3 / 14, 6);
    // current stock still reflects the full ledger, including the out-of-window sale
    expect(result.currentStock).toBeCloseTo(100 - 50 - 1 - 1 - 1, 6);
  });

  it("derives lead time from completed PO creation-to-receipt gaps", () => {
    const input = baseInput({
      baseIngredients: [{ id: "ING-A", name: "Duong", base_unit: "U-KG" }],
      purchasedItems: [{ id: "PI-1", base_ingredient_id: "ING-A" }],
      purchaseOrders: [{ id: "PO-1", status: "COMPLETED", created_at: daysAgo(10) }],
      purchaseOrderLines: [{ purchase_order_id: "PO-1", purchased_item_id: "PI-1" }],
      stockLedger: [
        { item_reference: "ING-A", transaction_type: "PO_RECEIPT", reference_id: "PO-1", quantity_change: 50, created_at: daysAgo(5) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(3) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(2) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(1) },
      ],
    });

    const [result] = computeReorderSuggestions(input, { asOf });

    expect(result.leadTimeIsDefault).toBe(false);
    expect(result.leadTimeDays).toBeCloseTo(5, 6);
  });

  it("ignores PO lines from non-completed purchase orders when deriving lead time", () => {
    const input = baseInput({
      baseIngredients: [{ id: "ING-A", name: "Duong", base_unit: "U-KG" }],
      purchasedItems: [{ id: "PI-1", base_ingredient_id: "ING-A" }],
      purchaseOrders: [{ id: "PO-1", status: "DRAFT", created_at: daysAgo(10) }],
      purchaseOrderLines: [{ purchase_order_id: "PO-1", purchased_item_id: "PI-1" }],
      stockLedger: [
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(3) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(2) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(1) },
      ],
    });

    const [result] = computeReorderSuggestions(input, { asOf });

    expect(result.leadTimeIsDefault).toBe(true);
  });

  it("computes suggested reorder quantity in base unit and converts to purchase unit", () => {
    const input = baseInput({
      baseIngredients: [{ id: "ING-A", name: "Duong", base_unit: "U-KG" }],
      purchasedItems: [{ id: "PI-1", base_ingredient_id: "ING-A" }],
      uomConversions: [{ purchased_item_id: "PI-1", purchased_unit: "U-GOI", conversion_rate: 5, status: "ACTIVE" }],
      stockLedger: [
        { item_reference: "ING-A", transaction_type: "PO_RECEIPT", quantity_change: 10, created_at: daysAgo(20) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -2, created_at: daysAgo(3) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -2, created_at: daysAgo(2) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -2, created_at: daysAgo(1) },
      ],
    });

    const [result] = computeReorderSuggestions(input, { asOf, lookbackDays: 6, targetCoverageDays: 10 });

    // avg/day = 6/6 = 1; current stock = 10-6 = 4; suggested base qty = 10*1 - 4 = 6
    expect(result.avgDailyConsumption).toBeCloseTo(1, 6);
    expect(result.currentStock).toBeCloseTo(4, 6);
    expect(result.suggestedReorderQtyBaseUnit).toBeCloseTo(6, 6);
    // conversion_rate 5 base units per purchase unit -> 6/5 = 1.2
    expect(result.suggestedReorderQtyPurchaseUnit).toBeCloseTo(1.2, 6);
    expect(result.purchaseUnitName).toBe("Goi");
  });

  it("never suggests a negative reorder quantity when current stock already covers the target window", () => {
    const input = baseInput({
      baseIngredients: [{ id: "ING-A", name: "Duong", base_unit: "U-KG" }],
      stockLedger: [
        { item_reference: "ING-A", transaction_type: "PO_RECEIPT", quantity_change: 1000, created_at: daysAgo(20) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(3) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(2) },
        { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: -1, created_at: daysAgo(1) },
      ],
    });

    const [result] = computeReorderSuggestions(input, { asOf });

    expect(result.suggestedReorderQtyBaseUnit).toBe(0);
    expect(result.isLowStock).toBe(false);
  });

  it("excludes non-inventory base ingredients", () => {
    const input = baseInput({
      baseIngredients: [
        { id: "ING-A", name: "Duong", base_unit: "U-KG", is_non_inventory: true },
        { id: "ING-B", name: "Nuoc", base_unit: "U-KG" },
      ],
    });

    const results = computeReorderSuggestions(input, { asOf });

    expect(results.map((r) => r.itemId)).toEqual(["ING-B"]);
  });

  it("includes semi-products alongside base ingredients", () => {
    const input = baseInput({
      baseIngredients: [{ id: "ING-A", name: "Duong", base_unit: "U-KG" }],
      semiProducts: [{ id: "BTP-A", name: "Cot ca phe", base_unit: "U-KG" }],
    });

    const results = computeReorderSuggestions(input, { asOf });

    expect(results.map((r) => r.itemType).sort()).toEqual(["BASE_INGREDIENT", "SEMI_PRODUCT"]);
  });
});
