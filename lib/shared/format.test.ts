import { describe, expect, it } from "vitest";
import { formatDecimal, formatNumber } from "./format";

// BR-UI-008 (owner 2026-10-07): comma between thousands, dot before decimals.
describe("formatNumber", () => {
  it("groups thousands with a comma", () => {
    expect(formatNumber(15000)).toBe("15,000");
    expect(formatNumber(1250000)).toBe("1,250,000");
    expect(formatNumber("27100")).toBe("27,100");
  });
  it("rounds to a whole number by default", () => {
    expect(formatNumber(27099.9)).toBe("27,100");
  });
  it("shows exactly two decimals with a dot when asked", () => {
    expect(formatNumber(1250.5, { withDecimals: true })).toBe("1,250.50");
  });
  it("keeps the minus sign", () => {
    expect(formatNumber(-1250000)).toBe("-1,250,000");
  });
  it("shows --- for missing or non-finite values", () => {
    expect(formatNumber(null)).toBe("---");
    expect(formatNumber(undefined)).toBe("---");
    expect(formatNumber(Number.NaN)).toBe("---");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("---");
  });
});

describe("formatDecimal", () => {
  it("keeps up to maxDigits decimals and trims trailing zeros", () => {
    expect(formatDecimal(20.625, { maxDigits: 2 })).toBe("20.63");
    expect(formatDecimal(20.6, { maxDigits: 2 })).toBe("20.6");
    expect(formatDecimal(20, { maxDigits: 2 })).toBe("20");
  });
  it("pads to minDigits", () => {
    expect(formatDecimal(45, { minDigits: 1, maxDigits: 1 })).toBe("45.0");
    expect(formatDecimal(45.34, { minDigits: 1, maxDigits: 1 })).toBe("45.3");
  });
  it("groups thousands", () => {
    expect(formatDecimal(1250000.5, { maxDigits: 3 })).toBe("1,250,000.5");
  });
  it("keeps the minus sign", () => {
    expect(formatDecimal(-100.12, { maxDigits: 2 })).toBe("-100.12");
  });
});
