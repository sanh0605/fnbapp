import { describe, it, expect } from "vitest";
import { toSaigonUtcRange } from "./report-time";

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
