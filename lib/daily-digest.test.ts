import { describe, expect, it } from "vitest";
import { shiftDateOnly, getDigestDateOffsets, comparePeriods } from "@/lib/daily-digest";

describe("shiftDateOnly", () => {
  it("shifts backward across a day boundary", () => {
    expect(shiftDateOnly("2026-07-24", -1)).toBe("2026-07-23");
  });

  it("shifts backward across a month boundary", () => {
    expect(shiftDateOnly("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("shifts backward across a year boundary", () => {
    expect(shiftDateOnly("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("shifts backward 7 days for the same-weekday-last-week case", () => {
    expect(shiftDateOnly("2026-07-24", -7)).toBe("2026-07-17");
  });

  it("shifts forward", () => {
    expect(shiftDateOnly("2026-07-24", 1)).toBe("2026-07-25");
  });

  it("throws on a malformed date string", () => {
    expect(() => shiftDateOnly("24-07-2026", -1)).toThrow();
  });
});

describe("getDigestDateOffsets", () => {
  it("returns today unchanged plus yesterday and same-weekday-last-week", () => {
    expect(getDigestDateOffsets("2026-07-24")).toEqual({
      today: "2026-07-24",
      yesterday: "2026-07-23",
      sameWeekdayLastWeek: "2026-07-17",
    });
  });
});

describe("comparePeriods", () => {
  it("computes a positive revenue delta percentage and order count delta", () => {
    const result = comparePeriods({ revenue: 1_500_000, orderCount: 12 }, { revenue: 1_000_000, orderCount: 10 });
    expect(result.revenueDeltaPct).toBe(50);
    expect(result.orderCountDelta).toBe(2);
  });

  it("computes a negative revenue delta percentage and order count delta", () => {
    const result = comparePeriods({ revenue: 500_000, orderCount: 5 }, { revenue: 1_000_000, orderCount: 10 });
    expect(result.revenueDeltaPct).toBe(-50);
    expect(result.orderCountDelta).toBe(-5);
  });

  it("returns null revenueDeltaPct when the previous period had zero revenue, instead of a misleading 0", () => {
    const result = comparePeriods({ revenue: 200_000, orderCount: 2 }, { revenue: 0, orderCount: 0 });
    expect(result.revenueDeltaPct).toBeNull();
    expect(result.orderCountDelta).toBe(2);
  });

  it("returns 0 delta when both periods are identical", () => {
    const result = comparePeriods({ revenue: 1_000_000, orderCount: 10 }, { revenue: 1_000_000, orderCount: 10 });
    expect(result.revenueDeltaPct).toBe(0);
    expect(result.orderCountDelta).toBe(0);
  });
});
