import { describe, expect, it } from "vitest";
import {
  buildPurchaseReceipt,
  buildPurchaseReceiptLedgerEntry,
} from "@/lib/purchase-ledger-rebuild";

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
          // 2026-08-22 fix (OPEN-ITEMS 56): the item's OWN conversion must
          // be present for this fixture to be realistic -- buildPurchaseReceipt
          // is always called with the complete conversions table in
          // production, so SPM-001 (a real RAW item) always has at least
          // one of its own. Without it, itemHasAnyConversion would (correctly)
          // read false and fall to the equipment-style rate-1 path before
          // ever reaching the mismatch this test means to catch.
          conversion({ id: "QD-1000", purchased_item_id: "SPM-001", conversion_rate: "1000" }),
          conversion({
            id: "QD-OTHER",
            purchased_item_id: "SPM-OTHER",
            conversion_rate: "500",
          }),
        ],
      }),
    ).toThrow(/không thuộc mặt hàng/);
  });

  it("refuses a stored conversion rate of zero instead of costing nothing, in Vietnamese", () => {
    expect(() =>
      buildPurchaseReceipt({
        po: po(),
        line: line({ conversion_id: "QD-1000" }),
        item: item(),
        conversions: [conversion({ id: "QD-1000", conversion_rate: "0" })],
      }),
    ).toThrow(/SPM-001.*tỷ lệ quy đổi không dùng được/);
  });

  it("refuses a completed line with zero quantity but real money, in Vietnamese", () => {
    expect(() =>
      buildPurchaseReceipt({
        po: po(),
        line: line({ conversion_id: "QD-1000", quantity: "0", subtotal: "100000" }),
        item: item(),
        conversions: [conversion({ id: "QD-1000", conversion_rate: "1000" })],
      }),
    ).toThrow(/SPM-001.*không có số lượng hợp lệ/);
  });
});

// OPEN-ITEMS 56 (docs/superpowers/plans/2026-08-22-consumable-purchase-base-quantity.md):
// base_ingredient_id used to be the same question as "does this item have a
// conversion" -- true until batch 1 gave CONSUMABLE items their own
// conversions too. A CONSUMABLE item has no base_ingredient_id, so it used
// to fall to rate 1 regardless of a real conversion sitting right there.
describe("buildPurchaseReceipt -- CONSUMABLE items resolve their own conversion (OPEN-ITEMS 56)", () => {
  it("Ống hút nhỏ, Bao = 500 g, buying 2 Bao: quantity_change is 1000 g, not 2 bao", () => {
    const receipt = buildPurchaseReceipt({
      po: po(),
      line: line({ purchased_item_id: "SPM-053", conversion_id: "QD-BAO", quantity: "2", subtotal: "100000" }),
      item: { id: "SPM-053" }, // CONSUMABLE: no base_ingredient_id
      conversions: [
        { id: "QD-BAO", purchased_item_id: "SPM-053", purchased_unit: "Bao", conversion_rate: "500" },
      ],
    });

    expect(receipt.quantity_change).toBe(1000);
    // 100.000d / 1000 g = 100d/g, not 100.000d / 2 bao = 50.000d/bao.
    expect(receipt.unit_cost).toBe(100);
  });

  it("a CONSUMABLE line with no resolvable conversion still refuses visibly -- no second guard needed", () => {
    expect(() =>
      buildPurchaseReceipt({
        po: po(),
        line: line({ purchased_item_id: "SPM-053", conversion_id: "", unit: "Bao" }),
        item: { id: "SPM-053" },
        conversions: [
          { id: "QD-BAO", purchased_item_id: "SPM-053", purchased_unit: "Thùng", conversion_rate: "500" },
        ], // exists, but no unit named "Bao" -- resolveConversion must still refuse
      }),
    ).toThrow(/Thiếu quy đổi/);
  });

  it("a CONSUMABLE line resolves against a now-INACTIVE conversion, same as RAW already does", () => {
    // resolveConversion looks up by id/unit without a status filter -- an
    // item whose only conversion was later deactivated must not silently
    // fall back to rate 1 for an old line that still points at it.
    const receipt = buildPurchaseReceipt({
      po: po(),
      line: line({ purchased_item_id: "SPM-053", conversion_id: "QD-BAO-OLD", quantity: "3" }),
      item: { id: "SPM-053" },
      conversions: [
        { id: "QD-BAO-OLD", purchased_item_id: "SPM-053", purchased_unit: "Bao", conversion_rate: "500", status: "INACTIVE" },
      ],
    });

    expect(receipt.quantity_change).toBe(1500);
  });
});

describe("buildPurchaseReceipt -- EQUIPMENT stays exactly as it is (zero conversions -> rate 1)", () => {
  it("an item with no conversion rows at all keeps quantity_change equal to the raw quantity", () => {
    const receipt = buildPurchaseReceipt({
      po: po(),
      line: line({ purchased_item_id: "SPM-200", conversion_id: "", quantity: "8", subtotal: "761200" }),
      item: { id: "SPM-200" }, // EQUIPMENT: no base_ingredient_id, no conversions exist for it
      conversions: [],
    });

    expect(receipt.quantity_change).toBe(8);
    expect(receipt.unit_cost).toBe(761200 / 8);
    expect(receipt.conversion_id).toBe("");
  });
});

describe("buildPurchaseReceiptLedgerEntry", () => {
  it("preserves decimal unit cost in the stock ledger entry", () => {
    const entry = buildPurchaseReceiptLedgerEntry(
      {
        item_reference: "ING-022",
        quantity_change: 25000,
        unit_cost: 19.6,
        landed_cost_total: 490000,
        conversion_id: "QD-001",
        conversion_rate: 1000,
      },
      {
        id: "STK-001",
        purchaseOrderId: "PO-048",
        createdAt: "2026-06-30T00:00:00.000Z",
      },
    );

    expect(entry.unit_cost).toBe(19.6);
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
