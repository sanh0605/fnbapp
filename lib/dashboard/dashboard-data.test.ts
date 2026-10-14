import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  findById: vi.fn(),
  onHand: vi.fn(),
  failureCount: vi.fn(),
}));

vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllWhere: mocks.findAllWhere,
  findById: mocks.findById,
}));
vi.mock("@/lib/stock/purchased-item-onhand", () => ({ computeOnHandByPurchasedItem: mocks.onHand }));
vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: async (col: string, val: boolean) => {
          mocks.failureCount(table, col, val);
          return { count: 3, error: null };
        },
      }),
    }),
  }),
}));

import { getDashboardData } from "./dashboard-data";

const SETTINGS = {
  id: 1, stale_stocktake_days: 30, open_stocktake_days: 2, reminder_start_day: 25,
  food_product_ids: ["PROD-028", "PROD-099"], topping_type_id: "PT-003",
};

const TABLES: Record<string, unknown[]> = {
  Purchased_Items: [{ id: "PI-1", name: "Sữa" }, { id: "PI-2", name: "Đường" }],
  Stocktake_Sessions: [],
  Monthly_Expense_Items: [
    { id: "KCT-001", name: "Tiền điện", cash_category_id: "CFC-001", status: "ACTIVE", created_at: "2026-09-01T03:00:00Z" },
    { id: "KCT-002", name: "Tiền nhà", cash_category_id: "CFC-001", status: "INACTIVE", created_at: "2026-09-01T03:00:00Z" },
  ],
  Cash_Entries: [
    { id: "CE-1", monthly_item_id: null, entry_date: "2026-09-10", status: "ACTIVE" },
    { id: "CE-2", monthly_item_id: "KCT-001", entry_date: "2026-10-02", status: "ACTIVE" },
  ],
  Product_Categories: [
    { id: "CAT-001", name: "Cà phê", status: "ACTIVE", type_id: "PT-001" },
    { id: "CAT-003", name: "Cacao", status: "DELETED", type_id: "PT-001" },
    { id: "CAT-006", name: "Đồ ăn", status: "ACTIVE", type_id: "PT-002" },
  ],
  Product_Types: [
    { id: "PT-001", name: "Thức uống", is_drink: true },
    { id: "PT-002", name: "Thức ăn", is_drink: false },
    { id: "PT-003", name: "Topping", is_drink: false },
  ],
  Products: [
    { id: "PROD-028", name: "Trứng luộc", status: "INACTIVE" },
    { id: "PROD-099", name: "Bánh", status: "ACTIVE" },
  ],
};

const snap = (category_id: string) => JSON.stringify({ category_id });
const line = (id: string, order_id: string, product_id: string, qty: number, net: number, cat: string) => ({
  id, order_id, product_id, qty: String(qty), net_line_total: String(net), product_snapshot_json: snap(cat),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-14T05:00:00Z")); // 12:00 in Saigon
  mocks.findById.mockResolvedValue(SETTINGS);
  mocks.onHand.mockResolvedValue(new Map([["PI-1", -5], ["PI-2", 3]]));
  mocks.findAll.mockImplementation(async (sheet: string) => TABLES[sheet] ?? []);
  mocks.findAllWhere.mockImplementation(async (sheet: string) => {
    if (sheet === "Orders_V2") {
      return [
        // 23:30 Saigon on 13/10 is 16:30Z on 13/10.
        { id: "O1", status: "COMPLETED", superseded_by: "", created_at: "2026-10-13T16:30:00Z", net_total: "27000" },
        { id: "O2", status: "COMPLETED", superseded_by: "O1", created_at: "2026-10-13T05:00:00Z", net_total: "99000" },
      ];
    }
    return [
      line("L1", "O1", "P-CAFE", 1, 27000, "CAT-001"),
      line("L2", "O1", "PROD-028", 2, 0, "CAT-006"),
      line("L3", "O2", "P-CAFE", 9, 99000, "CAT-001"),
      line("L4", "O-OLD", "P-CAFE", 1, 1000, "CAT-001"), // belongs to an order that was not read
    ];
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getDashboardData", () => {
  it("reads orders and lines only from 00:00 Saigon of the oldest of the seven days", async () => {
    await getDashboardData();
    const expected = { gte: { created_at: "2026-10-07T17:00:00.000Z" } };
    expect(mocks.findAllWhere).toHaveBeenCalledWith("Orders_V2", expected);
    expect(mocks.findAllWhere).toHaveBeenCalledWith("Order_Lines_V2", expected);
  });

  it("counts unresolved pos sync failures", async () => {
    const data = await getDashboardData();
    expect(data.posSyncFailureCount).toBe(3);
    expect(mocks.failureCount).toHaveBeenCalledWith("pos_sync_failures", "resolved", false);
  });

  it("lists negative stock with item names", async () => {
    expect((await getDashboardData()).negativeStock).toEqual([{ id: "PI-1", name: "Sữa", qty: -5 }]);
  });

  it("flags a stocktake that was never done", async () => {
    expect((await getDashboardData()).stocktake.stale).toEqual({ lastConfirmedDay: null, daysSince: null });
  });

  it("reminds September (past its start day, no entry) and not October (14 < 25)", async () => {
    const { reminders } = await getDashboardData();
    expect(reminders).toEqual([
      { itemId: "KCT-001", itemName: "Tiền điện", month: "2026-09", cashCategoryId: "CFC-001" },
    ]);
  });

  it("builds seven rows and counts the 23:30 order on 13/10, once, with parsed snapshots", async () => {
    const { table } = await getDashboardData();
    expect(table.map((r) => r.day)).toEqual([
      "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14",
    ]);
    const d13 = table.find((r) => r.day === "2026-10-13")!;
    expect(d13.revenue).toBe(27000);
    expect(d13.cups).toBe(1);
    expect(d13.cupMoney).toBe(27000);
    expect(d13.foodQty["PROD-028"]).toBe(2);
    expect(d13.toppingQty).toBe(0);
  });

  it("names the food columns in settings order, keeping an inactive dish, and the topping column", async () => {
    const data = await getDashboardData();
    expect(data.foodColumns).toEqual([
      { id: "PROD-028", name: "Trứng luộc" },
      { id: "PROD-099", name: "Bánh" },
    ]);
    expect(data.toppingColumnName).toBe("Topping");
  });

  it("drops the topping column when no type is set", async () => {
    mocks.findById.mockResolvedValue({ ...SETTINGS, topping_type_id: null });
    const data = await getDashboardData();
    expect(data.toppingColumnName).toBeNull();
    expect(data.table.every((r) => r.toppingQty === null)).toBe(true);
  });
});
