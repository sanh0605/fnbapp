import { describe, expect, it } from "vitest";
import { formatRangeButtonText, readMonthRangeParams, readRangeParams, writeRangeParams } from "./date-range-params";
import { MONTH_PRESET_KEYS, PHONE_PRESET_KEYS, addMonths } from "./date-range-presets";

const TODAY = "2026-10-09"; // a Friday

describe("readRangeParams", () => {
  it("no params gives the page default resolved against today", () => {
    expect(readRangeParams({}, TODAY, "THIS_MONTH")).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
  });
  it("a known range resolves against today", () => {
    expect(readRangeParams({ range: "LAST_7_DAYS" }, TODAY, "THIS_MONTH")).toEqual({ preset: "LAST_7_DAYS", start: "2026-10-02", end: "2026-10-08" });
  });
  it("CUSTOM keeps valid from/to", () => {
    expect(readRangeParams({ range: "CUSTOM", from: "2026-09-15", to: "2026-09-24" }, TODAY, "THIS_MONTH"))
      .toEqual({ preset: "CUSTOM", start: "2026-09-15", end: "2026-09-24" });
  });
  it("from/to without range read as CUSTOM -- the Sổ thu chi day links", () => {
    expect(readRangeParams({ from: "2026-10-05", to: "2026-10-05", payment: "Tien mat" }, TODAY, "THIS_MONTH"))
      .toEqual({ preset: "CUSTOM", start: "2026-10-05", end: "2026-10-05" });
  });
  it("a ready range ignores stray from/to", () => {
    expect(readRangeParams({ range: "YESTERDAY", from: "2026-01-01", to: "2026-01-02" }, TODAY, "THIS_MONTH"))
      .toEqual({ preset: "YESTERDAY", start: "2026-10-08", end: "2026-10-08" });
  });
  it.each([
    [{ range: "NOPE" }],
    [{ range: "CUSTOM", from: "abc", to: "2026-10-01" }],
    [{ range: "CUSTOM", from: "2026-02-30", to: "2026-03-01" }],
    [{ range: "CUSTOM", from: "2026-13-01", to: "2026-12-31" }],
    [{ range: "CUSTOM", from: "2026-10-09", to: "2026-10-01" }],
    [{ range: "CUSTOM", from: "2026-10-01" }],
    [{ from: "2026-10-01" }],
  ])("falls back to the default for %j", params => {
    expect(readRangeParams(params, TODAY, "THIS_MONTH")).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
  });
  it("accepts 29/02 in a leap year", () => {
    expect(readRangeParams({ range: "CUSTOM", from: "2028-02-29", to: "2028-03-01" }, TODAY, "THIS_MONTH").start).toBe("2028-02-29");
  });
  it("takes the first value of a repeated param", () => {
    expect(readRangeParams({ range: ["TODAY", "YESTERDAY"] }, TODAY, "THIS_MONTH").preset).toBe("TODAY");
  });
  it("uses the today it is given -- 06:30 on 01/10 in Saigon is October", () => {
    expect(readRangeParams({}, "2026-10-01", "THIS_MONTH")).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
  });
});

