import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  resolveActor: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
  unstableCache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@/lib/auth", () => ({
  resolveActor: mocks.resolveActor,
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_cache: mocks.unstableCache,
}));

import { getRealtimeStock, submitStockAdjustment } from "./actions";

describe("stock adjustment authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue({
      ok: true,
      actor: { id: "staff-1", name: "Thu ngân", role: "STAFF" },
    });
  });

  it("rejects a non-admin caller before generating IDs or writing rows", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: false,
      error: "Chỉ ADMIN mới có quyền thực hiện thao tác này",
    });

    const result = await submitStockAdjustment({
      item_id: "BTP-001",
      theoretical_qty: 10,
      actual_qty: 9,
      difference: -1,
      reason: "Kiểm kê",
    });

    expect(result).toEqual({ error: "Chỉ ADMIN mới có quyền thực hiện thao tác này" });
    expect(mocks.generateNewId).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("auto-approves an ADMIN submission and writes its ledger row", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.generateNewId
      .mockResolvedValueOnce("SADJ-001")
      .mockResolvedValueOnce("STK-001");

    const result = await submitStockAdjustment({
      item_id: "BTP-001",
      theoretical_qty: 10,
      actual_qty: 9,
      difference: -1,
      reason: "Kiểm kê",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.insert).toHaveBeenNthCalledWith(
      1,
      "Stock_Adjustments",
      expect.objectContaining({
        id: "SADJ-001",
        status: "APPROVED",
        created_by_id: "admin-1",
        approved_by: "Quản lý",
      }),
    );
    expect(mocks.insert).toHaveBeenNthCalledWith(
      2,
      "Stock_Ledger",
      expect.objectContaining({
        id: "STK-001",
        reference_id: "SADJ-001",
        transaction_type: "STOCK_ADJUST",
      }),
    );
  });

  it("rejects an unauthenticated realtime-stock read before loading data", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });
    mocks.findAll.mockResolvedValue([]);
    mocks.findAllNoCache.mockResolvedValue([]);

    await expect(getRealtimeStock()).rejects.toThrow("Yêu cầu đăng nhập");
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
  });
});
