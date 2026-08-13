import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdminMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireAdmin: requireAdminMock }));

vi.mock("@/lib/sheets_db", () => ({
  findAllNoCache: vi.fn(),
  findAll: vi.fn(),
}));

import { findAll, findAllNoCache } from "@/lib/sheets_db";
import { getIssuedValueReport } from "./actions";
import liveSnapshot from "./__fixtures__/2026-08-13-live-snapshot.json";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({
    ok: true,
    actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
  });
});

// Plan G section 2's "measured starting point" -- a real production
// snapshot (app/admin/reports/issued/__fixtures__/2026-08-13-live-
// snapshot.json), not a hand-built fixture engineered to match. If
// getIssuedValueReport ever computes something else from this exact data,
// it disagrees with docs/superpowers/plans/2026-08-13-issued-value-page.md
// section 2, and that disagreement is the bug.
describe("getIssuedValueReport", () => {
  function mockLiveSnapshot() {
    (findAllNoCache as any).mockImplementation((sheet: string) => {
      if (sheet === "Purchase_Orders") return liveSnapshot.purchaseOrders;
      if (sheet === "Purchase_Order_Lines") return liveSnapshot.purchaseOrderLines;
      if (sheet === "Stock_Issues") return liveSnapshot.stockIssues;
      throw new Error(`unexpected findAllNoCache sheet: ${sheet}`);
    });
    (findAll as any).mockImplementation((sheet: string) => {
      if (sheet === "Purchased_Items") return liveSnapshot.purchasedItems;
      if (sheet === "Units") return liveSnapshot.units;
      throw new Error(`unexpected findAll sheet: ${sheet}`);
    });
  }

  it("rejects an unauthenticated read before loading any data", async () => {
    requireAdminMock.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });

    await expect(getIssuedValueReport()).rejects.toThrow("Yêu cầu đăng nhập");
    expect(findAllNoCache).not.toHaveBeenCalled();
    expect(findAll).not.toHaveBeenCalled();
  });

  it("grand total: 35.616.236đ", async () => {
    mockLiveSnapshot();
    const report = await getIssuedValueReport();
    expect(report.grandTotal).toBe(35_616_236);
  });

  it("50 purchased items carry a non-zero issued value", async () => {
    mockLiveSnapshot();
    const report = await getIssuedValueReport();
    expect(report.items).toHaveLength(50);
  });

  it("largest item (Bột cà phê MR.PHIN Robusta Dak Mil): issued and closing value", async () => {
    mockLiveSnapshot();
    const report = await getIssuedValueReport();
    const [largest] = report.items;
    expect(largest.name).toBe("Bột cà phê MR.PHIN Robusta Dak Mil");
    // Rounded UP at the display boundary (owner rule 2026-07-30,
    // lib/display-rounding.ts) -- one đồng above the plan's own figures
    // (6.179.657 / 2.101.083), which were computed with plain rounding
    // rather than the project's ceiling rule. Verified 2026-08-13: the
    // grand total matches either way, only the per-item split differs.
    expect(largest.issuedValue).toBe(6_179_657);
    expect(largest.closingValue).toBe(2_101_084);
  });

  it("no item has a negative issued or closing value", async () => {
    mockLiveSnapshot();
    const report = await getIssuedValueReport();
    for (const item of report.items) {
      expect(item.issuedValue).toBeGreaterThanOrEqual(0);
      expect(item.closingValue).toBeGreaterThanOrEqual(0);
    }
  });

  it("tab 2 has one card per real stocktake session and per real issue slip -- 7 events (1 session + 6 slips), not 59 rows", async () => {
    mockLiveSnapshot();
    const report = await getIssuedValueReport();
    expect(report.events).toHaveLength(7);
    expect(report.events.filter(e => e.kind === "STOCKTAKE")).toHaveLength(1);
    expect(report.events.filter(e => e.kind === "MANUAL")).toHaveLength(6);
  });
});
