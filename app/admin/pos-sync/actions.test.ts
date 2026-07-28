import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
  update: mocks.update,
}));

import { getPosSyncAttentionItems, resolvePosSyncFailure } from "./actions";

describe("getPosSyncAttentionItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
  });

  it("rejects a non-admin caller before reading anything", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Chỉ ADMIN mới có quyền thực hiện thao tác này" });

    await expect(getPosSyncAttentionItems()).rejects.toThrow("Chỉ ADMIN mới có quyền thực hiện thao tác này");
    expect(mocks.findAllWhere).not.toHaveBeenCalled();
    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
  });

  it("scopes the Orders_V2 read with findAllWhere instead of a full-table findAllNoCache scan", async () => {
    mocks.findAllWhere.mockResolvedValue([]);
    mocks.findAllNoCache.mockResolvedValue([]);

    await getPosSyncAttentionItems();

    expect(mocks.findAllWhere).toHaveBeenCalledWith(
      "Orders_V2",
      expect.objectContaining({ gte: expect.objectContaining({ synced_at: expect.any(String) }) }),
    );
    expect(mocks.findAllNoCache).toHaveBeenCalledWith("Pos_Sync_Failures");
    expect(mocks.findAllNoCache).not.toHaveBeenCalledWith("Orders_V2");
  });

  it("flags orders synced more than 5 minutes after their sale time", async () => {
    mocks.findAllWhere.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") {
        return [
          { id: "ORD-1", order_no: "PHD000001", created_at: "2026-07-27T07:00:00.000Z", synced_at: "2026-07-27T07:02:00.000Z" },
          { id: "ORD-2", order_no: "PHD000002", created_at: "2026-07-27T07:00:00.000Z", synced_at: "2026-07-27T17:00:00.000Z" },
          { id: "ORD-3", order_no: "PHD000003", created_at: "2026-07-27T07:00:00.000Z", synced_at: null },
        ];
      }
      return [];
    });
    mocks.findAllNoCache.mockImplementation(async (sheet: string) => {
      if (sheet === "Pos_Sync_Failures") return [];
      return [];
    });

    const result = await getPosSyncAttentionItems();

    expect(result.lateOrders).toEqual([
      expect.objectContaining({ id: "ORD-2", delayMinutes: 600 }),
    ]);
  });

  it("lists unresolved sync failures", async () => {
    mocks.findAllWhere.mockResolvedValue([]);
    mocks.findAllNoCache.mockImplementation(async (sheet: string) => {
      if (sheet === "Pos_Sync_Failures") {
        return [
          { id: "F-1", request_token: "tok-1", error_message: "Payment total mismatch", occurred_at: "2026-07-27T07:00:00.000Z", resolved: false },
          { id: "F-2", request_token: "tok-2", error_message: "Old error", occurred_at: "2026-07-26T07:00:00.000Z", resolved: true },
        ];
      }
      return [];
    });

    const result = await getPosSyncAttentionItems();

    expect(result.failures).toEqual([
      expect.objectContaining({ id: "F-1", request_token: "tok-1" }),
    ]);
  });
});

describe("resolvePosSyncFailure", () => {
  it("rejects a non-admin caller before writing", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Chỉ ADMIN mới có quyền thực hiện thao tác này" });

    const result = await resolvePosSyncFailure("F-1");

    expect(result).toEqual({ success: false, error: "Chỉ ADMIN mới có quyền thực hiện thao tác này" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marks a failure resolved for an admin caller", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.update.mockResolvedValue(undefined);

    const result = await resolvePosSyncFailure("F-1");

    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith("Pos_Sync_Failures", "F-1", { resolved: true });
  });

  it("returns error when update fails for resolve sync failure", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.update.mockRejectedValue(new Error("Database update failed"));

    const result = await resolvePosSyncFailure("F-1");

    expect(result).toEqual({ success: false, error: "Database update failed" });
  });
});
