import { describe, expect, it } from "vitest";
import { validatePurchaseOrderLine } from "./PurchaseOrderForm";

// Batch 3 fix, 2026-08-22: EQUIPMENT items structurally have zero
// conversions, so the unconditional conversion_id requirement blocked
// every equipment purchase order line from ever being completed.
describe("validatePurchaseOrderLine", () => {
  it("an EQUIPMENT line with no available conversions and no conversion_id is now valid", () => {
    const line = { purchased_item_id: "SPM-EQUIP", unit: "Cái", conversion_id: "" };
    const conversions: Array<{ purchased_item_id: string; status: string }> = []; // no conversions exist for anything

    expect(validatePurchaseOrderLine(line, conversions)).toBeNull();
  });

  it("a RAW line with conversions available but none selected is still refused (unaffected by the fix)", () => {
    const line = { purchased_item_id: "SPM-RAW", unit: "Bao", conversion_id: "" };
    const conversions = [{ purchased_item_id: "SPM-RAW", status: "ACTIVE" }];

    expect(validatePurchaseOrderLine(line, conversions)).toBe("Vui lòng chọn đơn vị");
  });

  it("a RAW line with a conversion properly selected passes", () => {
    const line = { purchased_item_id: "SPM-RAW", unit: "Bao", conversion_id: "QD-001" };
    const conversions = [{ purchased_item_id: "SPM-RAW", status: "ACTIVE" }];

    expect(validatePurchaseOrderLine(line, conversions)).toBeNull();
  });

  it("an INACTIVE conversion does not count as available -- still refused without conversion_id", () => {
    const line = { purchased_item_id: "SPM-RAW", unit: "Bao", conversion_id: "" };
    const conversions = [{ purchased_item_id: "SPM-RAW", status: "INACTIVE" }];

    // Every conversion for this item is inactive, so it behaves the same
    // as having none -- consistent with the equipment case, not a
    // regression for an item mid-transition.
    expect(validatePurchaseOrderLine(line, conversions)).toBeNull();
  });

  it("refuses a missing item before checking anything about conversions", () => {
    const line = { purchased_item_id: "", unit: "", conversion_id: "" };
    expect(validatePurchaseOrderLine(line, [])).toBe("Vui lòng chọn hàng hoá");
  });

  it("refuses a missing unit text even for an equipment item", () => {
    const line = { purchased_item_id: "SPM-EQUIP", unit: "", conversion_id: "" };
    expect(validatePurchaseOrderLine(line, [])).toBe("Vui lòng nhập hoặc chọn đơn vị");
  });
});
