import { describe, expect, it } from "vitest";
import * as macCogs from "@/lib/mac-cogs";
import {
  computeMacCostForConsumptionRows,
  computeMacCostFromUnitCosts,
  getMacUnitCost,
} from "@/lib/mac-cogs";
import type { ConsumptionRow } from "@/lib/inventory-consumption";

const ledger = [
  { item_reference: "ING-A", transaction_type: "PO_RECEIPT", quantity_change: "100", unit_cost: "10", created_at: "2026-06-01T00:00:00Z" },
  { item_reference: "ING-A", transaction_type: "SALES_CONSUME", quantity_change: "-100", unit_cost: "0", created_at: "2026-06-02T00:00:00Z" },
  { item_reference: "ING-A", transaction_type: "PO_RECEIPT", quantity_change: "100", unit_cost: "20", created_at: "2026-06-03T00:00:00Z" },
  { item_reference: "ING-B", transaction_type: "PO_RECEIPT", quantity_change: "50", unit_cost: "40", created_at: "2026-06-01T00:00:00Z" },
];

describe("MAC COGS", () => {
  it("reuses an item-grouped ledger without rescanning unrelated rows", () => {
    const createMacLedgerIndex = (
      macCogs as unknown as {
        createMacLedgerIndex?: (rows: typeof ledger) => unknown;
      }
    ).createMacLedgerIndex;

    expect(createMacLedgerIndex).toBeTypeOf("function");

    let itemReferenceReads = 0;
    const observedLedger = ledger.map(row => ({
      ...row,
      get item_reference() {
        itemReferenceReads += 1;
        return row.item_reference;
      },
    }));
    const index = createMacLedgerIndex!(observedLedger);
    const readsAfterIndexBuild = itemReferenceReads;

    expect(getMacUnitCost(index as typeof ledger, "ING-A", "2026-06-04T00:00:00Z")).toBe(20);
    expect(getMacUnitCost(index as typeof ledger, "ING-A", "2026-06-02T12:00:00Z")).toBe(10);
    expect(itemReferenceReads).toBe(readsAfterIndexBuild);
  });

  it("computes moving weighted average from receipt rows up to the sale time", () => {
    expect(getMacUnitCost(ledger, "ING-A", "2026-06-04T00:00:00Z")).toBe(20);
  });

  it("ignores receipts after the sale time", () => {
    expect(getMacUnitCost(ledger, "ING-A", "2026-06-02T12:00:00Z")).toBe(10);
  });

  it("keeps latest known MAC available when stock is zero or negative", () => {
    const rows: ConsumptionRow[] = [
      { item_reference: "ING-A", quantity: 10, source: "VARIANT_RECIPE" },
    ];

    expect(computeMacCostForConsumptionRows(rows, ledger, "2026-06-02T12:00:00Z")).toBe(100);
  });

  it("uses semi-product recipe fallback when direct semi-product MAC is missing", () => {
    const rows: ConsumptionRow[] = [
      { item_reference: "BTP-1", quantity: 20, source: "VARIANT_RECIPE" },
    ];

    const cost = computeMacCostForConsumptionRows(rows, ledger, "2026-06-04T00:00:00Z", {
      semiProductRecipes: new Map([
        ["BTP-1", [
          { ingredient_id: "ING-A", ingredient_type: "BASE_INGREDIENT", quantity: 30, unit_id: "g" },
          { ingredient_id: "ING-B", ingredient_type: "BASE_INGREDIENT", quantity: 10, unit_id: "g" },
        ]],
      ]),
      semiProductYields: new Map([["BTP-1", 100]]),
    });

    // BTP unit cost = ING-A 30/100*20 + ING-B 10/100*40 = 10; 20 units = 200.
    expect(cost).toBe(200);
  });

  it("costs split semi-product stock and base-ingredient shortfall rows without double counting", () => {
    const rows: ConsumptionRow[] = [
      { item_reference: "BTP-1", quantity: 10, source: "VARIANT_RECIPE" },
      { item_reference: "ING-A", quantity: 10, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-1" },
    ];

    const cost = computeMacCostForConsumptionRows(rows, [
      ...ledger,
      { item_reference: "BTP-1", transaction_type: "PRODUCTION_YIELD", quantity_change: "100", unit_cost: "5", created_at: "2026-06-01T00:00:00Z" },
    ], "2026-06-04T00:00:00Z");

    expect(cost).toBe(250);
  });

  it("computes the same cost from a compact MAC map with semi-product fallback", () => {
    const rows: ConsumptionRow[] = [
      { item_reference: "BTP-1", quantity: 20, source: "VARIANT_RECIPE" },
    ];
    const context = {
      semiProductRecipes: new Map([
        ["BTP-1", [
          { ingredient_id: "ING-A", ingredient_type: "BASE_INGREDIENT" as const, quantity: 30, unit_id: "g" },
          { ingredient_id: "ING-B", ingredient_type: "BASE_INGREDIENT" as const, quantity: 10, unit_id: "g" },
        ]],
      ]),
      semiProductYields: new Map([["BTP-1", 100]]),
    };

    expect(computeMacCostFromUnitCosts(
      rows,
      new Map([["ING-A", 20], ["ING-B", 40]]),
      context,
    )).toBe(200);
  });
});
