import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({ findAll: mocks.findAll, findById: mocks.findById, update: mocks.update }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getDashboardSettings, saveDashboardSettings } from "./actions";

const actor = { id: "a-1", name: "Admin", role: "ADMIN" };
const SETTINGS = {
  id: 1, stale_stocktake_days: 30, open_stocktake_days: 2, reminder_start_day: 25,
  food_product_ids: ["PROD-028", "PROD-027"], topping_type_id: "PT-003",
};

const valid = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  const base: Record<string, string> = {
    stale_stocktake_days: "30", open_stocktake_days: "2", reminder_start_day: "25", topping_type_id: "PT-003", ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  fd.append("food_product_ids", "PROD-028");
  fd.append("food_product_ids", "PROD-027");
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ok: true, actor });
  mocks.findById.mockResolvedValue(SETTINGS);
  mocks.findAll.mockImplementation(async (sheet: string) =>
    sheet === "Products"
      ? [{ id: "PROD-028", name: "Trứng luộc" }, { id: "PROD-027", name: "Khoai lang" }]
      : [{ id: "PT-003", name: "Topping" }],
  );
});

describe("getDashboardSettings", () => {
  it("reads row 1", async () => {
    expect(await getDashboardSettings()).toEqual(SETTINGS);
    expect(mocks.findById).toHaveBeenCalledWith("Dashboard_Settings", "1");
  });
});

describe("saveDashboardSettings", () => {
  it.each([
    ["stale_stocktake_days", "0", "Nhập số từ 1 đến 365"],
    ["stale_stocktake_days", "366", "Nhập số từ 1 đến 365"],
    ["open_stocktake_days", "2.5", "Nhập số từ 1 đến 365"],
    ["open_stocktake_days", "", "Nhập số từ 1 đến 365"],
    ["reminder_start_day", "29", "Nhập số từ 1 đến 28"],
    ["reminder_start_day", "0", "Nhập số từ 1 đến 28"],
  ])("rejects %s = %j with its own message", async (field, value, message) => {
    const res = await saveDashboardSettings(valid({ [field]: value }));
    expect(res).toEqual({ error: message, field });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a dish that does not exist", async () => {
    const fd = valid();
    fd.append("food_product_ids", "PROD-404");
    const res = await saveDashboardSettings(fd);
    expect(res.field).toBe("food_product_ids");
    expect(res.error).toBe("Món không còn tồn tại");
  });

  it("rejects a topping type that does not exist, accepts empty as null", async () => {
    expect((await saveDashboardSettings(valid({ topping_type_id: "PT-404" }))).field).toBe("topping_type_id");
    expect((await saveDashboardSettings(valid({ topping_type_id: "" }))).success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Dashboard_Settings", "1", expect.objectContaining({ topping_type_id: null }));
  });

  it("saves the row with the audit columns", async () => {
    const res = await saveDashboardSettings(valid({ stale_stocktake_days: "45" }));
    expect(res).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith("Dashboard_Settings", "1", {
      stale_stocktake_days: 45, open_stocktake_days: 2, reminder_start_day: 25,
      food_product_ids: ["PROD-028", "PROD-027"], topping_type_id: "PT-003",
      updated_by_id: "a-1", updated_by_name: "Admin",
    });
  });

  it("allows no dishes at all", async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ stale_stocktake_days: "30", open_stocktake_days: "2", reminder_start_day: "25", topping_type_id: "" })) fd.set(k, v);
    expect((await saveDashboardSettings(fd)).success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Dashboard_Settings", "1", expect.objectContaining({ food_product_ids: [] }));
  });
});
