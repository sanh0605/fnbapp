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
});
