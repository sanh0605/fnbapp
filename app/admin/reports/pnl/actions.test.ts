import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
}));

import { findAll, findAllNoCache, findAllWhere } from "@/lib/db/tables";
import { getProfitAndLossReport } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T05:00:00Z"));
  requireAdminMock.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" } });
  (findAll as any).mockResolvedValue([]);
  (findAllNoCache as any).mockResolvedValue([]);
  (findAllWhere as any).mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("getProfitAndLossReport", () => {
  it("refuses before loading any data when not signed in as ADMIN or MANAGER", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });
    await expect(getProfitAndLossReport()).rejects.toThrow("Yêu cầu đăng nhập");
    expect(findAll).not.toHaveBeenCalled();
    expect(findAllNoCache).not.toHaveBeenCalled();
    expect(findAllWhere).not.toHaveBeenCalled();
  });

  it("loads only the chosen year's completed orders, bounded in Saigon time", async () => {
    (findAllNoCache as any).mockImplementation(async (sheet: string) =>
      sheet === "assets"
        ? [{ id: "TS-001", name_snapshot: "Máy xay", acquired_date: "2025-11-01", total_cost: 1_200_000, quantity: 1, term_months: 12, status: "ACTIVE" }]
        : []);

    const report = await getProfitAndLossReport(2025);

    expect(report.availableYears).toEqual([2026, 2025]);
    expect(report.figures.year).toBe(2025);
    expect(findAllWhere).toHaveBeenCalledWith("Orders_V2", {
      eq: { status: "COMPLETED" },
      gte: { created_at: new Date("2024-12-31T17:00:00.000Z") },
      lte: { created_at: new Date("2025-12-31T16:59:59.999Z") },
    });
    expect(report.table.year).toBe(2025);
    expect(report.table.periodLabel).toBe("cả năm");
    expect(report.table.months.map(m => m.month)).toEqual(["2025-11", "2025-12"]);
  });

  it("falls back to the newest year when the asked-for year has no data", async () => {
    const report = await getProfitAndLossReport(1999);
    expect(report.figures.year).toBe(2026);
  });

  it("lets an engine error through instead of showing a table of zeros", async () => {
    (findAllNoCache as any).mockImplementation(async (sheet: string) => {
      if (sheet === "Cash_Categories") return [];
      if (sheet === "Cash_Entries") return [{ id: "CE-777", entry_date: "2026-08-02", category_id: "CFC-404", amount: 1, note: null, status: "ACTIVE" }];
      return [];
    });
    await expect(getProfitAndLossReport(2026)).rejects.toThrow("CE-777");
  });

  it("returns the brand names for the header, ordered by code", async () => {
    (findAll as any).mockImplementation(async (sheet: string) =>
      sheet === "Brands"
        ? [
            { id: "BR-002", code: "B2", name: "Uchako", start_date: "", status: "ACTIVE", created_at: "" },
            { id: "BR-001", code: "B1", name: "Phin Đi", start_date: "", status: "ACTIVE", created_at: "" },
          ]
        : []);

    const report = await getProfitAndLossReport(2026);

    expect(report.brandNames).toEqual(["Phin Đi", "Uchako"]);
  });
});
