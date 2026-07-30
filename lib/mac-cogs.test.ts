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
  it("preserves MAC costs when callers share one request-scoped index", () => {
    const index = macCogs.createMacLedgerIndex(ledger);
    const lookups = [
      ["ING-A", "2026-06-02T12:00:00Z"],
      ["ING-A", "2026-06-04T00:00:00Z"],
      ["ING-B", "2026-06-04T00:00:00Z"],
    ] as const;

    for (const [itemReference, asOf] of lookups) {
      expect(getMacUnitCost(index, itemReference, asOf))
        .toBe(getMacUnitCost(ledger, itemReference, asOf));
    }
  });

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

  it("restores EDIT_REVERSAL/positive at the MAC in effect when the original consumption happened, not today's MAC (owner correction 2026-07-30)", () => {
    // 01/06 nhap 100 @ 10   -> MAC = 10
    // 02/06 ban 50 (ord-1)  -> tieu hao 50 @ MAC 10 (gia tri 500); ton 50, tri gia 500
    // 03/06 nhap 100 @ 30   -> ton 150, tri gia 3500, MAC = 23.333...
    // 04/06 EDIT_REVERSAL +50 (ord-1) huy don ban 02/06
    //   Neu dung MAC HIEN TAI (23.333) hoac bo qua (bug cu): MAC van la 23.333
    //   (them vao dung gia trung binh khong doi ty le -- day la vi sao con so
    //   nay KHONG phan biet duoc bug cu voi ban va "phuc hoi bang MAC hien tai").
    //   Dung: phuc hoi DUNG gia tri da tieu hao (500, tai MAC 10 luc do) ->
    //   ton 200, tri gia 4000, MAC = 20 -- khac hai truong hop sai o tren.
    const revLedger = [
      { item_reference: "ING-X", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 10, created_at: "2026-06-01T00:00:00Z", reference_id: "po-1" },
      { item_reference: "ING-X", transaction_type: "SALES_CONSUME", quantity_change: -50, unit_cost: 0, created_at: "2026-06-02T00:00:00Z", reference_id: "ord-1" },
      { item_reference: "ING-X", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 30, created_at: "2026-06-03T00:00:00Z", reference_id: "po-2" },
      { item_reference: "ING-X", transaction_type: "EDIT_REVERSAL", quantity_change: 50, unit_cost: 0, created_at: "2026-06-04T00:00:00Z", reference_id: "ord-1" },
    ];
    expect(getMacUnitCost(revLedger, "ING-X", "2026-06-05T00:00:00Z")).toBeCloseTo(20, 6);
  });

  it("removes EDIT_REVERSAL/negative at the value the original addition actually contributed, not today's MAC", () => {
    // Mirror case: EDIT_REVERSAL with negative qty undoes an earlier
    // positive-qty addition (e.g. a mistaken STOCK_ADJUST) for the same
    // reference_id -- must remove exactly what that addition contributed.
    const revLedger = [
      { item_reference: "ING-Y", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 10, created_at: "2026-06-01T00:00:00Z", reference_id: "po-1" },
      { item_reference: "ING-Y", transaction_type: "STOCK_ADJUST", quantity_change: 50, unit_cost: 40, created_at: "2026-06-02T00:00:00Z", reference_id: "adj-1" },
      // 150 units, value 1000 + 2000 = 3000, MAC = 20
      { item_reference: "ING-Y", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 5, created_at: "2026-06-03T00:00:00Z", reference_id: "po-2" },
      // 250 units, value 3000 + 500 = 3500, MAC = 14
      { item_reference: "ING-Y", transaction_type: "EDIT_REVERSAL", quantity_change: -50, unit_cost: 0, created_at: "2026-06-04T00:00:00Z", reference_id: "adj-1" },
      // undo adj-1: remove 50 units / 2000 value -> 200 units, 1500 value, MAC = 7.5
    ];
    expect(getMacUnitCost(revLedger, "ING-Y", "2026-06-05T00:00:00Z")).toBeCloseTo(7.5, 6);
  });

  it("keeps PRODUCTION_YIELD/positive and STOCK_ADJUST/positive as a no-op when unit_cost is 0 (semi-products always use recipe fallback, never their own accumulated MAC)", () => {
    const noCostLedger = [
      { item_reference: "BTP-Z", transaction_type: "SALES_CONSUME", quantity_change: -10, unit_cost: 0, created_at: "2026-06-01T00:00:00Z", reference_id: "ord-1" },
      { item_reference: "BTP-Z", transaction_type: "PRODUCTION_YIELD", quantity_change: 10, unit_cost: 0, created_at: "2026-06-01T00:00:00Z", reference_id: "ord-1" },
      { item_reference: "BTP-Z", transaction_type: "STOCK_ADJUST", quantity_change: 5, unit_cost: 0, created_at: "2026-06-02T00:00:00Z", reference_id: "adj-1" },
    ];
    expect(getMacUnitCost(noCostLedger, "BTP-Z", "2026-06-05T00:00:00Z")).toBe(0);
  });

  it("returns the exact cost, not a rounded one", () => {
    const preciseLedger = [
      { item_reference: "CAFE", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 1, created_at: "2026-06-01T03:00:00Z" },
      { item_reference: "CAFE", transaction_type: "SALES_CONSUME", quantity_change: -10, unit_cost: 0, created_at: "2026-06-02T03:00:00Z" },
      { item_reference: "CAFE", transaction_type: "SALES_CONSUME", quantity_change: -20, unit_cost: 0, created_at: "2026-06-03T03:00:00Z" },
      { item_reference: "CAFE", transaction_type: "PO_RECEIPT", quantity_change: 100, unit_cost: 2, created_at: "2026-06-04T03:00:00Z" },
    ];
    const cost = computeMacCostForConsumptionRows(
      [{ item_reference: "CAFE", quantity: 10, source: "VARIANT_RECIPE" }], preciseLedger, "2026-06-05T03:00:00Z");
    expect(cost).toBeCloseTo(15.882353, 5);   // today this returns exactly 16
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

  it("costs the same total whether a semi-product shortfall is split (available + exploded raw row) or folded into one row -- matching the real system's convention that PRODUCTION_YIELD always carries unit_cost 0", () => {
    // This is the equivalence the implicit-production-on-shortfall fix
    // depends on (docs/superpowers/plans/2026-07-20-implicit-production-shortfall-design.md):
    // costing "30 BTP + 20 raw-equivalent" must equal costing "50 BTP",
    // given BTP's own PRODUCTION_YIELD entries never carry a direct cost
    // (confirmed in app/admin/production/actions.ts and this fix's own new
    // implicit PRODUCTION_YIELD rows -- both always unit_cost: 0), so BTP's
    // MAC always falls back to its recipe's raw-ingredient cost.
    const ledgerWithZeroCostYield = [
      ...ledger,
      { item_reference: "BTP-1", transaction_type: "PRODUCTION_YIELD", quantity_change: "100", unit_cost: "0", created_at: "2026-06-01T00:00:00Z" },
    ];
    const semiProductContext = {
      semiProductRecipes: new Map([
        ["BTP-1", [
          { ingredient_id: "ING-A", ingredient_type: "BASE_INGREDIENT" as const, quantity: 30, unit_id: "g" },
          { ingredient_id: "ING-B", ingredient_type: "BASE_INGREDIENT" as const, quantity: 10, unit_id: "g" },
        ]],
      ]),
      semiProductYields: new Map([["BTP-1", 100]]),
    };

    const splitRows: ConsumptionRow[] = [
      { item_reference: "BTP-1", quantity: 10, source: "VARIANT_RECIPE" },
      { item_reference: "ING-A", quantity: 3, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-1" },
      { item_reference: "ING-B", quantity: 1, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-1" },
    ];
    const foldedRows: ConsumptionRow[] = [
      { item_reference: "BTP-1", quantity: 20, source: "VARIANT_RECIPE" },
    ];

    const splitCost = computeMacCostForConsumptionRows(
      splitRows, ledgerWithZeroCostYield, "2026-06-04T00:00:00Z", semiProductContext,
    );
    const foldedCost = computeMacCostForConsumptionRows(
      foldedRows, ledgerWithZeroCostYield, "2026-06-04T00:00:00Z", semiProductContext,
    );

    expect(splitCost).toBe(foldedCost);
    // BTP-1 unit cost via recipe fallback = ING-A 30/100*20 + ING-B 10/100*40 = 10; 20 units = 200.
    expect(foldedCost).toBe(200);
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
