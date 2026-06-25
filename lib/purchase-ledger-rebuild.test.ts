import { describe, expect, it } from "vitest";
import { buildPurchaseReceipt } from "@/lib/purchase-ledger-rebuild";

describe("buildPurchaseReceipt", () => {
  it("uses conversion_id as the source of truth for raw item ledger quantity", () => {
    const receipt = buildPurchaseReceipt({
      po: po(),
      line: line({ conversion_id: "QD-1000" }),
      item: item(),
      conversions: [
        conversion({ id: "QD-100", conversion_rate: "100" }),
        conversion({ id: "QD-1000", conversion_rate: "1000" }),
      ],
    });

    expect(receipt).toMatchObject({
      item_reference: "ING-001",
      quantity_change: 1000,
      unit_cost: 100,
      conversion_id: "QD-1000",
    });
  });

  it("rejects ambiguous conversion fallback instead of guessing", () => {
    expect(() =>
      buildPurchaseReceipt({
        po: po(),
        line: line({ conversion_id: "" }),
        item: item(),
        conversions: [
          conversion({ id: "QD-100", conversion_rate: "100" }),
          conversion({ id: "QD-1000", conversion_rate: "1000" }),
        ],
      }),
    ).toThrow(/Quy đổi mơ hồ/);
  });

  it("rejects a conversion_id from another purchased item", () => {
    expect(() =>
      buildPurchaseReceipt({
        po: po(),
        line: line({ conversion_id: "QD-OTHER" }),
        item: item(),
        conversions: [
          conversion({
            id: "QD-OTHER",
            purchased_item_id: "SPM-OTHER",
            conversion_rate: "500",
          }),
        ],
      }),
    ).toThrow(/không thuộc mặt hàng/);
  });
});

function po() {
  return {
    id: "PO-001",
    subtotal_amount: "100000",
    shipping_fee: "0",
    tax_amount: "0",
    voucher_amount: "0",
    discount_amount: "0",
  };
}

function line(overrides: Record<string, string>) {
  return {
    id: "POL-001",
    purchased_item_id: "SPM-001",
    unit: "U-BOX",
    quantity: "1",
    subtotal: "100000",
    conversion_id: "QD-1000",
    ...overrides,
  };
}

function item() {
  return {
    id: "SPM-001",
    base_ingredient_id: "ING-001",
  };
}

function conversion(overrides: Record<string, string>) {
  return {
    id: "QD-1000",
    purchased_item_id: "SPM-001",
    purchased_unit: "U-BOX",
    conversion_rate: "1000",
    ...overrides,
  };
}
