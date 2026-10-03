import { describe, expect, it } from "vitest";
import { pickerDateToIsoDay, isoDayToPickerDate } from "./picker-date";

describe("picker-date", () => {
  it("round trips calendar days correctly", () => {
    for (const iso of ["2026-09-15", "2026-01-01", "2026-12-31"]) {
      const d = isoDayToPickerDate(iso);
      expect(d).not.toBeNull();
      expect(pickerDateToIsoDay(d!)).toBe(iso);
    }
  });

  it("returns null for empty or invalid inputs", () => {
    expect(isoDayToPickerDate("")).toBeNull();
    expect(isoDayToPickerDate("abc")).toBeNull();
    expect(isoDayToPickerDate("2026-13-01")).toBeNull();
    expect(isoDayToPickerDate(null)).toBeNull();
    expect(isoDayToPickerDate(undefined)).toBeNull();
  });
});
