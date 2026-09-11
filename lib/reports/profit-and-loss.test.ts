import { describe, expect, it } from "vitest";
import { computeProfitAndLoss, listAvailableYears, type PnlFigures, type PnlInput } from "./profit-and-loss";

function input(overrides: Partial<PnlInput> = {}): PnlInput {
  return {
    year: 2026,
    today: "2026-09-11",
    orders: [], cashEntries: [], cashCategories: [], purchaseOrders: [], purchaseOrderLines: [],
    purchasedItems: [], itemCategories: [], stockIssues: [], stocktakeSessions: [], assets: [], assetDisposals: [],
    firstPaymentAt: "2026-07-19T01:00:00Z",
    ...overrides,
  };
}
const month = (f: PnlFigures, m: string) => {
  const found = f.months.find(x => x.month === m);
  if (!found) throw new Error(`month ${m} not in figures`);
  return found;
};

const RAW = { id: "NHH-001", system_type: "RAW" };
const CONSUMABLE = { id: "NHH-002", system_type: "CONSUMABLE" };
const EQUIPMENT = { id: "NHH-003", system_type: "EQUIPMENT" };
const po = (id: string, at: string, extra: Record<string, unknown> = {}) => ({
  id, status: "COMPLETED", transaction_date: at, created_at: at,
  shipping_fee: 0, tax_amount: 0, voucher_amount: 0, discount_amount: 0, ...extra,
});

describe("POS revenue", () => {
  it("counts completed, latest-version orders in their Saigon month -- the getPnLDataV2 filter", () => {
    const f = computeProfitAndLoss(input({
      firstPaymentAt: "2026-08-01T00:00:00Z",
      orders: [
        { id: "O1", status: "COMPLETED", superseded_by: null, created_at: "2026-07-31T17:30:00Z", net_total: 50_000 }, // 01/08 Saigon
        { id: "O2", status: "COMPLETED", superseded_by: "", created_at: "2026-08-05T03:00:00Z", net_total: 30_000 },
        { id: "O3", status: "CANCELLED", superseded_by: null, created_at: "2026-08-05T03:00:00Z", net_total: 99_000 },
        { id: "O4", status: "COMPLETED", superseded_by: "O5", created_at: "2026-08-05T03:00:00Z", net_total: 70_000 },
      ],
    }));
    expect(f.months.map(m => m.month)).toEqual(["2026-08", "2026-09"]);
    expect(month(f, "2026-08").posRevenue).toBe(80_000);
    expect(month(f, "2026-08").posOrderCount).toBe(2);
    // O1 is before the first payment record, O2 after it
    expect(month(f, "2026-08").posRevenueBeforePayments).toBe(50_000);
    expect(f.firstPaymentDate).toBe("2026-08-01");
  });
});

describe("cash book", () => {
  const categories = [
    { id: "CFC-001", name: "Vận hành", kind: "EXPENSE", affects_pnl: true, status: "ACTIVE" },
    { id: "CFC-004", name: "Thu khác", kind: "INCOME", affects_pnl: true, status: "ACTIVE" },
    { id: "CFC-005", name: "Vốn góp", kind: "INCOME", affects_pnl: false, status: "ACTIVE" },
    { id: "CFC-006", name: "Doanh thu ghi tay", kind: "INCOME", affects_pnl: true, is_sales_revenue: true, status: "ACTIVE" },
    { id: "CFC-009", name: "Nhóm cũ", kind: "EXPENSE", affects_pnl: true, status: "INACTIVE" },
  ];
  const entries = [
    { id: "CE-023", entry_date: "2026-08-02", category_id: "CFC-001", amount: 300_000, note: "Dán lại xe Phin Đi", status: "ACTIVE" },
    { id: "CE-029", entry_date: "2026-08-31", category_id: "CFC-001", amount: 130_000, note: "Phin Đi - Gửi xe", status: "ACTIVE" },
    { id: "CE-098", entry_date: "2026-08-10", category_id: "CFC-001", amount: 999_000, note: "Nhập nhầm", status: "CANCELLED" },
    { id: "CE-024", entry_date: "2026-08-15", category_id: "CFC-005", amount: 1_472_000, note: "Vốn góp", status: "ACTIVE" },
    { id: "CE-033", entry_date: "2026-04-30", category_id: "CFC-006", amount: 5_000_000, note: null, status: "ACTIVE" },
    { id: "CE-034", entry_date: "2026-04-30", category_id: "CFC-006", amount: 3_411_868, note: null, status: "ACTIVE" },
    { id: "CE-050", entry_date: "2026-08-20", category_id: "CFC-004", amount: 200_000, note: "Bán ve chai", status: "ACTIVE" },
  ];

  it("splits rows into expense groups, sales revenue and other income; leaves out cancelled rows and capital", () => {
    const f = computeProfitAndLoss(input({ cashCategories: categories, cashEntries: entries }));
    const aug = month(f, "2026-08");
    expect(aug.expenseByCategory).toEqual({ "CFC-001": 430_000 });
    expect(aug.sources.expense["CFC-001"].map(s => s.id)).toEqual(["CE-023", "CE-029"]);
    expect(aug.sources.expense["CFC-001"][0]).toEqual({
      kind: "CASH_ENTRY", id: "CE-023", date: "2026-08-02", label: "Dán lại xe Phin Đi", ref: null, amountExact: 300_000,
    });
    expect(aug.otherIncome).toBe(200_000);
    expect(aug.manualRevenue).toBe(0);
    const apr = month(f, "2026-04");
    expect(apr.manualRevenue).toBe(8_411_868);
    expect(apr.sources.manualRevenue.map(s => s.label)).toEqual(["Không có ghi chú", "Không có ghi chú"]);
    expect(f.months[0].month).toBe("2026-04");
  });

  it("shows an expense group while it is in use, or when the year has a figure for it", () => {
    const f = computeProfitAndLoss(input({ cashCategories: categories, cashEntries: entries }));
    expect(f.expenseCategories).toEqual([{ id: "CFC-001", name: "Vận hành" }]);
    const withOld = computeProfitAndLoss(input({
      cashCategories: categories,
      cashEntries: [...entries, { id: "CE-060", entry_date: "2026-05-03", category_id: "CFC-009", amount: 10_000, note: null, status: "ACTIVE" }],
    }));
    expect(withOld.expenseCategories.map(c => c.id)).toEqual(["CFC-001", "CFC-009"]);
  });

  it("without the sales-revenue flag, hand-recorded revenue falls to other income", () => {
    const unflagged = categories.map(c => (c.id === "CFC-006" ? { ...c, is_sales_revenue: undefined } : c));
    const apr = month(computeProfitAndLoss(input({ cashCategories: unflagged, cashEntries: entries })), "2026-04");
    expect(apr.manualRevenue).toBe(0);
    expect(apr.otherIncome).toBe(8_411_868);
  });

  it("refuses a row whose category does not exist, naming the row", () => {
    expect(() => computeProfitAndLoss(input({
      cashCategories: categories,
      cashEntries: [{ id: "CE-777", entry_date: "2026-08-02", category_id: "CFC-404", amount: 1, note: null, status: "ACTIVE" }],
    }))).toThrow("CE-777");
  });
});

