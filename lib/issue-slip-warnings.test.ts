import { describe, expect, it } from "vitest";
import { computeAffectedMonths } from "./issue-slip-warnings";

describe("computeAffectedMonths", () => {
  it("returns nothing when the slip is dated in the current month -- nothing closed yet", () => {
    expect(computeAffectedMonths(new Date("2026-08-03T09:00:00"), new Date("2026-08-08T10:00:00"))).toEqual([]);
  });

  it("lists every month from the slip's month through the current month, inclusive", () => {
    expect(computeAffectedMonths(new Date("2026-06-15T09:00:00"), new Date("2026-08-08T10:00:00"))).toEqual([
      "Tháng 6/2026",
      "Tháng 7/2026",
      "Tháng 8/2026",
    ]);
  });

  it("crosses a year boundary correctly", () => {
    expect(computeAffectedMonths(new Date("2025-11-20T09:00:00"), new Date("2026-02-08T10:00:00"))).toEqual([
      "Tháng 11/2025",
      "Tháng 12/2025",
      "Tháng 1/2026",
      "Tháng 2/2026",
    ]);
  });

  it("returns nothing for a future-dated slip -- the RPC refuses it, this is not where that is explained", () => {
    expect(computeAffectedMonths(new Date("2026-09-01T09:00:00"), new Date("2026-08-08T10:00:00"))).toEqual([]);
  });
});
