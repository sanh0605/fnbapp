import { describe, expect, it } from "vitest";
import { buildPurchaseCostRecoveryPlan } from "@/lib/purchase-cost-recovery";

const mismatch = {
  po_id: "PO-048",
  item_reference: "ING-022",
  expected_quantity: 25000,
  actual_quantity: 25000,
  expected_unit_cost: 19.6,
  actual_unit_cost: 20,
  expected_total_cost: 490000,
  actual_total_cost: 500000,
  delta_quantity: 0,
  delta_total_cost: -10000,
};

describe("buildPurchaseCostRecoveryPlan", () => {
  it("plans one reversible unit-cost correction for a material mismatch", () => {
    const plan = buildPurchaseCostRecoveryPlan({
      runId: "purchase-cost-20260702",
      mismatches: [mismatch],
      expectedReceipts: [
        {
          po_id: "PO-048",
          item_reference: "ING-022",
          quantity_change: 25000,
          unit_cost: 19.6,
        },
      ],
      ledger: [
        {
          id: "STK-048",
          reference_id: "PO-048",
          item_reference: "ING-022",
          transaction_type: "PO_RECEIPT",
          quantity_change: 25000,
          unit_cost: 20,
        },
      ],
      materialThreshold: 1,
    });

    expect(plan.changes).toEqual([
      {
        ledger_id: "STK-048",
        po_id: "PO-048",
        item_reference: "ING-022",
        quantity_change: 25000,
        old_unit_cost: 20,
        new_unit_cost: 19.6,
        old_total_cost: 500000,
        new_total_cost: 490000,
        delta_total_cost: -10000,
      },
    ]);
    expect(plan.source_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ignores sub-cent precision noise", () => {
    const plan = buildPurchaseCostRecoveryPlan({
      runId: "purchase-cost-20260702",
      mismatches: [{ ...mismatch, delta_total_cost: 0.0002 }],
      expectedReceipts: [],
      ledger: [],
      materialThreshold: 1,
    });

    expect(plan.changes).toEqual([]);
  });

  it("refuses quantity mismatches and ambiguous ledger groups", () => {
    expect(() =>
      buildPurchaseCostRecoveryPlan({
        runId: "purchase-cost-20260702",
        mismatches: [{ ...mismatch, delta_quantity: 1 }],
        expectedReceipts: [],
        ledger: [],
        materialThreshold: 1,
      }),
    ).toThrow("quantity mismatch");

    expect(() =>
      buildPurchaseCostRecoveryPlan({
        runId: "purchase-cost-20260702",
        mismatches: [mismatch],
        expectedReceipts: [
          {
            po_id: "PO-048",
            item_reference: "ING-022",
            quantity_change: 25000,
            unit_cost: 19.6,
          },
        ],
        ledger: [
          {
            id: "STK-1",
            reference_id: "PO-048",
            item_reference: "ING-022",
            transaction_type: "PO_RECEIPT",
            quantity_change: 10000,
            unit_cost: 20,
          },
          {
            id: "STK-2",
            reference_id: "PO-048",
            item_reference: "ING-022",
            transaction_type: "PO_RECEIPT",
            quantity_change: 15000,
            unit_cost: 20,
          },
        ],
        materialThreshold: 1,
      }),
    ).toThrow("unique quantity match");
  });

  it("matches multiple rows in one group by quantity and skips correct rows", () => {
    const plan = buildPurchaseCostRecoveryPlan({
      runId: "purchase-cost-20260702",
      mismatches: [
        {
          ...mismatch,
          po_id: "PO-047",
          item_reference: "ING-032",
          expected_quantity: 5400,
          actual_quantity: 5400,
          delta_total_cost: -2200,
        },
      ],
      expectedReceipts: [
        {
          po_id: "PO-047",
          item_reference: "ING-032",
          quantity_change: 4800,
          unit_cost: 68.54166666666667,
        },
        {
          po_id: "PO-047",
          item_reference: "ING-032",
          quantity_change: 600,
          unit_cost: 0,
        },
      ],
      ledger: [
        {
          id: "STK-014",
          reference_id: "PO-047",
          item_reference: "ING-032",
          transaction_type: "PO_RECEIPT",
          quantity_change: 4800,
          unit_cost: 69,
        },
        {
          id: "STK-015",
          reference_id: "PO-047",
          item_reference: "ING-032",
          transaction_type: "PO_RECEIPT",
          quantity_change: 600,
          unit_cost: 0,
        },
      ],
      materialThreshold: 1,
    });

    expect(plan.changes).toEqual([
      expect.objectContaining({
        ledger_id: "STK-014",
        old_unit_cost: 69,
        new_unit_cost: 68.541667,
        delta_total_cost: -2199.9984,
      }),
    ]);
  });
});
