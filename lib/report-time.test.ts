import { describe, it, expect } from "vitest";
import { toSaigonUtcRange, saigonBucketKeys } from "./report-time";

describe("toSaigonUtcRange", () => {
  it("returns null when startDate is missing", () => {
    expect(toSaigonUtcRange(undefined, "2026-06-25")).toBeNull();
  });

  it("returns null when endDate is missing", () => {
    expect(toSaigonUtcRange("2026-06-25", undefined)).toBeNull();
  });

  it("date-only input: interprets as Asia/Saigon start/end of day", () => {
    // Saigon 2026-06-25T00:00:00+07:00 = UTC 2026-06-24T17:00:00.000Z
    // Saigon 2026-06-25T23:59:59.999+07:00 = UTC 2026-06-25T16:59:59.999Z
    const range = toSaigonUtcRange("2026-06-25", "2026-06-25");
    expect(range).not.toBeNull();
    expect(range!.startUtc.toISOString()).toBe("2026-06-24T17:00:00.000Z");
    expect(range!.endUtc.toISOString()).toBe("2026-06-25T16:59:59.999Z");
  });

  it("date-only range across month boundary", () => {
    // Saigon 2026-05-31T00:00:00+07:00 = UTC 2026-05-30T17:00:00.000Z
    // Saigon 2026-06-30T23:59:59.999+07:00 = UTC 2026-06-30T16:59:59.999Z
    const range = toSaigonUtcRange("2026-05-31", "2026-06-30");
    expect(range!.startUtc.toISOString()).toBe("2026-05-30T17:00:00.000Z");
    expect(range!.endUtc.toISOString()).toBe("2026-06-30T16:59:59.999Z");
  });

  it("full ISO input: passed through unchanged", () => {
    const range = toSaigonUtcRange(
      "2026-05-31T17:00:00.000Z",
      "2026-06-25T16:59:59.999Z",
    );
    expect(range!.startUtc.toISOString()).toBe("2026-05-31T17:00:00.000Z");
    expect(range!.endUtc.toISOString()).toBe("2026-06-25T16:59:59.999Z");
  });

  it("mixed date-only + ISO input", () => {
    const range = toSaigonUtcRange("2026-06-25", "2026-06-25T16:59:59.999Z");
    expect(range!.startUtc.toISOString()).toBe("2026-06-24T17:00:00.000Z");
    expect(range!.endUtc.toISOString()).toBe("2026-06-25T16:59:59.999Z");
  });
});

// docs/superpowers/plans/2026-08-26-sales-chart-timezone.md.
describe("saigonBucketKeys", () => {
  it("crosses the UTC date/month boundary correctly -- the owner's real case", () => {
    // 2026-08-01T06:22:53+07:00 (Saigon) is 2026-07-31T23:22:53.000Z in UTC.
    // toISOString()/getHours() on that UTC instant would read 2026-07-31,
    // 2026-07 and 23:00 -- the exact wrong values reported against the code
    // this replaces.
    const keys = saigonBucketKeys("2026-08-01T06:22:53+07:00");
    expect(keys.dateKey).toBe("2026-08-01");
    expect(keys.monthKey).toBe("2026-08");
    expect(keys.hourKey).toBe("06:00");
  });

  it("does not cross the boundary for a timestamp safely inside the Saigon day", () => {
    const keys = saigonBucketKeys("2026-08-15T14:30:00+07:00");
    expect(keys.dateKey).toBe("2026-08-15");
    expect(keys.monthKey).toBe("2026-08");
    expect(keys.hourKey).toBe("14:00");
  });

  it("returns the day of week the date actually was, Sunday-first (CN = 0)", () => {
    // 2026-01-01 was a Thursday: 2024-01-01 was a Monday (a leap year, so
    // 2025-01-01 is Monday+2 = Wednesday), and 2025 is not a leap year, so
    // 2026-01-01 is Wednesday+1 = Thursday. Thursday -> "T5" in this
    // codebase's ["CN","T2","T3","T4","T5","T6","T7"] labeling.
    expect(saigonBucketKeys("2026-01-01T10:00:00+07:00").dowLabel).toBe("T5");
  });

  it("labels a known Sunday as CN, index 0", () => {
    // 2026-01-04 = 2026-01-01 (Thursday) + 3 days = Sunday.
    expect(saigonBucketKeys("2026-01-04T10:00:00+07:00").dowLabel).toBe("CN");
  });

  it("does not emit hour 24 for Saigon midnight", () => {
    // Some Intl runtimes emit "24" rather than "00" for midnight with
    // hour12: false -- the same guard lib/datetime.ts's getSaigonParts uses.
    expect(saigonBucketKeys("2026-08-01T00:00:00+07:00").hourKey).toBe("00:00");
  });
});
