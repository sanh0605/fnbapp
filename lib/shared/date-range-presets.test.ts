import { describe, expect, it } from "vitest";
import { DATE_RANGE_PRESETS, resolvePreset, formatRangeLabel } from "./date-range-presets";

// Tuesday 2026-09-08. Every case below is computed against this one day, so
// the expected values can be checked by hand on a calendar.
const TODAY = "2026-09-08";

describe("date range presets", () => {
  it("offers exactly the list the owner asked for, in his order", () => {
    expect(DATE_RANGE_PRESETS.map((p) => p.key)).toEqual([
      "TODAY", "YESTERDAY",
      "LAST_7_DAYS", "LAST_28_DAYS", "LAST_30_DAYS",
      "THIS_WEEK", "LAST_WEEK",
      "THIS_MONTH", "LAST_MONTH",
      "THIS_QUARTER", "LAST_QUARTER",
      "THIS_YEAR", "LAST_YEAR",
      "MONTH_TO_DATE", "YEAR_TO_DATE",
      "CUSTOM",
    ]);
  });

  it("labels every preset in Vietnamese", () => {
    expect(DATE_RANGE_PRESETS.find((p) => p.key === "THIS_MONTH")!.label).toBe("Tháng này");
    expect(DATE_RANGE_PRESETS.find((p) => p.key === "LAST_QUARTER")!.label).toBe("Quý trước");
    expect(DATE_RANGE_PRESETS.find((p) => p.key === "CUSTOM")!.label).toBe("Tuỳ chọn");
  });

  it.each([
    ["TODAY", "2026-09-08", "2026-09-08"],
    ["YESTERDAY", "2026-09-07", "2026-09-07"],
    // The "last N days" windows end yesterday and exclude today, the way
    // Looker Studio does -- a part-finished today drags every average down.
    ["LAST_7_DAYS", "2026-09-01", "2026-09-07"],
    ["LAST_28_DAYS", "2026-08-11", "2026-09-07"],
    ["LAST_30_DAYS", "2026-08-09", "2026-09-07"],
    // Week starts Monday; 2026-09-08 is a Tuesday.
    ["THIS_WEEK", "2026-09-07", "2026-09-13"],
    ["LAST_WEEK", "2026-08-31", "2026-09-06"],
    ["THIS_MONTH", "2026-09-01", "2026-09-30"],
    ["LAST_MONTH", "2026-08-01", "2026-08-31"],
    ["THIS_QUARTER", "2026-07-01", "2026-09-30"],
    ["LAST_QUARTER", "2026-04-01", "2026-06-30"],
    ["THIS_YEAR", "2026-01-01", "2026-12-31"],
    ["LAST_YEAR", "2025-01-01", "2025-12-31"],
    ["MONTH_TO_DATE", "2026-09-01", "2026-09-08"],
    ["YEAR_TO_DATE", "2026-01-01", "2026-09-08"],
  ] as const)("resolves %s", (key, start, end) => {
    expect(resolvePreset(key, TODAY)).toEqual({ start, end });
  });

  it("crosses a year boundary correctly", () => {
    expect(resolvePreset("LAST_MONTH", "2026-01-15"))
      .toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(resolvePreset("LAST_QUARTER", "2026-01-15"))
      .toEqual({ start: "2025-10-01", end: "2025-12-31" });
  });

  it("handles February in a leap year", () => {
    expect(resolvePreset("THIS_MONTH", "2028-02-10"))
      .toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("leaves CUSTOM for the caller to fill in", () => {
    expect(resolvePreset("CUSTOM", TODAY)).toEqual({ start: "", end: "" });
  });

  it("writes the chosen range the way the owner reads dates", () => {
    expect(formatRangeLabel("2026-09-01", "2026-09-08")).toBe("01/09/2026 – 08/09/2026");
    expect(formatRangeLabel("2026-09-08", "2026-09-08")).toBe("08/09/2026");
    expect(formatRangeLabel("", "")).toBe("");
  });
});
