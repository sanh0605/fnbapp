import { describe, expect, it } from "vitest";
import { computeStocktakeAlerts, negativeStockItems } from "./alerts";

const base = { today: "2026-10-14", staleDays: 30, openDays: 2 };

describe("computeStocktakeAlerts", () => {
  it("STK-001 confirmed 09/08 is 66 days old, over the 30-day limit", () => {
    const r = computeStocktakeAlerts({
      ...base,
      sessions: [{ id: "STK-001", status: "CONFIRMED", created_at: "2026-08-09T01:00:00Z", confirmed_at: "2026-08-09T02:00:00Z", reversed_at: null }],
    });
    expect(r.stale).toEqual({ lastConfirmedDay: "2026-08-09", daysSince: 66 });
    expect(r.openTooLong).toEqual([]);
  });

  it("no alert when the latest confirmed session is within the limit", () => {
    const r = computeStocktakeAlerts({
      ...base,
      sessions: [{ id: "STK-002", status: "CONFIRMED", created_at: "2026-09-14T01:00:00Z", confirmed_at: "2026-09-14T02:00:00Z", reversed_at: null }],
    });
    expect(r.stale).toBeNull(); // exactly 30 days is not over the limit
  });

  it("a reversed session does not count", () => {
    const r = computeStocktakeAlerts({
      ...base,
      sessions: [
        { id: "STK-001", status: "CONFIRMED", created_at: "2026-08-09T01:00:00Z", confirmed_at: "2026-08-09T02:00:00Z", reversed_at: null },
        { id: "STK-002", status: "CONFIRMED", created_at: "2026-10-13T01:00:00Z", confirmed_at: "2026-10-13T02:00:00Z", reversed_at: "2026-10-13T05:00:00Z" },
      ],
    });
    expect(r.stale).toEqual({ lastConfirmedDay: "2026-08-09", daysSince: 66 });
  });

  it("no session at all: alert with null day and null count", () => {
    const r = computeStocktakeAlerts({ ...base, sessions: [] });
    expect(r.stale).toEqual({ lastConfirmedDay: null, daysSince: null });
  });

  it("an OPEN session 3 days old with limit 2 is reported", () => {
    const r = computeStocktakeAlerts({
      ...base,
      sessions: [
        { id: "STK-003", status: "OPEN", created_at: "2026-10-11T03:00:00Z", confirmed_at: null, reversed_at: null },
        { id: "STK-004", status: "OPEN", created_at: "2026-10-12T03:00:00Z", confirmed_at: null, reversed_at: null },
        { id: "STK-001", status: "CONFIRMED", created_at: "2026-10-13T01:00:00Z", confirmed_at: "2026-10-13T02:00:00Z", reversed_at: null },
      ],
    });
    expect(r.openTooLong).toEqual([{ id: "STK-003", openedDay: "2026-10-11", daysOpen: 3 }]);
    expect(r.stale).toBeNull();
  });

  it("counts Saigon calendar days: 18:00Z on the 10th is already the 11th", () => {
    const r = computeStocktakeAlerts({
      ...base,
      sessions: [{ id: "STK-005", status: "OPEN", created_at: "2026-10-10T18:00:00Z", confirmed_at: null, reversed_at: null }],
    });
    expect(r.openTooLong).toEqual([{ id: "STK-005", openedDay: "2026-10-11", daysOpen: 3 }]);
  });
});

describe("negativeStockItems", () => {
  it("keeps only negatives, sorted by name, falling back to id", () => {
    const onHand = new Map([["A", -1], ["B", 0], ["C", -2.5], ["D", 5], ["E", -3]]);
    const names = new Map([["A", "Trứng gà"], ["C", "Đường"], ["D", "Sữa"]]);
    expect(negativeStockItems(onHand, names)).toEqual([
      { id: "C", name: "Đường", qty: -2.5 },
      { id: "E", name: "E", qty: -3 },
      { id: "A", name: "Trứng gà", qty: -1 },
    ]);
  });
});
