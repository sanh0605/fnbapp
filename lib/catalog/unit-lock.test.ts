import { describe, expect, it } from "vitest";
import { resolveUnitLock, unitChangeIsRefused, unitLockRefusalMessage } from "./unit-lock";

describe("resolveUnitLock", () => {
  it("is not locked when the item has no purchase or issue history", () => {
    const lock = resolveUnitLock({
      itemConversions: [{ base_unit: "U-TRAI" }],
      hasPurchaseOrderLine: false,
      hasStockIssue: false,
    });
    expect(lock.locked).toBe(false);
    expect(lock.currentBaseUnitId).toBe("U-TRAI");
  });

  it("is locked when the item has a purchase_order_lines row", () => {
    const lock = resolveUnitLock({
      itemConversions: [{ base_unit: "U-TRAI" }],
      hasPurchaseOrderLine: true,
      hasStockIssue: false,
    });
    expect(lock.locked).toBe(true);
  });

  // The gap identified while critiquing the plan: the pre-existing
  // per-conversion checks only ever looked at purchase_order_lines. Not a
  // live exposure today (measured 2026-08-29: 0 items have a stock_issues
  // row without also having a purchase_order_lines row) but closed anyway,
  // since a stocktake can in principle find stock for an item that was
  // never purchased.
  it("is locked when the item has a stock_issues row, even with no purchase_order_lines row at all", () => {
    const lock = resolveUnitLock({
      itemConversions: [{ base_unit: "U-TRAI" }],
      hasPurchaseOrderLine: false,
      hasStockIssue: true,
    });
    expect(lock.locked).toBe(true);
  });

  it("is not locked when the item has no conversions yet, even with history flags set -- nothing on record to protect", () => {
    const lock = resolveUnitLock({
      itemConversions: [],
      hasPurchaseOrderLine: true,
      hasStockIssue: true,
    });
    expect(lock.locked).toBe(false);
    expect(lock.currentBaseUnitId).toBeNull();
  });

  it("reads the current base unit from the item's own first conversion (all of an item's conversions agree today -- verified 2026-08-29, 0 of 146 disagree)", () => {
    const lock = resolveUnitLock({
      itemConversions: [{ base_unit: "U-KG" }, { base_unit: "U-KG" }],
      hasPurchaseOrderLine: true,
      hasStockIssue: false,
    });
    expect(lock.currentBaseUnitId).toBe("U-KG");
  });
});

describe("unitChangeIsRefused", () => {
  it("refuses when locked and the submitted unit differs from the current one", () => {
    const lock = resolveUnitLock({
      itemConversions: [{ base_unit: "U-TRAI" }],
      hasPurchaseOrderLine: true,
      hasStockIssue: false,
    });
    expect(unitChangeIsRefused(lock, "U-KG")).toBe(true);
  });

  it("does not refuse when locked but the submitted unit matches the current one -- other fields stay editable", () => {
    const lock = resolveUnitLock({
      itemConversions: [{ base_unit: "U-TRAI" }],
      hasPurchaseOrderLine: true,
      hasStockIssue: false,
    });
    expect(unitChangeIsRefused(lock, "U-TRAI")).toBe(false);
  });

  it("does not refuse when not locked, regardless of what unit is submitted", () => {
    const lock = resolveUnitLock({
      itemConversions: [{ base_unit: "U-TRAI" }],
      hasPurchaseOrderLine: false,
      hasStockIssue: false,
    });
    expect(unitChangeIsRefused(lock, "U-KG")).toBe(false);
  });
});

describe("unitLockRefusalMessage", () => {
  it("names the current unit and says the change cannot happen, in Vietnamese", () => {
    const message = unitLockRefusalMessage("kg");
    expect(message).toContain('"kg"');
    expect(message).toContain("Không thể đổi đơn vị gốc");
  });
});
