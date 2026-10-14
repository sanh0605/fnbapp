import { describe, expect, it } from "vitest";

import { effectivePaymentRows, normalizePaymentMethod } from "./payment-method";

// B1 (2026-10-14 audit): one rule for an order's payment method everywhere --
// empty means cash, and a split order is read through its order_payments rows.

describe("normalizePaymentMethod", () => {
  it("treats empty, blank, null and undefined as CASH", () => {
    for (const empty of ["", "  ", null, undefined]) {
      expect(normalizePaymentMethod(empty)).toBe("CASH");
    }
  });

  it("keeps a real method as it is", () => {
    expect(normalizePaymentMethod("BANK_TRANSFER")).toBe("BANK_TRANSFER");
    expect(normalizePaymentMethod("CASH")).toBe("CASH");
  });
});

describe("effectivePaymentRows", () => {
  it("one row for the whole net total when the order has no order_payments rows", () => {
    expect(effectivePaymentRows({ payment_method: "BANK_TRANSFER", net_total: 25000 }, []))
      .toEqual([{ method: "BANK_TRANSFER", amount: 25000 }]);
  });

  it("an order with an empty method and no payment rows counts as cash, not UNKNOWN", () => {
    expect(effectivePaymentRows({ payment_method: "", net_total: 25000 }, []))
      .toEqual([{ method: "CASH", amount: 25000 }]);
  });

  it("pins the two-way split: 15.000 cash + 10.000 bank transfer stay two rows summing to the order", () => {
    const rows = effectivePaymentRows(
      { payment_method: "CASH", net_total: 25000 },
      [
        { method: "CASH", amount: "15000" },
        { method: "BANK_TRANSFER", amount: 10000 },
      ],
    );
    expect(rows).toEqual([
      { method: "CASH", amount: 15000 },
      { method: "BANK_TRANSFER", amount: 10000 },
    ]);
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(25000);
  });

  it("an empty method on a payment row also means cash", () => {
    expect(effectivePaymentRows({ payment_method: "CASH", net_total: 5000 }, [{ method: "", amount: 5000 }]))
      .toEqual([{ method: "CASH", amount: 5000 }]);
  });
});
