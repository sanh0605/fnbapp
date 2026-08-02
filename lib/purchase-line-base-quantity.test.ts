import { describe, it, expect } from "vitest";
import { computeBaseQuantity } from "@/lib/purchase-line-base-quantity";

describe("computeBaseQuantity", () => {
  // The three real lines verified against the ledger on 2026-08-02.
  it("multiplies the purchase quantity by the conversion rate", () => {
    expect(computeBaseQuantity({ quantity: 1 }, { conversion_rate: 500 })).toBe(500);
    expect(computeBaseQuantity({ quantity: 1 }, { conversion_rate: 1000 })).toBe(1000);
    expect(computeBaseQuantity({ quantity: 3 }, { conversion_rate: 500 })).toBe(1500);
  });

  it("accepts the string forms the database returns", () => {
    expect(computeBaseQuantity({ quantity: "2" }, { conversion_rate: "500" })).toBe(1000);
  });

  // A missing or zero rate must not silently produce 0, which would look like
  // a successful backfill while destroying the quantity.
  it("throws rather than returning zero when the rate is unusable", () => {
    expect(() => computeBaseQuantity({ quantity: 1 }, { conversion_rate: 0 }))
      .toThrow(/conversion rate/i);
    expect(() => computeBaseQuantity({ quantity: 1 }, {}))
      .toThrow(/conversion rate/i);
  });

  it("throws when the purchase quantity is missing", () => {
    expect(() => computeBaseQuantity({}, { conversion_rate: 500 }))
      .toThrow(/quantity/i);
  });
});
