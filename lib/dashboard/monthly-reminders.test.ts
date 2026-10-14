import { describe, expect, it } from "vitest";
import { computeMonthlyReminders } from "./monthly-reminders";

const tienDien = {
  id: "KCT-001",
  name: "Tiền điện",
  cash_category_id: "CC-010",
  status: "ACTIVE",
  created_at: "2026-10-14T03:00:00Z", // 14/10 Saigon
};

function run(
  today: string,
  entries: Array<{ monthly_item_id: string | null; entry_date: string; status: string }> = [],
  items = [tienDien],
  reminderStartDay = 25,
) {
  return computeMonthlyReminders({ today, reminderStartDay, items, entries });
}

describe("computeMonthlyReminders", () => {
  it("24/10 with no entry: no reminder yet", () => {
    expect(run("2026-10-24")).toEqual([]);
  });

  it("25/10 with no entry: reminder for 2026-10", () => {
    expect(run("2026-10-25")).toEqual([
      { itemId: "KCT-001", itemName: "Tiền điện", month: "2026-10", cashCategoryId: "CC-010" },
    ]);
  });

  it("31/10 with an entry on 31/10: no reminder", () => {
    expect(run("2026-10-31", [{ monthly_item_id: "KCT-001", entry_date: "2026-10-31", status: "ACTIVE" }])).toEqual([]);
  });

  it("03/11 with no entry: October still reminded, November not yet", () => {
    const r = run("2026-11-03");
    expect(r.map((x) => x.month)).toEqual(["2026-10"]);
  });

  it("an INACTIVE item is not reminded", () => {
    expect(run("2026-10-25", [], [{ ...tienDien, status: "INACTIVE" }])).toEqual([]);
  });

  it("a CANCELLED entry does not switch the reminder off", () => {
    expect(run("2026-10-25", [{ monthly_item_id: "KCT-001", entry_date: "2026-10-20", status: "CANCELLED" }])).toHaveLength(1);
  });

  it("another item's entry does not switch the reminder off", () => {
    expect(run("2026-10-25", [{ monthly_item_id: "KCT-002", entry_date: "2026-10-20", status: "ACTIVE" }])).toHaveLength(1);
    expect(run("2026-10-25", [{ monthly_item_id: null, entry_date: "2026-10-20", status: "ACTIVE" }])).toHaveLength(1);
  });

  it("an item created 30/09 gives nothing for August", () => {
    const r = run("2026-10-05", [], [{ ...tienDien, created_at: "2026-09-30T03:00:00Z" }]);
    expect(r.map((x) => x.month)).toEqual(["2026-09"]);
  });

  it("February with start day 28 is due on 28/02", () => {
    const item = { ...tienDien, created_at: "2027-01-10T03:00:00Z" };
    expect(run("2027-02-27", [], [item], 28).map((x) => x.month)).toEqual(["2027-01"]);
    expect(run("2027-02-28", [], [item], 28).map((x) => x.month)).toEqual(["2027-01", "2027-02"]);
  });

  it("created_at 2026-09-30T18:00:00Z is October in Saigon", () => {
    const r = run("2026-10-25", [], [{ ...tienDien, created_at: "2026-09-30T18:00:00Z" }]);
    expect(r.map((x) => x.month)).toEqual(["2026-10"]);
  });

  it("sorts oldest month first, then name in Vietnamese order", () => {
    const items = [
      { ...tienDien, id: "KCT-002", name: "Tiền nước", created_at: "2026-09-01T03:00:00Z" },
      { ...tienDien, id: "KCT-001", name: "Tiền điện", created_at: "2026-10-01T03:00:00Z" },
      { ...tienDien, id: "KCT-003", name: "Ăn trưa", created_at: "2026-10-01T03:00:00Z" },
    ];
    const r = run("2026-10-25", [], items);
    expect(r.map((x) => `${x.month} ${x.itemName}`)).toEqual([
      "2026-09 Tiền nước",
      "2026-10 Ăn trưa",
      "2026-10 Tiền điện",
      "2026-10 Tiền nước",
    ]);
  });
});
