import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({ findAll: mocks.findAll }));

import { getOutlets } from "./actions";

describe("getOutlets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns outlets for an authenticated admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockResolvedValue([
      { id: "OUT-001", code: "001", name: "Điểm bán 1", brand_id: "BR-001" },
      { id: "OUT-002", code: "002", name: "Điểm bán 2", brand_id: "BR-002" },
    ]);

    const result = await getOutlets();

    expect(mocks.findAll).toHaveBeenCalledWith("Outlets");
    expect(result).toHaveLength(2);
  });

  it("throws before reading storage when not an admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Không có quyền truy cập" });

    await expect(getOutlets()).rejects.toThrow("Không có quyền truy cập");
    expect(mocks.findAll).not.toHaveBeenCalled();
  });

  it("returns an empty list instead of throwing when the read fails", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.findAll.mockRejectedValue(new Error("db down"));

    const result = await getOutlets();

    expect(result).toEqual([]);
  });
});
