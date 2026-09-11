import { describe, expect, it } from "vitest";
import { displayStock, displayMoney } from "./display-rounding";

// BR-DATA-005 (owner, 2026-09-11): exact everywhere, rounded only on
// screen, to the nearest whole unit. Replaces the directional rule of
// 2026-07-30 (money up, stock down).
describe("display-rounding", () => {
  it("rounds money to the nearest đồng, halves away from zero", () => {
    expect(displayMoney(100.4)).toBe(100);
    expect(displayMoney(100.5)).toBe(101);
    expect(displayMoney(100.6)).toBe(101);
    expect(displayMoney(-32_372_968.5)).toBe(-32_372_969);
    expect(displayMoney(-32_372_968.4)).toBe(-32_372_968);
  });

  it("rounds a stock quantity the same way -- no longer always down", () => {
    expect(displayStock(123.123456213 + 123 + 10.5)).toBe(257); // 256.62... was 256 under the old rule
    expect(displayStock(256.4)).toBe(256);
  });

  it("leaves an exact whole number alone", () => {
    expect(displayStock(256)).toBe(256);
    expect(displayMoney(300)).toBe(300);
  });

  it("never shows minus zero", () => {
    expect(Object.is(displayMoney(-0.3), 0)).toBe(true);
    expect(Object.is(displayStock(-0.0000001), 0)).toBe(true);
  });

  it("rounds a half the way a calculator does even when binary floating point lands a hair below it", () => {
    // 1.005 * 1000 / 10 is 100,5 on paper but 100.49999999999999 in JavaScript
    expect(displayMoney(1.005 * 1000 / 10)).toBe(101);
    expect(displayMoney(0.145 * 100)).toBe(15); // 14.499999999999998
  });

  it("200.000đ over 6 months: each month shows 33.333, the exact total shows 200.000", () => {
    const month = 200_000 / 6;
    expect(displayMoney(month)).toBe(33_333);
    expect(displayMoney(month * 6)).toBe(200_000);
  });

  it("rounds each figure from its own exact value, not from rounded parts", () => {
    const parts = [100.4, 100.4, 100.4];
    expect(parts.map(displayMoney)).toEqual([100, 100, 100]);
    expect(displayMoney(parts.reduce((a, b) => a + b, 0))).toBe(301);
    // 100 + 100 + 100 = 300 != 301 -- accepted by the owner; the screen notes it
  });
});
