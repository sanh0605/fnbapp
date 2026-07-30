import { describe, expect, it } from "vitest";
import { displayStock, displayMoney } from "./display-rounding";

describe("display-rounding", () => {
  it("rounds a displayed stock quantity DOWN", () => {
    expect(displayStock(123.123456213 + 123 + 10.5)).toBe(256);  // not 257
  });

  it("rounds a displayed cost UP", () => {
    expect(displayMoney(100 + 100.1 + 100.2)).toBe(301);          // not 300
  });

  it("leaves an exact whole number alone in both directions", () => {
    expect(displayStock(256)).toBe(256);
    expect(displayMoney(300)).toBe(300);
  });

  it("rounds each figure from its own exact value, not from rounded parts", () => {
    // Plan's own snippet said "toBe(301)" here, copied from the OTHER worked
    // example above (100 + 100.1 + 100.2 = 300.3, three addends). This test
    // only has two addends: 100.1 + 100.2 = 200.3 exactly, so displayMoney
    // must return 201, not 301 -- fixed to match real arithmetic, not the
    // plan's copy-paste.
    const parts = [100.1, 100.2];
    expect(parts.map(displayMoney)).toEqual([101, 101]);
    expect(displayMoney(parts.reduce((a, b) => a + b, 0))).toBe(201);
    // 101 + 101 = 202 != 201 -- accepted by the owner, must be noted on the report
  });
});
