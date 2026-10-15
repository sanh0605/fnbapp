import { describe, expect, it } from "vitest";
import {
  clampDiscount,
  calculateItemTotal,
  calculateItemGross,
  getRoundNotesAbove,
} from "./cart-pricing";

describe("clampDiscount (R3)", () => {
  it("clamps amount above subtotal to subtotal", () => {
    // Example from brief: order 100.000, cashier types 150.000 -> 100.000
    expect(clampDiscount(150_000, "VND", 100_000)).toBe(100_000);
    expect(clampDiscount(80_000, "VND", 50_000)).toBe(50_000);
  });

  it("clamps negative amount to 0", () => {
    expect(clampDiscount(-10_000, "VND", 100_000)).toBe(0);
    expect(clampDiscount(-1, "PERCENT", 100_000)).toBe(0);
  });

  it("clamps percent above 100 to 100", () => {
    // Example from brief: percent 101 -> 100
    expect(clampDiscount(101, "PERCENT", 100_000)).toBe(100);
    expect(clampDiscount(250, "PERCENT", 50_000)).toBe(100);
  });

  it("preserves valid in-range values", () => {
    expect(clampDiscount(40_000, "VND", 100_000)).toBe(40_000);
    expect(clampDiscount(20, "PERCENT", 100_000)).toBe(20);
    expect(clampDiscount(0, "VND", 100_000)).toBe(0);
    expect(clampDiscount(0, "PERCENT", 100_000)).toBe(0);
  });

  it("handles null or NaN safely", () => {
    expect(clampDiscount(null, "VND", 100_000)).toBeNull();
    expect(clampDiscount(NaN, "PERCENT", 100_000)).toBeNull();
  });
});

describe("calculateItemTotal & calculateItemGross", () => {
  it("calculates gross price from unit price, modifiers, and qty", () => {
    const gross = calculateItemGross({
      unit_price: 30_000,
      qty: 2,
      modifiers: [{ price: 5_000 }, { price: 3_000 }],
    });
    // (30.000 + 5.000 + 3.000) * 2 = 76.000
    expect(gross).toBe(76_000);
  });

  it("calculates net total after flat VND discount", () => {
    const net = calculateItemTotal({
      variant_id: "v1",
      unit_price: 30_000,
      qty: 1,
      modifiers: [{ id: "m1", price: 5_000 }],
      discount_amount: 5_000,
      discount_type: "VND",
    });
    // Gross: 35.000, discount: 5.000 -> 30.000
    expect(net).toBe(30_000);
  });

  it("calculates net total after PERCENT discount", () => {
    const net = calculateItemTotal({
      variant_id: "v1",
      unit_price: 40_000,
      qty: 1,
      modifiers: [],
      discount_amount: 10,
      discount_type: "PERCENT",
    });
    // 40.000 - 10% = 36.000
    expect(net).toBe(36_000);
  });

  it("discount cannot take line total below 0", () => {
    const net = calculateItemTotal({
      variant_id: "v1",
      unit_price: 30_000,
      qty: 1,
      modifiers: [],
      discount_amount: 50_000,
      discount_type: "VND",
    });
    expect(net).toBe(0);
  });
});

describe("getRoundNotesAbove (R2)", () => {
  it("returns round notes strictly above total for 81.000 -> [100.000, 200.000, 500.000]", () => {
    expect(getRoundNotesAbove(81_000)).toEqual([100_000, 200_000, 500_000]);
  });

  it("returns notes above 35.000 -> [50.000, 100.000, 200.000, 500.000]", () => {
    expect(getRoundNotesAbove(35_000)).toEqual([50_000, 100_000, 200_000, 500_000]);
  });

  it("handles totals above 500.000 by returning round multiples", () => {
    const notes = getRoundNotesAbove(520_000);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]).toBe(600_000);
  });
});
