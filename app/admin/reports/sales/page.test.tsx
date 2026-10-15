import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSalesDataV2 = vi.hoisted(() => vi.fn());
const getHourlyHeatmapV2 = vi.hoisted(() => vi.fn());
const getSalesTotalsV2 = vi.hoisted(() => vi.fn());
vi.mock("../sales-actions", () => ({ getSalesDataV2, getSalesTotalsV2 }));
vi.mock("../engagement-actions", () => ({ getHourlyHeatmapV2 }));
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
  paymentBreakdown: [], paymentOrderCount: 0, bestDrinks: [], bestFoods: [], categorySales: [],
  bestToppings: [], uniqueSizes: [], salesByDate: [], salesByMonth: [], salesByDayOfWeek: [], salesByHour: [], outletBreakdown: [],
};

describe("sales report default range (A8)", () => {
  beforeEach(() => {
    getSalesDataV2.mockReset();
    getSalesDataV2.mockResolvedValue(EMPTY);
    getHourlyHeatmapV2.mockReset();
    getHourlyHeatmapV2.mockResolvedValue([]);
    getSalesTotalsV2.mockReset();
    getSalesTotalsV2.mockResolvedValue({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  // BR-UI-007 (owner 2026-10-09): opens on Tháng này, the whole month.
  it("defaults to the Saigon month: 06:10 on 01/10 is the whole of October", async () => {
    // 2026-09-30T23:10:00Z = 01/10/2026 06:10 Saigon
    vi.setSystemTime(new Date("2026-09-30T23:10:00Z"));
    await SalesReportPage({ searchParams: Promise.resolve({}) });
    expect(getSalesDataV2.mock.calls[0][0]).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-31" });
  });

  it("06:30 on 15/09 gives 01/09 to 30/09", async () => {
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
    await SalesReportPage({ searchParams: Promise.resolve({}) });
    expect(getSalesDataV2.mock.calls[0][0]).toMatchObject({ startDate: "2026-09-01", endDate: "2026-09-30" });
  });

  it("renders Vietnamese-only labels without '(Net)' or '(Heatmap)'", async () => {
    const tree = await SalesReportPage({ searchParams: Promise.resolve({}) });
    const json = JSON.stringify(tree);
    expect(json).toContain("Tổng doanh thu thuần");
    expect(json).not.toContain("(Net)");
    expect(json).toContain("Ma trận Doanh thu theo Giờ");
    expect(json).not.toContain("(Heatmap)");
  });
});

describe("Doanh số compare cards (BR-UI-007)", () => {
  beforeEach(() => {
    getSalesDataV2.mockReset();
    getSalesDataV2.mockResolvedValue({ ...EMPTY, totalRevenue: 150000, totalOrders: 2, avgOrderValue: 75000 });
    getHourlyHeatmapV2.mockReset();
    getHourlyHeatmapV2.mockResolvedValue([]);
    getSalesTotalsV2.mockReset();
    getSalesTotalsV2.mockResolvedValue({ totalRevenue: 120000, totalOrders: 1, avgOrderValue: 120000 });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("Tháng này on 09/10 compares with 01/09 – 09/09 under the same filters", async () => {
    const tree = await SalesReportPage({ searchParams: Promise.resolve({ brandId: "B1", staffName: "An", categoryId: "CAT-DRINKS" }) });
    expect(getSalesDataV2.mock.calls[0][0]).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-31", brandId: "B1" });
    expect(getSalesTotalsV2).toHaveBeenCalledTimes(1);
    expect(getSalesTotalsV2.mock.calls[0][0]).toEqual({
      startDate: "2026-09-01", endDate: "2026-09-09", brandId: "B1", staffName: "An", categoryId: "CAT-DRINKS",
    });
    expect(JSON.stringify(tree)).toContain("so với 01/09 – 09/09");
  });

  it("Hôm nay compares twice: 08/10 and Friday 02/10", async () => {
    const tree = await SalesReportPage({ searchParams: Promise.resolve({ range: "TODAY", brandId: "B1" }) });
    expect(getSalesDataV2.mock.calls[0][0]).toMatchObject({ startDate: "2026-10-09", endDate: "2026-10-09" });
    const calls = getSalesTotalsV2.mock.calls.map(c => c[0]);
    expect(calls).toEqual([
      { startDate: "2026-10-08", endDate: "2026-10-08", brandId: "B1" },
      { startDate: "2026-10-02", endDate: "2026-10-02", brandId: "B1" },
    ]);
    const json = JSON.stringify(tree);
    expect(json).toContain("so với hôm qua");
    expect(json).toContain("so với thứ Sáu 02/10");
  });

  it("a range wholly in the future fetches nothing to compare", async () => {
    await SalesReportPage({ searchParams: Promise.resolve({ range: "CUSTOM", from: "2026-11-01", to: "2026-11-05" }) });
    expect(getSalesTotalsV2).not.toHaveBeenCalled();
  });

  it("an old ?start=&end= link is no longer read; the page opens on Tháng này", async () => {
    await SalesReportPage({ searchParams: Promise.resolve({ start: "2026-09-01", end: "2026-09-05" }) });
    expect(getSalesDataV2.mock.calls[0][0]).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-31" });
  });
});

describe("Doanh số never sends account secrets to the browser (BR-ACCESS-002)", () => {
  it("passes the staff filter only id, name, username and status", async () => {
    getSalesDataV2.mockResolvedValue(EMPTY);
    getHourlyHeatmapV2.mockResolvedValue([]);
    getSalesTotalsV2.mockResolvedValue({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
    const { findAll } = await import("@/lib/db/tables");
    vi.mocked(findAll).mockImplementation(async (sheet: string) =>
      sheet === "Users"
        ? [{ id: "U-1", name: "Chủ quán", username: "admin", status: "ACTIVE", role: "ADMIN", password_hash: "$2b$10$secret-hash" }]
        : [],
    );
    const json = JSON.stringify(await SalesReportPage({ searchParams: Promise.resolve({}) }));
    expect(json).not.toContain("secret-hash");
    expect(json).not.toContain("password_hash");
    expect(json).toContain('"username":"admin"');
  });
});

describe("Doanh số Vietnamese labels (audit B11)", () => {
  it("uses 'Trước giảm giá:' and 'Doanh thu trước giảm giá' instead of 'Gross'", async () => {
    getSalesDataV2.mockResolvedValue({
      ...EMPTY,
      grossRevenue: 100000,
      totalRevenue: 90000,
      totalDiscount: 10000,
    });
    getHourlyHeatmapV2.mockResolvedValue([]);
    getSalesTotalsV2.mockResolvedValue({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });

    const tree = await SalesReportPage({ searchParams: Promise.resolve({}) });
    const json = JSON.stringify(tree);
    expect(json).toContain("Trước giảm giá:");
    expect(json).toContain("Doanh thu trước giảm giá");
    expect(json).not.toContain("Gross:");
    expect(json).not.toContain("Doanh thu Gross");
    expect(json).not.toContain("Doanh thu Net");
    expect(json).toContain("Doanh thu thuần");
  });
});

describe("Doanh số dish category filter hides order-level figures (audit B3)", () => {
  beforeEach(() => {
    getSalesDataV2.mockReset();
    getSalesDataV2.mockResolvedValue({
      ...EMPTY,
      grossRevenue: 100000,
      totalRevenue: 90000,
      totalDiscount: 10000,
      paymentBreakdown: [{ method: "CASH", paymentCount: 2, revenue: 90000 }],
      systemPromotionDiscount: 5000,
    });
    getHourlyHeatmapV2.mockReset();
    getHourlyHeatmapV2.mockResolvedValue([]);
    getSalesTotalsV2.mockReset();
    getSalesTotalsV2.mockResolvedValue({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("with categoryId set, discount and payment sections and order-level card lines are hidden and explanatory notice is present", async () => {
    const tree = await SalesReportPage({ searchParams: Promise.resolve({ categoryId: "CAT-CAFE" }) });
    const json = JSON.stringify(tree);

    expect(json).not.toContain("Chi tiết giảm giá");
    expect(json).not.toContain("Doanh thu theo phương thức thanh toán");
    expect(json).not.toContain("Trước giảm giá:");
    expect(json).toContain(
      "Đang lọc theo nhóm món: giảm giá và tiền mặt / chuyển khoản tính theo cả đơn nên tạm ẩn. Bỏ lọc nhóm món để xem."
    );
  });

  it("without categoryId, discount and payment sections and order-level card lines are present and explanatory notice is absent", async () => {
    const tree = await SalesReportPage({ searchParams: Promise.resolve({}) });
    const json = JSON.stringify(tree);

    expect(json).toContain("Chi tiết giảm giá");
    expect(json).toContain("Doanh thu theo phương thức thanh toán");
    expect(json).toContain("Trước giảm giá:");
    expect(json).not.toContain(
      "Đang lọc theo nhóm món: giảm giá và tiền mặt / chuyển khoản tính theo cả đơn nên tạm ẩn. Bỏ lọc nhóm món để xem."
    );
    expect(json).not.toContain("Doanh thu Net");
    expect(json).toContain("Doanh thu thuần");
  });
});

