import { describe, expect, it } from "vitest";
import { buildSevenDayChart, dashboardQueryStart, inSaigonDayRange } from "./dashboard-periods";

// 2026-09-14T23:30:00Z = 15/09/2026 06:30 Saigon (the shop opens at 6).
const NOW_0630 = new Date("2026-09-14T23:30:00Z");

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

// BR-UI-007: whole Saigon days for any range the shared filter gives.
describe("inSaigonDayRange", () => {
  const oct = { start: "2026-10-01", end: "2026-10-31" };
  it("06:10 on 01/10 Saigon (23:10 UTC on 30/09) is in October", () => {
    expect(inSaigonDayRange("2026-09-30T23:10:00Z", oct)).toBe(true);
  });
  it("23:00 on 30/09 Saigon (16:00 UTC) is not", () => {
    expect(inSaigonDayRange("2026-09-30T16:00:00Z", oct)).toBe(false);
  });
  it("23:59 on 31/10 Saigon is in, 00:00 on 01/11 Saigon is out", () => {
    expect(inSaigonDayRange("2026-10-31T16:59:00Z", oct)).toBe(true);
    expect(inSaigonDayRange("2026-10-31T17:00:00Z", oct)).toBe(false);
  });
});

describe("dashboardQueryStart", () => {
  it("reaches back to the earliest compare start in Saigon", () => {
    const now = new Date("2026-10-09T09:00:00Z");
    expect(dashboardQueryStart([{ start: "2026-10-01", end: "2026-10-09" }, { start: "2026-09-01", end: "2026-09-09" }], now).toISOString())
      .toBe("2026-08-31T17:00:00.000Z");
  });
  it("never later than the 7-day chart's first day", () => {
    const now = new Date("2026-10-09T09:00:00Z");
    expect(dashboardQueryStart([{ start: "2026-10-09", end: "2026-10-09" }], now).toISOString()).toBe("2026-10-02T17:00:00.000Z");
  });
});
