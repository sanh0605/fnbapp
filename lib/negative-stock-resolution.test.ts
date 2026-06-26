import { describe, expect, it } from "vitest";
import {
  diagnoseNegativeStock,
  planNegativeStockResolution,
  type NegativeStockDiagnosis,
} from "./negative-stock-resolution";

const baseIngredients = [
  { id: "ING-015", name: "Siro dao", base_unit: "U-ML", is_non_inventory: "" },
];

const semiProducts = [
  { id: "BTP-008", name: "Hong tra", base_unit: "U-ML" },
  { id: "BTP-003", name: "Cot matcha", base_unit: "U-ML" },
];

const units = [
  { id: "U-ML", name: "ml" },
];

describe("diagnoseNegativeStock", () => {
  it("classifies a semi-product sold without production yield as missing production yield", () => {
    const diagnosis = diagnoseNegativeStock({
      targetItemIds: ["BTP-008"],
      ledger: [
        { id: "sale-1", item_reference: "BTP-008", transaction_type: "SALES_CONSUME", quantity_change: -20, created_at: "2026-06-01T09:00:00Z" },
        { id: "adjust-1", item_reference: "BTP-008", transaction_type: "STOCK_ADJUST", quantity_change: 10, unit_cost: 3, created_at: "2026-06-01T10:00:00Z" },
      ],
      baseIngredients,
      semiProducts,
      units,
    });

    expect(diagnosis.items).toHaveLength(1);
    expect(diagnosis.items[0]).toMatchObject({
      itemId: "BTP-008",
      itemType: "SEMI_PRODUCT",
      balance: -10,
      classification: "MISSING_PRODUCTION_YIELD",
      suggestedAction: "PRODUCTION_YIELD_BACKFILL",
      proposedQuantity: 10,
      latestKnownUnitCost: 3,
    });
    expect(diagnosis.items[0].timeline.map(row => row.id)).toEqual(["sale-1", "adjust-1"]);
  });

  it("classifies a semi-product with too little production yield as insufficient production yield", () => {
    const diagnosis = diagnoseNegativeStock({
      targetItemIds: ["BTP-003"],
      ledger: [
        { id: "yield-1", item_reference: "BTP-003", transaction_type: "PRODUCTION_YIELD", quantity_change: 50, unit_cost: 4, created_at: "2026-06-01T08:00:00Z" },
        { id: "sale-1", item_reference: "BTP-003", transaction_type: "SALES_CONSUME", quantity_change: -80, created_at: "2026-06-01T09:00:00Z" },
      ],
      baseIngredients,
      semiProducts,
      units,
    });

    expect(diagnosis.items[0]).toMatchObject({
      itemId: "BTP-003",
      balance: -30,
      classification: "INSUFFICIENT_PRODUCTION_YIELD",
      suggestedAction: "PRODUCTION_YIELD_BACKFILL",
      proposedQuantity: 30,
      latestKnownUnitCost: 4,
    });
  });

  it("classifies a base ingredient with insufficient purchase receipts as a PO receipt gap", () => {
    const diagnosis = diagnoseNegativeStock({
      targetItemIds: ["ING-015"],
      ledger: [
        { id: "po-1", item_reference: "ING-015", transaction_type: "PO_RECEIPT", quantity_change: 1500, unit_cost: 9, created_at: "2026-06-01T08:00:00Z" },
        { id: "sale-1", item_reference: "ING-015", transaction_type: "SALES_CONSUME", quantity_change: -1510, created_at: "2026-06-01T09:00:00Z" },
      ],
      baseIngredients,
      semiProducts,
      units,
    });

    expect(diagnosis.items[0]).toMatchObject({
      itemId: "ING-015",
      itemType: "BASE_INGREDIENT",
      balance: -10,
      classification: "PO_RECEIPT_GAP",
      suggestedAction: "STOCK_ADJUST_IN",
      proposedQuantity: 10,
    });
  });
});

describe("planNegativeStockResolution", () => {
  it("creates correction rows for diagnosed negative items", () => {
    const diagnosis: NegativeStockDiagnosis = {
      generated_at: "2026-06-26T00:00:00.000Z",
      items: [
        {
          itemId: "BTP-008",
          itemName: "Hong tra",
          itemType: "SEMI_PRODUCT",
          unitName: "ml",
          balance: -10,
          classification: "MISSING_PRODUCTION_YIELD",
          suggestedAction: "PRODUCTION_YIELD_BACKFILL",
          proposedQuantity: 10,
          latestKnownUnitCost: 3,
          totalsByTransactionType: {},
          timeline: [],
        },
        {
          itemId: "ING-015",
          itemName: "Siro dao",
          itemType: "BASE_INGREDIENT",
          unitName: "ml",
          balance: -5,
          classification: "PO_RECEIPT_GAP",
          suggestedAction: "STOCK_ADJUST_IN",
          proposedQuantity: 5,
          latestKnownUnitCost: 9,
          totalsByTransactionType: {},
          timeline: [],
        },
      ],
    };

    const plan = planNegativeStockResolution({
      diagnosis,
      ledger: [],
      now: "2026-06-26T01:00:00.000Z",
      idSeed: "test-seed",
    });

    expect(plan.changesNeeded).toBe(2);
    expect(plan.rowsToInsert).toEqual([
      expect.objectContaining({
        id: "STK-PHASE9-test-seed-001",
        transaction_type: "PRODUCTION_YIELD",
        reference_id: "PHASE9-NEGATIVE-STOCK-2026-06-26",
        item_reference: "BTP-008",
        quantity_change: 10,
        unit_cost: 3,
      }),
      expect.objectContaining({
        id: "STK-PHASE9-test-seed-002",
        transaction_type: "STOCK_ADJUST",
        reference_id: "PHASE9-NEGATIVE-STOCK-2026-06-26",
        item_reference: "ING-015",
        quantity_change: 5,
        unit_cost: 0,
      }),
    ]);
  });

  it("is a no-op when an item is already balanced by existing ledger rows", () => {
    const diagnosis: NegativeStockDiagnosis = {
      generated_at: "2026-06-26T00:00:00.000Z",
      items: [
        {
          itemId: "BTP-008",
          itemName: "Hong tra",
          itemType: "SEMI_PRODUCT",
          unitName: "ml",
          balance: -10,
          classification: "MISSING_PRODUCTION_YIELD",
          suggestedAction: "PRODUCTION_YIELD_BACKFILL",
          proposedQuantity: 10,
          latestKnownUnitCost: 3,
          totalsByTransactionType: {},
          timeline: [],
        },
      ],
    };

    const plan = planNegativeStockResolution({
      diagnosis,
      ledger: [
        { id: "sale-1", item_reference: "BTP-008", transaction_type: "SALES_CONSUME", quantity_change: -10 },
        { id: "phase9-1", item_reference: "BTP-008", transaction_type: "PRODUCTION_YIELD", quantity_change: 10, reference_id: "PHASE9-NEGATIVE-STOCK-2026-06-26" },
      ],
      now: "2026-06-26T01:00:00.000Z",
      idSeed: "test-seed",
    });

    expect(plan.changesNeeded).toBe(0);
    expect(plan.rowsToInsert).toEqual([]);
  });
});