describe("bought for immediate use (Nguyên liệu mua dùng ngay)", () => {
  it("takes each flagged line's paid share, in the Saigon month of the order; equipment never counts", () => {
    const f = computeProfitAndLoss(input({
      itemCategories: [RAW, EQUIPMENT],
      purchasedItems: [
        { id: "SPM-010", name: "Đá viên", item_category_id: "NHH-001", is_non_inventory: true },
        { id: "SPM-001", name: "Sữa tươi", item_category_id: "NHH-001", is_non_inventory: false },
        { id: "SPM-091", name: "Ly thuỷ tinh", item_category_id: "NHH-003", is_non_inventory: true },
      ],
      purchaseOrders: [
        po("PO-173", "2026-05-31T17:00:00Z", { shipping_fee: 20_000 }), // 01/06 Saigon
        po("PO-174", "2026-06-10T03:00:00Z", { status: "DRAFT" }),
      ],
      purchaseOrderLines: [
        { id: "POL-a", purchase_order_id: "PO-173", purchased_item_id: "SPM-010", base_quantity: 10, subtotal: 100_000 },
        { id: "POL-b", purchase_order_id: "PO-173", purchased_item_id: "SPM-001", base_quantity: 10, subtotal: 100_000 },
        { id: "POL-c", purchase_order_id: "PO-173", purchased_item_id: "SPM-091", base_quantity: 1, subtotal: 200_000 },
        { id: "POL-d", purchase_order_id: "PO-174", purchased_item_id: "SPM-010", base_quantity: 10, subtotal: 90_000 },
      ],
    }));
    expect(f.months[0].month).toBe("2026-06");
    const jun = month(f, "2026-06");
    // 20.000đ shipping over a 400.000đ order: this line carries 5%, 5.000đ
    expect(jun.nonInventoryExact).toBe(105_000);
    expect(jun.sources.nonInventory).toEqual([
      { kind: "PO_LINE", id: "POL-a", date: "2026-06-01", label: "Đá viên", ref: "PO-173", amountExact: 105_000 },
    ]);
  });
});

