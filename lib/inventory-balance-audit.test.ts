import { describe, expect, it } from "vitest";
import { auditInventoryBalances } from "./inventory-balance-audit";

describe("auditInventoryBalances", () => {
  it("reports no mismatch when the balance equals the summed ledger", () => {
    const result = auditInventoryBalances(
      [
        { item_reference: "ING-1", quantity_change: 10 },
        { item_reference: "ING-1", quantity_change: -3 },
      ],
      [{ item_reference: "ING-1", quantity: 7 }],
    );
    expect(result.mismatchCount).toBe(0);
    expect(result.itemCount).toBe(1);
  });

  it("flags both a wrong balance and a balance row with no ledger history", () => {
    const result = auditInventoryBalances(
      [{ item_reference: "ING-1", quantity_change: 10 }],
      [
        { item_reference: "ING-1", quantity: 9 },
        { item_reference: "BTP-1", quantity: 0 },
      ],
    );
    expect(result.mismatchCount).toBe(2);
    expect(result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item_reference: "ING-1", reason: "delta", expected: 10, actual: 9, delta: -1 }),
        expect.objectContaining({ item_reference: "BTP-1", reason: "extra", actual: 0 }),
      ]),
    );
  });

  it("flags an item with ledger history but no balance row at all", () => {
    const result = auditInventoryBalances(
      [{ item_reference: "ING-2", quantity_change: 5 }],
      [],
    );
    expect(result.mismatchCount).toBe(1);
    expect(result.mismatches[0]).toMatchObject({ item_reference: "ING-2", reason: "missing", expected: 5 });
  });

  it("ignores blank item references from either source", () => {
    const result = auditInventoryBalances(
      [{ item_reference: "", quantity_change: 5 }],
      [{ item_reference: "  ", quantity: 5 }],
    );
    expect(result.itemCount).toBe(0);
    expect(result.mismatchCount).toBe(0);
  });

  it("treats a delta within tolerance as no mismatch", () => {
    const result = auditInventoryBalances(
      [{ item_reference: "ING-3", quantity_change: 1.0000001 }],
      [{ item_reference: "ING-3", quantity: 1 }],
      0.000001,
    );
    expect(result.mismatchCount).toBe(0);
  });
});
