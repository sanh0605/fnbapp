import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSalesDataV2 = vi.hoisted(() => vi.fn());
const getHourlyHeatmapV2 = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ getSalesDataV2, getHourlyHeatmapV2 }));
vi.mock("@/lib/db/tables", () => ({ findAll: vi.fn().mockResolvedValue([]) }));
vi.mock("@/app/admin/reports/components/SalesFilter", () => ({ default: () => null }));
vi.mock("@/app/admin/reports/components/SalesCharts", () => ({ default: () => null }));
vi.mock("@/app/admin/reports/components/CategoryPieChart", () => ({ default: () => null }));
vi.mock("@/app/admin/reports/components/ProductTable", () => ({ default: () => null }));
vi.mock("./OutletBreakdownSection", () => ({ OutletBreakdownSection: () => null }));

import SalesReportPage from "./page";

const EMPTY = {
  v2OrderCount: 0, totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, grossRevenue: 0,
  systemPromotionDiscount: 0, manualItemDiscount: 0, manualOrderDiscount: 0, totalDiscount: 0,
  paymentBreakdown: [], bestSellers: [], bestToppings: [], uniqueSizes: [], totalQtyBySize: {},
  totalQtyAll: 0, salesByDate: [], salesByMonth: [], salesByDayOfWeek: [], salesByHour: [], outletBreakdown: [],
};

describe("sales report default range (A8)", () => {
  beforeEach(() => {
    getSalesDataV2.mockReset();
    getSalesDataV2.mockResolvedValue(EMPTY);
    getHourlyHeatmapV2.mockReset();
    getHourlyHeatmapV2.mockResolvedValue([]);
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("defaults to the Saigon month: 06:10 on 01/10 is October 1st to October 1st", async () => {
    // 2026-09-30T23:10:00Z = 01/10/2026 06:10 Saigon
    vi.setSystemTime(new Date("2026-09-30T23:10:00Z"));
    await SalesReportPage({ searchParams: {} });
    expect(getSalesDataV2.mock.calls[0][0]).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-01" });
  });

  it("06:30 on 15/09 gives 01/09 to 15/09", async () => {
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
    await SalesReportPage({ searchParams: {} });
    expect(getSalesDataV2.mock.calls[0][0]).toMatchObject({ startDate: "2026-09-01", endDate: "2026-09-15" });
  });
});
