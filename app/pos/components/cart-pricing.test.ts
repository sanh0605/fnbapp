import { describe, expect, it } from "vitest";
import {
  clampDiscount,
  calculateItemTotal,
  calculateItemGross,
  addQuickLine,
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

describe("addQuickLine", () => {
  const product = { id: "p1", name: "Trứng luộc" };
  const v1 = { id: "v1", size_name: "1 trái", price: "5000" };
  const v2 = { id: "v2", size_name: "2 trái", price: 9000 };
  const plain = {
    id: "l1", product_id: "p1", product_name: "Trứng luộc", variant_id: "v1",
    size_name: "1 trái", unit_price: 5000, modifiers: [], qty: 1,
    discount_amount: 0, discount_type: "VND",
  };

  it("adds one line of quantity 1 with a numeric price to an empty cart", () => {
    const cart = addQuickLine([], product, v1);
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({
      product_id: "p1", product_name: "Trứng luộc", variant_id: "v1",
      size_name: "1 trái", unit_price: 5000, modifiers: [], qty: 1,
      discount_amount: 0, discount_type: "VND",
    });
    expect(typeof cart[0].id).toBe("string");
  });

  it("merges the same size into one line of quantity 2", () => {
    const cart = addQuickLine([plain], product, v1);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
  });

  it("starts a new line when the same size has an option", () => {
    const withOption = { ...plain, modifiers: [{ id: "m1", price: 3000 }] };
    const cart = addQuickLine([withOption], product, v1);
    expect(cart).toHaveLength(2);
    expect(cart[0].qty).toBe(1);
  });

  it("starts a new line when the same size has an item discount", () => {
    const cart = addQuickLine([{ ...plain, discount_amount: 2000 }], product, v1);
    expect(cart).toHaveLength(2);
  });

  it("merges into a draft-shaped line that has no modifiers field", () => {
    const { modifiers, ...draftLine } = plain;
    const cart = addQuickLine([draftLine], product, v1);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
  });

  it("starts a new line for a different size of the same dish", () => {
    const cart = addQuickLine([plain], product, v2);
    expect(cart).toHaveLength(2);
    expect(cart[1].variant_id).toBe("v2");
  });

  it("does not mutate the input array or its lines", () => {
    const input = [plain];
    addQuickLine(input, product, v1);
    expect(input).toHaveLength(1);
    expect(plain.qty).toBe(1);
  });
});
