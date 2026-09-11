import { describe, expect, it } from "vitest";
import { resolveDateRange } from "./resolve-date-range";

// M1 (final-review.md): a hand-edited URL like
// ?preset=CUSTOM&start=abc&end=x previously reached findAllWhere with an
// unparsable date and threw; a start after the end returned an empty list
// with no explanation. Both now fall back to THIS_MONTH instead.
describe("resolveDateRange", () => {
  const today = "2026-09-15";

  it("uses the custom start/end from the URL when both are valid dates in order", () => {
    const r = resolveDateRange("CUSTOM", "2026-07-01", "2026-07-31", today);
    expect(r).toEqual({ preset: "CUSTOM", start: "2026-07-01", end: "2026-07-31" });
  });

  it("falls back to THIS_MONTH when start is not a YYYY-MM-DD date", () => {
    const r = resolveDateRange("CUSTOM", "abc", "2026-07-31", today);
    expect(r.preset).toBe("THIS_MONTH");
    expect(r.start).toBe("2026-09-01");
    expect(r.end).toBe("2026-09-30");
  });

  it("falls back to THIS_MONTH when end is not a YYYY-MM-DD date", () => {
    const r = resolveDateRange("CUSTOM", "2026-07-01", "x", today);
    expect(r.preset).toBe("THIS_MONTH");
  });

  it("falls back to THIS_MONTH when start is after end", () => {
    const r = resolveDateRange("CUSTOM", "2026-07-31", "2026-07-01", today);
    expect(r.preset).toBe("THIS_MONTH");
    expect(r.start).toBe("2026-09-01");
    expect(r.end).toBe("2026-09-30");
  });

  it("falls back to THIS_MONTH when CUSTOM has no start/end at all", () => {
    const r = resolveDateRange("CUSTOM", undefined, undefined, today);
    expect(r.preset).toBe("THIS_MONTH");
  });

  it("resolves an ordinary preset untouched", () => {
    const r = resolveDateRange("LAST_MONTH", undefined, undefined, today);
    expect(r).toEqual({ preset: "LAST_MONTH", start: "2026-08-01", end: "2026-08-31" });
  });

  it("falls back to THIS_MONTH for an unknown preset key", () => {
    const r = resolveDateRange("NOT_A_PRESET", undefined, undefined, today);
    expect(r.preset).toBe("THIS_MONTH");
  });

  // M1 residuals (residuals-fix-brief.md item 1): the old check was a regex
  // on digit shape only, so a calendar-invalid date like 2026-02-30 passed
  // it and reached findAllWhere as a Postgres `date` filter, throwing the
  // page. A date now counts as valid only if it round-trips through
  // Date.UTC unchanged.
  it("falls back to THIS_MONTH for 2026-02-30 -- February never has 30 days", () => {
    const r = resolveDateRange("CUSTOM", "2026-02-30", "2026-03-01", today);
    expect(r.preset).toBe("THIS_MONTH");
  });

  it("falls back to THIS_MONTH for 2026-13-01 -- there is no month 13", () => {
    const r = resolveDateRange("CUSTOM", "2026-13-01", "2026-12-31", today);
    expect(r.preset).toBe("THIS_MONTH");
  });

  it("falls back to THIS_MONTH for 2026-00-10 -- there is no month 0", () => {
    const r = resolveDateRange("CUSTOM", "2026-00-10", "2026-01-10", today);
    expect(r.preset).toBe("THIS_MONTH");
  });

  it("falls back to THIS_MONTH for 2026-02-29 -- 2026 is not a leap year", () => {
    const r = resolveDateRange("CUSTOM", "2026-02-01", "2026-02-29", today);
    expect(r.preset).toBe("THIS_MONTH");
  });

  it("accepts 2028-02-29 -- 2028 is a leap year", () => {
    const r = resolveDateRange("CUSTOM", "2028-02-29", "2028-03-01", today);
    expect(r).toEqual({ preset: "CUSTOM", start: "2028-02-29", end: "2028-03-01" });
  });

  it("accepts 2026-09-30 -- September has 30 days", () => {
    const r = resolveDateRange("CUSTOM", "2026-09-01", "2026-09-30", today);
    expect(r).toEqual({ preset: "CUSTOM", start: "2026-09-01", end: "2026-09-30" });
  });
});
