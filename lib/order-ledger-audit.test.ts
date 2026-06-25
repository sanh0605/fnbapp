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
});
