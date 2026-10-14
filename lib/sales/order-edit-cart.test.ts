import { describe, it, expect } from "vitest";
import { planRequestedPayments } from "@/lib/sales/order-edit-cart";

describe("planRequestedPayments (BR-SALE-013)", () => {
  const plan = (requested: unknown, newNet = 18000) => planRequestedPayments(requested, newNet);

  it("saves two parts as sent", () => {
    expect(plan([
      { method: "CASH", amount: 10000, reference: "" },
      { method: "BANK_TRANSFER", amount: 8000, reference: "TX-1" },
    ])).toEqual([
      { method: "CASH", amount: 10000, reference: "" },
      { method: "BANK_TRANSFER", amount: 8000, reference: "TX-1" },
    ]);
  });

  it("one part takes the whole new total", () => {
    expect(plan([{ method: "CASH", amount: 18000, reference: "" }])).toEqual([
      { method: "CASH", amount: 18000, reference: "" },
    ]);
    expect(plan([{ method: "CASH", amount: 9000, reference: "R" }])).toEqual([
      { method: "CASH", amount: 18000, reference: "R" },
    ]);
  });

  it("accepts a changed total when the parts add up to it", () => {
    expect(plan([
      { method: "CASH", amount: 10000, reference: "" },
      { method: "BANK_TRANSFER", amount: 10000, reference: "" },
    ], 20000)).toHaveLength(2);
  });

  it("refuses parts that do not add up, naming both figures", () => {
    expect(() => plan([
      { method: "CASH", amount: 9000, reference: "" },
      { method: "BANK_TRANSFER", amount: 8000, reference: "" },
    ])).toThrow("Tổng các phần thanh toán (17.000đ) phải bằng tiền đơn (18.000đ).");
  });

  it("refuses the same method twice", () => {
    expect(() => plan([
      { method: "CASH", amount: 9000, reference: "" },
      { method: "CASH", amount: 9000, reference: "" },
    ])).toThrow(/mỗi hình thức/i);
  });

  it("refuses untrusted shapes", () => {
    for (const bad of [
      "x", {}, [],
      [{ method: "CARD", amount: 18000 }, { method: "CASH", amount: 0 }],
      [{ method: "CASH", amount: 9000.5 }, { method: "BANK_TRANSFER", amount: 8999.5 }],
      [{ method: "CASH", amount: NaN }, { method: "BANK_TRANSFER", amount: 18000 }],
      [{ method: "CASH", amount: 18000 }, { method: "BANK_TRANSFER", amount: 0 }],
      [null, { method: "CASH", amount: 18000 }],
    ]) {
      expect(() => plan(bad)).toThrow();
    }
  });

});