describe("readMonthRangeParams (Lãi lỗ)", () => {
  it("defaults to Năm nay, ending at the current month", () => {
    expect(readMonthRangeParams({}, TODAY)).toEqual({ preset: "THIS_YEAR", start: "2026-01", end: "2026-10" });
  });
  it.each([
    ["THIS_MONTH", "2026-10", "2026-10"],
    ["LAST_MONTH", "2026-09", "2026-09"],
    ["THIS_QUARTER", "2026-10", "2026-10"],
    ["LAST_QUARTER", "2026-07", "2026-09"],
    ["LAST_YEAR", "2025-01", "2025-12"],
    ["YEAR_TO_DATE", "2026-01", "2026-10"],
  ])("%s gives %s..%s", (range, start, end) => {
    expect(readMonthRangeParams({ range }, TODAY)).toEqual({ preset: range, start, end });
  });
  it("Quý trước in January is the last quarter of the year before", () => {
    expect(readMonthRangeParams({ range: "LAST_QUARTER" }, "2027-01-15")).toEqual({ preset: "LAST_QUARTER", start: "2026-10", end: "2026-12" });
  });
  it("CUSTOM months may cross a year", () => {
    expect(readMonthRangeParams({ range: "CUSTOM", from: "2025-07", to: "2026-06" }, TODAY)).toEqual({ preset: "CUSTOM", start: "2025-07", end: "2026-06" });
  });
  it("an old ?year=2025 bookmark opens all of 2025", () => {
    expect(readMonthRangeParams({ year: "2025" }, TODAY)).toEqual({ preset: "CUSTOM", start: "2025-01", end: "2025-12" });
  });
  it.each([
    [{ range: "LAST_7_DAYS" }],
    [{ range: "CUSTOM", from: "2026-13", to: "2026-12" }],
    [{ range: "CUSTOM", from: "2026-06", to: "2026-01" }],
    [{ year: "20x5" }],
  ])("falls back to Năm nay for %j", params => {
    expect(readMonthRangeParams(params, TODAY)).toEqual({ preset: "THIS_YEAR", start: "2026-01", end: "2026-10" });
  });
});

describe("writeRangeParams", () => {
  it("a ready range writes only range and drops from/to; other params stay", () => {
    const p = new URLSearchParams("q=sữa&from=2026-01-01&to=2026-01-31&status=DONE");
    writeRangeParams(p, { preset: "LAST_MONTH", start: "2026-09-01", end: "2026-09-30" });
    expect(p.get("range")).toBe("LAST_MONTH");
    expect(p.has("from")).toBe(false);
    expect(p.has("to")).toBe(false);
    expect(p.get("q")).toBe("sữa");
    expect(p.get("status")).toBe("DONE");
  });
  it("CUSTOM writes range, from and to", () => {
    const p = new URLSearchParams();
    writeRangeParams(p, { preset: "CUSTOM", start: "2026-09-15", end: "2026-09-24" });
    expect(p.toString()).toBe("range=CUSTOM&from=2026-09-15&to=2026-09-24");
  });
});

describe("formatRangeButtonText", () => {
  it("names the range and its days", () => {
    expect(formatRangeButtonText({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" })).toBe("Tháng này · 01/10/2026 – 31/10/2026");
    expect(formatRangeButtonText({ preset: "TODAY", start: "2026-10-09", end: "2026-10-09" })).toBe("Hôm nay · 09/10/2026");
    expect(formatRangeButtonText({ preset: "CUSTOM", start: "2026-09-15", end: "2026-09-24" })).toBe("Tuỳ chọn · 15/09/2026 – 24/09/2026");
  });
  it("month mode writes months", () => {
    expect(formatRangeButtonText({ preset: "THIS_YEAR", start: "2026-01", end: "2026-10" }, "month")).toBe("Năm nay · 01/2026 – 10/2026");
    expect(formatRangeButtonText({ preset: "THIS_MONTH", start: "2026-10", end: "2026-10" }, "month")).toBe("Tháng này · 10/2026");
  });
});

describe("preset lists and helpers", () => {
  it("the phone shows nine buttons in the owner's order", () => {
    expect(PHONE_PRESET_KEYS).toEqual(["TODAY", "YESTERDAY", "THIS_WEEK", "LAST_WEEK", "THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "THIS_YEAR", "CUSTOM"]);
  });
  it("Lãi lỗ offers whole-month ranges only", () => {
    expect(MONTH_PRESET_KEYS).toEqual(["THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "LAST_QUARTER", "THIS_YEAR", "LAST_YEAR", "YEAR_TO_DATE", "CUSTOM"]);
  });
  it("addMonths clamps to the last day of a shorter month", () => {
    expect(addMonths("2026-10-31", -1)).toBe("2026-09-30");
    expect(addMonths("2028-02-29", -12)).toBe("2027-02-28");
    expect(addMonths("2026-01-15", -3)).toBe("2025-10-15");
  });
});
