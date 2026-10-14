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

const THIS_YEAR = { preset: "THIS_YEAR", start: "2026-01", end: "2026-09" } as const;

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
    await expect(getProfitAndLossReport(THIS_YEAR)).rejects.toThrow("Yêu cầu đăng nhập");
    expect(findAll).not.toHaveBeenCalled();
    expect(findAllNoCache).not.toHaveBeenCalled();
    expect(findAllWhere).not.toHaveBeenCalled();
  });

  it("loads only the chosen months' completed orders, bounded in Saigon time", async () => {
    (findAllNoCache as any).mockImplementation(async (sheet: string) =>
      sheet === "assets"
        ? [{ id: "TS-001", name_snapshot: "Máy xay", acquired_date: "2025-11-01", total_cost: 1_200_000, quantity: 1, term_months: 12, status: "ACTIVE" }]
        : []);

    const report = await getProfitAndLossReport({ preset: "LAST_YEAR", start: "2025-01", end: "2025-12" });

    expect(report.availableYears).toEqual([2026, 2025]);
    expect(report.figures.fromMonth).toBe("2025-01");
    expect(report.figures.toMonth).toBe("2025-12");
    expect(findAllWhere).toHaveBeenCalledWith("Orders_V2", {
      eq: { status: "COMPLETED" },
      gte: { created_at: new Date("2024-12-31T17:00:00.000Z") },
      lte: { created_at: new Date("2025-12-31T16:59:59.999Z") },
    });
    expect(report.table.rangeName).toBe("năm trước");
    expect(report.table.months.map(m => m.month)).toEqual(["2025-11", "2025-12"]);
  });

  // BR-UI-007 (owner 2026-10-09): any span of whole months, across a year if asked.
  it("a span across the new year reads orders from 01/11/2025 to the end of 28/02/2026 Saigon", async () => {
    const report = await getProfitAndLossReport({ preset: "CUSTOM", start: "2025-11", end: "2026-02" });
    expect(findAllWhere).toHaveBeenCalledWith("Orders_V2", {
      eq: { status: "COMPLETED" },
      gte: { created_at: new Date("2025-10-31T17:00:00.000Z") },
      lte: { created_at: new Date("2026-02-28T16:59:59.999Z") },
    });
    expect(report.table.rangeName).toBe("trong khoảng đã chọn");
  });

  it("names a ready range in lower case", async () => {
    const report = await getProfitAndLossReport(THIS_YEAR);
    expect(report.table.rangeName).toBe("năm nay");
  });

  it("lets an engine error through instead of showing a table of zeros", async () => {
    (findAllNoCache as any).mockImplementation(async (sheet: string) => {
      if (sheet === "Cash_Categories") return [];
      if (sheet === "Cash_Entries") return [{ id: "CE-777", entry_date: "2026-08-02", category_id: "CFC-404", amount: 1, note: null, status: "ACTIVE" }];
      return [];
    });
    await expect(getProfitAndLossReport(THIS_YEAR)).rejects.toThrow("CE-777");
  });

  it("returns the brand names for the header, ordered by code", async () => {
    (findAll as any).mockImplementation(async (sheet: string) =>
      sheet === "Brands"
        ? [
            { id: "BR-002", code: "B2", name: "Uchako", start_date: "", status: "ACTIVE", created_at: "" },
            { id: "BR-001", code: "B1", name: "Phin Đi", start_date: "", status: "ACTIVE", created_at: "" },
          ]
        : []);

    const report = await getProfitAndLossReport(THIS_YEAR);

    expect(report.brandNames).toEqual(["Phin Đi", "Uchako"]);
  });
});
