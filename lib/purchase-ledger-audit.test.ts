import { describe, expect, it } from "vitest";
import { auditPurchaseLedger } from "@/lib/purchase-ledger-audit";

describe("auditPurchaseLedger", () => {
  it("classifies missing conversion_id as safe backfill when there is one matching conversion", () => {
    const report = auditPurchaseLedger({
      purchaseOrders: [completedPo("PO-001")],
      purchaseOrderLines: [poLine({ id: "POL-1", po_id: "PO-001", conversion_id: "" })],
      purchasedItems: [rawItem()],
      conversions: [conversion({ id: "QD-1", conversion_rate: "1000" })],
      stockLedger: [ledgerEntry({ reference_id: "PO-001", quantity_change: "1000", unit_cost: "100" })],
    });

    expect(report.safeBackfills).toEqual([
      expect.objectContaining({
        line_id: "POL-1",
        po_id: "PO-001",
        conversion_id: "QD-1",
        conversion_rate: 1000,
      }),
    ]);
    expect(report.ambiguousLines).toHaveLength(0);
    expect(report.ledgerMismatches).toHaveLength(0);
  });

  it("does not guess when a missing conversion_id has multiple matching conversions", () => {
    const report = auditPurchaseLedger({
      purchaseOrders: [completedPo("PO-001")],
      purchaseOrderLines: [poLine({ id: "POL-1", po_id: "PO-001", conversion_id: "" })],
      purchasedItems: [rawItem()],
      conversions: [
        conversion({ id: "QD-100", conversion_rate: "100" }),
        conversion({ id: "QD-1000", conversion_rate: "1000" }),
      ],
      stockLedger: [],
    });

    expect(report.safeBackfills).toHaveLength(0);
    expect(report.ambiguousLines).toEqual([
      expect.objectContaining({
        line_id: "POL-1",
        po_id: "PO-001",
        candidate_conversion_ids: ["QD-100", "QD-1000"],
      }),
    ]);
  });

  it("reports ledger quantity and unit cost mismatches when conversion_id is known", () => {
    const report = auditPurchaseLedger({
      purchaseOrders: [completedPo("PO-001")],
      purchaseOrderLines: [poLine({ id: "POL-1", po_id: "PO-001", conversion_id: "QD-1" })],
      purchasedItems: [rawItem()],
      conversions: [conversion({ id: "QD-1", conversion_rate: "1000" })],
      stockLedger: [ledgerEntry({ reference_id: "PO-001", quantity_change: "100", unit_cost: "1000" })],
    });

    expect(report.ledgerMismatches).toEqual([
      expect.objectContaining({
        po_id: "PO-001",
        item_reference: "ING-001",
        expected_quantity: 1000,
        actual_quantity: 100,
        expected_unit_cost: 100,
        actual_unit_cost: 1000,
      }),
    ]);
  });

  it("does not resolve a conversion_id that belongs to another purchased item", () => {
    const report = auditPurchaseLedger({
      purchaseOrders: [completedPo("PO-001")],
      purchaseOrderLines: [poLine({ id: "POL-1", po_id: "PO-001", conversion_id: "QD-OTHER" })],
      purchasedItems: [rawItem()],
      conversions: [
        conversion({
          id: "QD-OTHER",
          purchased_item_id: "SPM-OTHER",
          conversion_rate: "500",
        }),
      ],
      stockLedger: [],
    });

    expect(report.missingConversions).toEqual([
      expect.objectContaining({
        line_id: "POL-1",
        po_id: "PO-001",
        purchased_item_id: "SPM-001",
      }),
    ]);
    expect(report.ledgerMismatches).toHaveLength(0);
  });
});

function completedPo(id: string) {
  return {
    id,
    status: "COMPLETED",
    subtotal_amount: "100000",
    shipping_fee: "0",
    tax_amount: "0",
    voucher_amount: "0",
    discount_amount: "0",
    transaction_date: "2026-06-01T00:00:00Z",
  };
}

function poLine(overrides: Record<string, string>) {
  return {
    id: "POL-1",
    po_id: "PO-001",
    purchased_item_id: "SPM-001",
    unit: "U-BOX",
    quantity: "1",
    subtotal: "100000",
    conversion_id: "QD-1",
    ...overrides,
  };
}

function rawItem() {
  return {
    id: "SPM-001",
    name: "Raw item",
    base_ingredient_id: "ING-001",
  };
}

function conversion(overrides: Record<string, string>) {
  return {
    id: "QD-1",
    purchased_item_id: "SPM-001",
    purchased_unit: "U-BOX",
    base_unit: "U-G",
    conversion_rate: "1000",
    ...overrides,
  };
}

function ledgerEntry(overrides: Record<string, string>) {
  return {
    id: "STK-1",
    transaction_type: "PO_RECEIPT",
    reference_id: "PO-001",
    item_reference: "ING-001",
    quantity_change: "1000",
    unit_cost: "100",
    created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}
