import { describe, expect, it } from "vitest";
import { compareLabel, comparePeriods, percentChange } from "./compare-periods";

const T = "2026-10-09"; // Friday
const v = (preset: string, start: string, end: string) => ({ preset, start, end }) as any;
const prev = (start: string, end: string) => ({ kind: "PREVIOUS", start, end });

describe("comparePeriods -- the spec's table, on Friday 09/10/2026", () => {
  it.each([
    ["TODAY", "2026-10-09", "2026-10-09", "2026-10-09", "2026-10-09",
      [{ kind: "DAY_BEFORE", start: "2026-10-08", end: "2026-10-08" }, { kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-10-02", end: "2026-10-02" }]],
    ["YESTERDAY", "2026-10-08", "2026-10-08", "2026-10-08", "2026-10-08",
      [{ kind: "DAY_BEFORE", start: "2026-10-07", end: "2026-10-07" }, { kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-10-01", end: "2026-10-01" }]],
    ["CUSTOM", "2026-09-15", "2026-09-15", "2026-09-15", "2026-09-15",
      [{ kind: "DAY_BEFORE", start: "2026-09-14", end: "2026-09-14" }, { kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-09-08", end: "2026-09-08" }]],
    ["LAST_7_DAYS", "2026-10-02", "2026-10-08", "2026-10-02", "2026-10-08", [prev("2026-09-25", "2026-10-01")]],
    ["LAST_28_DAYS", "2026-09-11", "2026-10-08", "2026-09-11", "2026-10-08", [prev("2026-08-14", "2026-09-10")]],
    ["LAST_30_DAYS", "2026-09-09", "2026-10-08", "2026-09-09", "2026-10-08", [prev("2026-08-10", "2026-09-08")]],
    ["THIS_WEEK", "2026-10-05", "2026-10-11", "2026-10-05", "2026-10-09", [prev("2026-09-28", "2026-10-02")]],
    ["LAST_WEEK", "2026-09-28", "2026-10-04", "2026-09-28", "2026-10-04", [prev("2026-09-21", "2026-09-27")]],
    ["THIS_MONTH", "2026-10-01", "2026-10-31", "2026-10-01", "2026-10-09", [prev("2026-09-01", "2026-09-09")]],
    ["MONTH_TO_DATE", "2026-10-01", "2026-10-09", "2026-10-01", "2026-10-09", [prev("2026-09-01", "2026-09-09")]],
    ["LAST_MONTH", "2026-09-01", "2026-09-30", "2026-09-01", "2026-09-30", [prev("2026-08-01", "2026-08-31")]],
    ["THIS_QUARTER", "2026-10-01", "2026-12-31", "2026-10-01", "2026-10-09", [prev("2026-07-01", "2026-07-09")]],
    ["LAST_QUARTER", "2026-07-01", "2026-09-30", "2026-07-01", "2026-09-30", [prev("2026-04-01", "2026-06-30")]],
    ["THIS_YEAR", "2026-01-01", "2026-12-31", "2026-01-01", "2026-10-09", [prev("2025-01-01", "2025-10-09")]],
    ["YEAR_TO_DATE", "2026-01-01", "2026-10-09", "2026-01-01", "2026-10-09", [prev("2025-01-01", "2025-10-09")]],
    ["LAST_YEAR", "2025-01-01", "2025-12-31", "2025-01-01", "2025-12-31", [prev("2024-01-01", "2024-12-31")]],
    ["CUSTOM", "2026-09-15", "2026-09-24", "2026-09-15", "2026-09-24", [prev("2026-09-05", "2026-09-14")]],
    ["CUSTOM", "2026-10-01", "2026-10-20", "2026-10-01", "2026-10-09", [prev("2026-09-22", "2026-09-30")]],
  ])("%s %s..%s", (preset, start, end, curStart, curEnd, previous) => {
    expect(comparePeriods(v(preset, start, end), T)).toEqual({ current: { start: curStart, end: curEnd }, previous });
  });
});

describe("comparePeriods -- edges", () => {
  it("Tháng này on the 31st is a whole month: all of September", () => {
    expect(comparePeriods(v("THIS_MONTH", "2026-10-01", "2026-10-31"), "2026-10-31").previous).toEqual([prev("2026-09-01", "2026-09-30")]);
  });
  it("Quý này on 30/11 clamps nothing and stops at 30/08", () => {
    expect(comparePeriods(v("THIS_QUARTER", "2026-10-01", "2026-12-31"), "2026-11-30").previous).toEqual([prev("2026-07-01", "2026-08-30")]);
  });
  it("Năm nay on 29/02/2028 compares with 01/01–28/02/2027", () => {
    expect(comparePeriods(v("THIS_YEAR", "2028-01-01", "2028-12-31"), "2028-02-29").previous).toEqual([prev("2027-01-01", "2027-02-28")]);
  });
  it("Quý trước in January is Q4 against Q3", () => {
    expect(comparePeriods(v("LAST_QUARTER", "2026-10-01", "2026-12-31"), "2027-01-15").previous).toEqual([prev("2026-07-01", "2026-09-30")]);
  });
  it("Tháng này on the 1st is a month with one day so far: one compare, 01/09", () => {
    expect(comparePeriods(v("THIS_MONTH", "2026-10-01", "2026-10-31"), "2026-10-01")).toEqual({
      current: { start: "2026-10-01", end: "2026-10-01" }, previous: [prev("2026-09-01", "2026-09-01")],
    });
  });
  it("a range starting after today has nothing to compare", () => {
    expect(comparePeriods(v("CUSTOM", "2026-10-15", "2026-10-20"), T)).toEqual({ current: null, previous: [] });
  });
});

describe("compareLabel", () => {
  const today = { start: T, end: T };
  it("the day before today is 'hôm qua'", () => {
    expect(compareLabel({ kind: "DAY_BEFORE", start: "2026-10-08", end: "2026-10-08" }, today, T)).toBe("so với hôm qua");
  });
  it("the day before another day names the date", () => {
    expect(compareLabel({ kind: "DAY_BEFORE", start: "2026-10-07", end: "2026-10-07" }, { start: "2026-10-08", end: "2026-10-08" }, T)).toBe("so với 07/10");
  });
  it("the same weekday names the weekday", () => {
    expect(compareLabel({ kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-10-02", end: "2026-10-02" }, today, T)).toBe("so với thứ Sáu 02/10");
    expect(compareLabel({ kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-10-04", end: "2026-10-04" }, { start: "2026-10-11", end: "2026-10-11" }, T)).toBe("so với Chủ nhật 04/10");
  });
  it("a period names its days, with the year only when it is not this year", () => {
    expect(compareLabel(prev("2026-09-01", "2026-09-09") as any, { start: "2026-10-01", end: T }, T)).toBe("so với 01/09 – 09/09");
    expect(compareLabel(prev("2025-01-01", "2025-10-09") as any, { start: "2026-01-01", end: T }, T)).toBe("so với 01/01/2025 – 09/10/2025");
  });
});

describe("percentChange", () => {
  it("is the change against the previous figure", () => {
    expect(percentChange(6563000, 4199000)).toBeCloseTo(56.2991, 3);
    expect(percentChange(838000, 1021000)).toBeCloseTo(-17.9236, 3);
  });
  it("is null when the previous figure is 0", () => {
    expect(percentChange(838000, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});
