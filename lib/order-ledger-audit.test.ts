import { describe, expect, it } from "vitest";
import { auditOrderLedger } from "@/lib/order-ledger-audit";

describe("auditOrderLedger", () => {
  it("passes when completed order ledger matches variant and modifier quantities", () => {
    const report = auditOrderLedger({
      orders: [{ id: "ord-1", order_no: "O1", status: "COMPLETED", superseded_by: "" }],
      lines: [{
        id: "line-1",
        order_id: "ord-1",
        qty: 2,
        recipe_snapshot_json: JSON.stringify({
          variant: {
            target_type: "PRODUCT_VARIANT",
            target_id: "VAR-1",
            ingredients: [{ ingredient_id: "ING-A", ingredient_type: "BASE_INGREDIENT", quantity: 10 }],
          },
          modifiers: [{
            modifier_id: "MOD-1",
            modifier_name: "M",
            modifier_qty: 2,
            recipe: {
              target_type: "MODIFIER",
              target_id: "MOD-1",
              ingredients: [{ ingredient_id: "ING-B", ingredient_type: "BASE_INGREDIENT", quantity: 3 }],
            },
          }],
        }),
        modifiers_snapshot_json: JSON.stringify([{ id: "MOD-1", qty: 2 }]),
      }],
      ledger: [
        { reference_id: "ord-1", transaction_type: "SALES_CONSUME", item_reference: "ING-A", quantity_change: -20 },
        { reference_id: "ord-1", transaction_type: "SALES_CONSUME", item_reference: "ING-B", quantity_change: -12 },
      ],
    });

    expect(report.mismatches).toEqual([]);
  });

  it("expects superseded orders to net to zero after reversal", () => {
    const report = auditOrderLedger({
      orders: [{ id: "ord-old", order_no: "O1", status: "SUPERSEDED", superseded_by: "ord-new" }],
      lines: [{ id: "line-old", order_id: "ord-old", qty: 1, recipe_snapshot_json: "{}" }],
      ledger: [
        { reference_id: "ord-old", transaction_type: "SALES_CONSUME", item_reference: "ING-A", quantity_change: -10 },
        { reference_id: "ord-old", transaction_type: "EDIT_REVERSAL", item_reference: "ING-A", quantity_change: 10 },
      ],
    });

    expect(report.mismatches).toEqual([]);
  });

  it("reports missing reversal quantity", () => {
    const report = auditOrderLedger({
      orders: [{ id: "ord-old", order_no: "O1", status: "SUPERSEDED", superseded_by: "ord-new" }],
      lines: [{ id: "line-old", order_id: "ord-old", qty: 1, recipe_snapshot_json: "{}" }],
      ledger: [
        { reference_id: "ord-old", transaction_type: "SALES_CONSUME", item_reference: "ING-A", quantity_change: -10 },
      ],
    });

    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0]).toMatchObject({ item_reference: "ING-A", expected_quantity: 0, actual_quantity: -10 });
  });

  it("only treats order inventory ledger rows as orphan rows", () => {
    const report = auditOrderLedger({
      orders: [],
      lines: [],
      ledger: [
        { reference_id: "PO-001", transaction_type: "PO_RECEIPT", item_reference: "ING-A", quantity_change: 100 },
        { reference_id: "ord-missing", transaction_type: "SALES_CONSUME", item_reference: "ING-A", quantity_change: -10 },
      ],
    });

    expect(report.orphanLedgerRows).toHaveLength(1);
    expect(report.orphanLedgerRows[0]).toMatchObject({ reference_id: "ord-missing" });
  });

  it("expects semi-product ledger to split available stock and recipe shortfall", () => {
    const report = auditOrderLedger({
      orders: [{ id: "ord-1", order_no: "O1", status: "COMPLETED", superseded_by: "", created_at: "2026-06-02T00:00:00Z" }],
      lines: [{
        id: "line-1",
        order_id: "ord-1",
        qty: 1,
        recipe_snapshot_json: JSON.stringify({
          variant: {
            target_type: "PRODUCT_VARIANT",
            target_id: "VAR-1",
            ingredients: [{ ingredient_id: "BTP-COFFEE", ingredient_type: "SEMI_PRODUCT", quantity: 20 }],
          },
          modifiers: [],
        }),
      }],
      ledger: [
        { reference_id: "ADJ-1", transaction_type: "STOCK_ADJUST", item_reference: "BTP-COFFEE", quantity_change: 10, created_at: "2026-06-01T00:00:00Z" },
        { reference_id: "ord-1", transaction_type: "SALES_CONSUME", item_reference: "BTP-COFFEE", quantity_change: -10 },
        { reference_id: "ord-1", transaction_type: "SALES_CONSUME", item_reference: "ING-BEAN", quantity_change: -10 },
      ],
      recipes: [{
        target_id: "BTP-COFFEE",
        target_type: "SEMI_PRODUCT",
        ingredients_json: JSON.stringify([{ ingredient_id: "ING-BEAN", ingredient_type: "BASE_INGREDIENT", quantity: 100 }]),
      }],
      semiProducts: [{ id: "BTP-COFFEE", batch_yield: 100 }],
    });

    expect(report.mismatches).toEqual([]);
  });

  it("selects the semi-product recipe version effective at the order's own time, not today's, when exploding a shortfall", () => {
    const report = auditOrderLedger({
      orders: [{ id: "ord-1", order_no: "O1", status: "COMPLETED", superseded_by: "", created_at: "2026-06-02T00:00:00Z" }],
      lines: [{
        id: "line-1",
        order_id: "ord-1",
        qty: 1,
        recipe_snapshot_json: JSON.stringify({
          variant: {
            target_type: "PRODUCT_VARIANT",
            target_id: "VAR-1",
            ingredients: [{ ingredient_id: "BTP-COFFEE", ingredient_type: "SEMI_PRODUCT", quantity: 20 }],
          },
          modifiers: [],
        }),
      }],
      ledger: [
        // Recorded under the OLD recipe (effective when the order was sold):
        // ING-BEAN 30/100 per BTP-COFFEE unit.
        { reference_id: "ord-1", transaction_type: "SALES_CONSUME", item_reference: "ING-BEAN", quantity_change: -6 },
      ],
      recipes: [
        {
          target_id: "BTP-COFFEE",
          target_type: "SEMI_PRODUCT",
          ingredients_json: JSON.stringify([{ ingredient_id: "ING-BEAN", ingredient_type: "BASE_INGREDIENT", quantity: 30 }]),
          status: "ACTIVE",
          start_date: "2026-01-01T00:00:00Z",
          end_date: "2026-06-15T00:00:00Z",
        },
        {
          target_id: "BTP-COFFEE",
          target_type: "SEMI_PRODUCT",
          ingredients_json: JSON.stringify([{ ingredient_id: "ING-BEAN", ingredient_type: "BASE_INGREDIENT", quantity: 60 }]),
          status: "ACTIVE",
          start_date: "2026-06-15T00:00:00Z",
        },
      ],
      semiProducts: [{ id: "BTP-COFFEE", batch_yield: 100 }],
    });

    expect(report.mismatches).toEqual([]);
  });

  it("keeps pre-cutover historical semi-product ledger on the direct-consumption contract", () => {
    const report = auditOrderLedger({
      orders: [{ id: "ord-1", order_no: "O1", status: "COMPLETED", superseded_by: "", created_at: "2026-06-24T08:00:00Z" }],
      lines: [{
        id: "line-1",
        order_id: "ord-1",
        qty: 1,
        recipe_snapshot_json: JSON.stringify({
          variant: {
            target_type: "PRODUCT_VARIANT",
            target_id: "VAR-1",
            ingredients: [{ ingredient_id: "BTP-COFFEE", ingredient_type: "SEMI_PRODUCT", quantity: 20 }],
          },
          modifiers: [],
        }),
      }],
      ledger: [
        { reference_id: "ord-1", transaction_type: "SALES_CONSUME", item_reference: "BTP-COFFEE", quantity_change: -20 },
      ],
      recipes: [{
        target_id: "BTP-COFFEE",
        target_type: "SEMI_PRODUCT",
        ingredients_json: JSON.stringify([{ ingredient_id: "ING-BEAN", ingredient_type: "BASE_INGREDIENT", quantity: 100 }]),
      }],
      semiProducts: [{ id: "BTP-COFFEE", batch_yield: 100 }],
      shortfallCutoverAt: "2026-06-25T07:31:08.402Z",
    });

    expect(report.mismatches).toEqual([]);
  });

  it("matches a 2026-07-20 historically-corrected order (original SALES_CONSUME rows kept, plus RECLASSIFICATION_REVERSAL/PRODUCTION_CONSUME/PRODUCTION_YIELD/folded SALES_CONSUME)", () => {
    const report = auditOrderLedger({
      orders: [{ id: "ord-1", order_no: "O1", status: "COMPLETED", superseded_by: "", created_at: "2026-06-02T00:00:00Z" }],
      lines: [{
        id: "line-1",
        order_id: "ord-1",
        qty: 1,
        recipe_snapshot_json: JSON.stringify({
          variant: {
            target_type: "PRODUCT_VARIANT",
            target_id: "VAR-1",
            ingredients: [{ ingredient_id: "BTP-COFFEE", ingredient_type: "SEMI_PRODUCT", quantity: 20 }],
          },
          modifiers: [],
        }),
      }],
      ledger: [
        { reference_id: "ADJ-1", transaction_type: "STOCK_ADJUST", item_reference: "BTP-COFFEE", quantity_change: 10, created_at: "2026-06-01T00:00:00Z" },
        // Original (never touched) mis-classified rows.
        { reference_id: "ord-1", transaction_type: "SALES_CONSUME", item_reference: "BTP-COFFEE", quantity_change: -10 },
        { reference_id: "ord-1", transaction_type: "SALES_CONSUME", item_reference: "ING-BEAN", quantity_change: -10 },
        // 2026-07-20 historical correction: reverse the raw-ingredient row and
        // record it as an implicit production step instead.
        { reference_id: "ord-1", transaction_type: "RECLASSIFICATION_REVERSAL", item_reference: "ING-BEAN", quantity_change: 10 },
        { reference_id: "ord-1", transaction_type: "PRODUCTION_CONSUME", item_reference: "ING-BEAN", quantity_change: -10 },
        { reference_id: "ord-1", transaction_type: "PRODUCTION_YIELD", item_reference: "BTP-COFFEE", quantity_change: 10 },
        { reference_id: "ord-1", transaction_type: "SALES_CONSUME", item_reference: "BTP-COFFEE", quantity_change: -10 },
      ],
      recipes: [{
        target_id: "BTP-COFFEE",
        target_type: "SEMI_PRODUCT",
        ingredients_json: JSON.stringify([{ ingredient_id: "ING-BEAN", ingredient_type: "BASE_INGREDIENT", quantity: 100 }]),
      }],
      semiProducts: [{ id: "BTP-COFFEE", batch_yield: 100 }],
    });

    expect(report.mismatches).toEqual([]);
  });
});
