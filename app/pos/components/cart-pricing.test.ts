import { describe, expect, it } from "vitest";
import {
  clampDiscount,
  calculateItemTotal,
  calculateItemGross,
  addOrMergeLine,
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

describe("addOrMergeLine", () => {
  const sweet = { id: "opt-it-ngot", name: "Ít ngọt", price: 0 };
  const ice = { id: "opt-it-da", name: "Ít đá", price: 0 };
  const cream = { id: "opt-kem-muoi", name: "Kem muối", price: 4000 };
  const base = { product_id: "p-cfd", product_name: "Cà phê đá", variant_id: "v-360", size_name: "360ml",
    unit_price: 15000, qty: 2, discount_amount: 0, discount_type: "VND", modifiers: [sweet, ice, cream] };

  it("appends a line with a fresh id to an empty cart", () => {
    const cart = addOrMergeLine([], base);
    expect(cart).toHaveLength(1);
    expect(typeof cart[0].id).toBe("string");
    expect(cart[0].qty).toBe(2);
  });
  it("merges the same choices tapped in another order", () => {
    const cart = addOrMergeLine(addOrMergeLine([], base), { ...base, qty: 1, modifiers: [cream, ice, sweet] });
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(3);
  });
  it("keeps a separate line when one option differs", () => {
    const none = { id: "opt-khong-duong", name: "Không đường", price: 0 };
    expect(addOrMergeLine(addOrMergeLine([], base), { ...base, qty: 1, modifiers: [none, ice, cream] })).toHaveLength(2);
  });
  it("counts portions: one Kem muối is not two", () => {
    expect(addOrMergeLine(addOrMergeLine([], base), { ...base, modifiers: [sweet, ice, cream, cream] })).toHaveLength(2);
  });
  it("keeps a separate line for another size", () => {
    expect(addOrMergeLine(addOrMergeLine([], base), { ...base, variant_id: "v-500", unit_price: 18000 })).toHaveLength(2);
  });
  it("keeps a separate line when the unit price differs (old draft)", () => {
    expect(addOrMergeLine(addOrMergeLine([], base), { ...base, unit_price: 14000 })).toHaveLength(2);
  });
  it("never merges lines that carry an item discount, so each keeps its own 2.000đ off", () => {
    const off = { ...base, qty: 1, discount_amount: 2000 };
    const cart = addOrMergeLine(addOrMergeLine([], off), off);
    expect(cart).toHaveLength(2);
    expect(cart.map((l: any) => l.qty)).toEqual([1, 1]);
  });
  it("does not merge a plain line into a discounted one", () => {
    expect(addOrMergeLine(addOrMergeLine([], { ...base, discount_amount: 2000 }), base)).toHaveLength(2);
  });
  it("does not mutate the input", () => {
    const input = addOrMergeLine([], base);
    const snapshot = JSON.stringify(input);
    addOrMergeLine(input, base);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
