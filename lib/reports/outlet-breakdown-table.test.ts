import { describe, expect, it } from "vitest";
import { avgPerOrder, percentOfTotal, formatPercent } from "./outlet-breakdown-table";

describe("avgPerOrder", () => {
  it("divides revenue by orders", () => {
    expect(avgPerOrder(100_000, 4)).toBe(25_000);
  });

  it("returns null (not NaN, not 0) for zero orders", () => {
    expect(avgPerOrder(0, 0)).toBeNull();
    expect(avgPerOrder(5000, 0)).toBeNull();
  });
});

describe("percentOfTotal", () => {
  it("computes a share as a percentage, e.g. 25 not 0.25", () => {
    expect(percentOfTotal(25_000, 100_000)).toBe(25);
  });

  it("returns null when the total is zero", () => {
    expect(percentOfTotal(0, 0)).toBeNull();
  });

  it("three outlets' shares sum to 100 within one decimal of rounding", () => {
    // Exercises rounding, not just the easy 50/50 case -- 100/300 doesn't
    // divide evenly. Plan section 4: assert this on a fixture with three
    // outlets so the rounding is actually exercised.
    const revenues = [1_000_000, 1_500_000, 700_000];
    const total = revenues.reduce((s, r) => s + r, 0);
    const shares = revenues.map(r => percentOfTotal(r, total)!);

    const sum = shares.reduce((s, p) => s + p, 0);
    expect(sum).toBeCloseTo(100, 1);
  });
});

describe("formatPercent", () => {
  it("renders one decimal with a comma, vi-VN style", () => {
    expect(formatPercent(45.3)).toBe("45,3%");
  });

  it("renders an em dash for null", () => {
    expect(formatPercent(null)).toBe("—");
  });

  it("rounds to one decimal", () => {
    expect(formatPercent(33.333333)).toBe("33,3%");
  });
});
