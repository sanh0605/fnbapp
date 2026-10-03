import { describe, expect, it } from "vitest";
import { buildSevenDayChart, resolveDashboardPeriods } from "./dashboard-periods";

// 2026-09-14T23:30:00Z = 15/09/2026 06:30 Saigon (the shop opens at 6).
const NOW_0630 = new Date("2026-09-14T23:30:00Z");
// 2026-09-30T23:10:00Z = 01/10/2026 06:10 Saigon, first morning of a month.
const FIRST_OF_OCT_0610 = "2026-09-30T23:10:00Z";

describe("resolveDashboardPeriods (A3, A4)", () => {
  it("today: 06:30 on 15/09 is today, an order at 23:00 on 14/09 is yesterday", () => {
    const p = resolveDashboardPeriods("today", NOW_0630);
    expect(p.isCurrent("2026-09-14T23:30:00Z")).toBe(true); // 15/09 06:30
    expect(p.isCurrent("2026-09-14T16:59:59Z")).toBe(false); // 14/09 23:59:59
    expect(p.isPrev("2026-09-14T16:59:59Z")).toBe(true);
    expect(p.isPrev("2026-09-13T17:00:00Z")).toBe(true); // 14/09 00:00
    expect(p.isPrev("2026-09-13T16:59:59Z")).toBe(false); // 13/09 23:59:59
    expect(p.queryStartDate!.getTime()).toBeLessThanOrEqual(new Date("2026-09-13T17:00:00Z").getTime());
  });

  it("this_month: an order at 06:10 on 01/10 counts in October, not September", () => {
    const now = new Date("2026-10-04T03:00:00Z");
    const p = resolveDashboardPeriods("this_month", now);
    expect(p.isCurrent(FIRST_OF_OCT_0610)).toBe(true);
    expect(p.isPrev(FIRST_OF_OCT_0610)).toBe(false);
    // 30/09 23:59:59 Saigon is September, same day-of-month cut-off (04) not reached
    expect(p.isCurrent("2026-09-30T16:59:59Z")).toBe(false);
  });

  it("this_month previous month stops at the same day number, in Saigon days", () => {
    const now = new Date("2026-10-04T03:00:00Z"); // 04/10 10:00 Saigon
    const p = resolveDashboardPeriods("this_month", now);
    // 04/09 06:30 Saigon = 03/09 23:30Z -> inside (day 4 <= 4)
    expect(p.isPrev("2026-09-03T23:30:00Z")).toBe(true);
    // 05/09 00:00 Saigon = 04/09 17:00Z -> outside
    expect(p.isPrev("2026-09-04T17:00:00Z")).toBe(false);
    // 01/09 06:10 Saigon = 31/08 23:10Z -> September, inside
    expect(p.isPrev("2026-08-31T23:10:00Z")).toBe(true);
  });

  it("last_month and this_year bucket 06:xx on the 1st by Saigon month/year", () => {
    const lm = resolveDashboardPeriods("last_month", new Date("2026-10-04T03:00:00Z"));
    expect(lm.isCurrent("2026-08-31T23:30:00Z")).toBe(true); // 01/09 06:30
    expect(lm.isPrev("2026-08-31T23:30:00Z")).toBe(false);
    expect(lm.isPrev("2026-07-31T23:30:00Z")).toBe(true); // 01/08 06:30

    const ty = resolveDashboardPeriods("this_year", new Date("2026-03-10T03:00:00Z"));
    expect(ty.isCurrent("2025-12-31T23:30:00Z")).toBe(true); // 01/01/2026 06:30
    expect(ty.isPrev("2025-12-31T23:30:00Z")).toBe(false);

    const ly = resolveDashboardPeriods("last_year", new Date("2026-03-10T03:00:00Z"));
    expect(ly.isCurrent("2025-12-31T23:30:00Z")).toBe(false);
    expect(ly.isCurrent("2024-12-31T23:30:00Z")).toBe(true); // 01/01/2025 06:30
  });

  it("this_year previous year stops at the same calendar day", () => {
    const p = resolveDashboardPeriods("this_year", new Date("2026-03-10T03:00:00Z"));
    expect(p.isPrev("2025-03-09T23:30:00Z")).toBe(true); // 10/03/2025 06:30
    expect(p.isPrev("2025-03-10T23:30:00Z")).toBe(false); // 11/03/2025 06:30
  });

  it("all keeps everything and has no lower bound", () => {
    const p = resolveDashboardPeriods("all", NOW_0630);
    expect(p.isCurrent("2020-01-01T00:00:00Z")).toBe(true);
    expect(p.queryStartDate).toBeNull();
  });
});

describe("buildSevenDayChart (A5)", () => {
  it("lists the last 7 Saigon days, today last, and puts a 06:30 order on its own day", () => {
    const chart = buildSevenDayChart(
      [
        { created_at: "2026-09-14T23:30:00Z", total_amount: 50000 }, // 15/09 06:30
        { created_at: "2026-09-14T16:59:00Z", total_amount: 20000 }, // 14/09 23:59
        { created_at: "2026-09-01T00:00:00Z", total_amount: 99999 }, // outside the window
      ],
      NOW_0630,
    );
    expect(chart.map(c => c.date)).toEqual(["09/09", "10/09", "11/09", "12/09", "13/09", "14/09", "15/09"]);
    expect(chart[6].amount).toBe(50000);
    expect(chart[5].amount).toBe(20000);
    expect(chart.reduce((s, c) => s + c.amount, 0)).toBe(70000);
  });
});
