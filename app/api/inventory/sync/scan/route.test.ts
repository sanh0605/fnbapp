import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const findAllNoCacheMock = vi.fn();
const auditOrderLedgerMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/sheets_db", () => ({
  findAllNoCache: findAllNoCacheMock,
}));

vi.mock("@/lib/order-ledger-audit", () => ({
  auditOrderLedger: auditOrderLedgerMock,
}));

describe("GET /api/inventory/sync/scan", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    findAllNoCacheMock.mockReset();
    auditOrderLedgerMock.mockReset();
  });

  it("rejects an unauthenticated request before reading inventory data", async () => {
    const { GET } = await import("./route");
    requireAdminMock.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Yêu cầu đăng nhập" });
    expect(findAllNoCacheMock).not.toHaveBeenCalled();
    expect(auditOrderLedgerMock).not.toHaveBeenCalled();
  });

  it("keeps the read-only scan behavior for an authenticated administrator", async () => {
    const { GET } = await import("./route");
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Owner", role: "ADMIN" },
    });
    findAllNoCacheMock.mockResolvedValue([]);
    auditOrderLedgerMock.mockReturnValue({ mismatches: [], orphanLedgerRows: [] });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      discrepancies: [],
      orphanLedgerRows: 0,
    });
    expect(findAllNoCacheMock.mock.calls.map(([table]) => table)).toEqual([
      "Orders_V2",
      "Order_Lines_V2",
      "Stock_Ledger",
      "Base_Ingredients",
      "Semi_Products",
    ]);
  });
});