describe("cost of goods and shrinkage", () => {
  const items = [
    { id: "SPM-001", name: "Sữa tươi", item_category_id: "NHH-001", is_non_inventory: false },
    { id: "SPM-057", name: "Khăn lau đa năng", item_category_id: "NHH-002", is_non_inventory: true },
  ];
  const base = {
    itemCategories: [RAW, CONSUMABLE],
    purchasedItems: items,
    purchaseOrders: [po("PO-1", "2026-07-01T03:00:00Z"), po("PO-2", "2026-08-01T03:00:00Z")],
    purchaseOrderLines: [
      // 100đ per unit
      { id: "POL-1", purchase_order_id: "PO-1", purchased_item_id: "SPM-001", base_quantity: 1000, subtotal: 100_000 },
      { id: "POL-2", purchase_order_id: "PO-2", purchased_item_id: "SPM-057", base_quantity: 10, subtotal: 10_000 },
    ],
    stocktakeSessions: [
      { id: "STK-001", is_shrinkage: false },
      { id: "STK-003", is_shrinkage: true },
    ],
    stockIssues: [
      { id: "ISS-1", purchased_item_id: "SPM-001", issued_at: "2026-07-10T03:00:00Z", base_quantity: 200, source: "MANUAL", issue_slip_id: "ISL-1", note: "Pha chế" },
      { id: "ISS-2", purchased_item_id: "SPM-001", issued_at: "2026-08-09T03:00:00Z", base_quantity: 300, source: "STOCKTAKE", session_id: "STK-001" },
      { id: "ISS-3", purchased_item_id: "SPM-001", issued_at: "2026-08-20T03:00:00Z", base_quantity: 100, source: "STOCKTAKE", session_id: "STK-003" },
      { id: "ISS-4", purchased_item_id: "SPM-057", issued_at: "2026-08-21T03:00:00Z", base_quantity: 1, source: "MANUAL", issue_slip_id: "ISL-2", note: "Lau bàn" },
    ],
  };

  it("uses the same engine as getPnLDataV2, split by the session's own flag", () => {
    const f = computeProfitAndLoss(input(base));
    expect(month(f, "2026-07").cogsExact).toBeCloseTo(20_000, 6);
    expect(month(f, "2026-07").shrinkageExact).toBeCloseTo(0, 6);
    expect(month(f, "2026-08").cogsExact).toBeCloseTo(30_000, 6);
    expect(month(f, "2026-08").shrinkageExact).toBeCloseTo(10_000, 6);
  });

  it("names each count and each slip, and they add up to the month's figure", () => {
    const f = computeProfitAndLoss(input(base));
    const jul = month(f, "2026-07");
    expect(jul.sources.cogs).toHaveLength(1);
    expect(jul.sources.cogs[0]).toMatchObject({ kind: "ISSUE_SLIP", id: "ISL-1", date: "2026-07-10", label: "Phiếu xuất: Pha chế" });
    const aug = month(f, "2026-08");
    expect(aug.sources.cogs.map(s => [s.kind, s.id, s.date, s.label])).toEqual([["STOCKTAKE", "STK-001", "2026-08-09", "Kiểm kê định kỳ"]]);
    expect(aug.sources.shrinkage.map(s => s.id)).toEqual(["STK-003"]);
    const sum = (xs: { amountExact: number }[]) => xs.reduce((a, s) => a + s.amountExact, 0);
    expect(sum(aug.sources.cogs)).toBeCloseTo(aug.cogsExact, 6);
    expect(sum(aug.sources.shrinkage)).toBeCloseTo(aug.shrinkageExact, 6);
  });

  it("an issue slip for an item bought for immediate use never reaches cost of goods", () => {
    const aug = month(computeProfitAndLoss(input(base)), "2026-08");
    expect(aug.sources.cogs.some(s => s.id === "ISL-2")).toBe(false);
    // its money sits on the bought-for-use line instead, once
    expect(aug.nonInventoryExact).toBe(10_000);
  });
});

describe("depreciation", () => {
  it("charges each asset's own schedule; an INACTIVE asset is a data-entry mistake and is left out", () => {
    const f = computeProfitAndLoss(input({
      assets: [
        { id: "TS-001", name_snapshot: "Máy xay", acquired_date: "2026-03-15", total_cost: 1_200_000, quantity: 1, term_months: 12, status: "ACTIVE" },
        { id: "TS-002", name_snapshot: "Nhập nhầm", acquired_date: "2026-03-01", total_cost: 600_000, quantity: 1, term_months: 12, status: "INACTIVE" },
      ],
    }));
    expect(f.months.map(m => m.month)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(month(f, "2026-03").depreciationExact).toBe(100_000);
    expect(month(f, "2026-03").sources.depreciation).toEqual([
      { kind: "ASSET", id: "TS-001", date: null, label: "Máy xay", ref: null, amountExact: 100_000 },
    ]);
  });
});

describe("which months", () => {
  it("a past year runs to December; a future year has none", () => {
    const asset = { id: "TS-001", name_snapshot: "Máy xay", acquired_date: "2025-11-01", total_cost: 1_200_000, quantity: 1, term_months: 12, status: "ACTIVE" };
    expect(computeProfitAndLoss(input({ year: 2025, assets: [asset] })).months.map(m => m.month)).toEqual(["2025-11", "2025-12"]);
    expect(computeProfitAndLoss(input({ year: 2027, assets: [asset] })).months).toEqual([]);
  });

  it("a year with nothing in it has no months", () => {
    expect(computeProfitAndLoss(input()).months).toEqual([]);
  });
});

describe("listAvailableYears", () => {
  it("runs from the earliest year with data to this year, newest first", () => {
    expect(listAvailableYears(["2026-03-15", null, "2025-11-01", undefined], 2026)).toEqual([2026, 2025]);
  });
  it("offers this year when there is no data at all", () => {
    expect(listAvailableYears([], 2026)).toEqual([2026]);
  });
});
