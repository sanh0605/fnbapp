import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  insert: mocks.insert,
  update: mocks.update,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getOutlets, addOutlet, renameOutlet, retireOutlet } from "./actions";

const ADMIN = { ok: true as const, actor: { id: "admin-1", name: "Admin" } };

describe("getOutlets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns outlets for an authenticated admin", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
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
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockRejectedValue(new Error("db down"));

    const result = await getOutlets();

    expect(result).toEqual([]);
  });
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("addOutlet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.generateNewId.mockResolvedValue("OUT-003");
  });

  it("assigns 003 for a third outlet", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "OUT-001", code: "001", status: "ACTIVE" },
      { id: "OUT-002", code: "002", status: "ACTIVE" },
    ]);

    const res = await addOutlet(formData({ name: "Điểm bán 3", brand_id: "BR-001" }));

    expect(res.success).toBe(true);
    expect(res.code).toBe("003");
    expect(mocks.insert).toHaveBeenCalledWith(
      "Outlets",
      expect.objectContaining({ code: "003", name: "Điểm bán 3", brand_id: "BR-001", status: "ACTIVE" }),
    );
  });

  it("assigns 004, not the gap left by retiring 002 -- the owner's own example", async () => {
    // Section 5.1 of the 2026-08-24 plan, verbatim: "Diem ban 4: 004 (khong
    // thay the vao lai diem ban da ngung hoat dong)". Outlet 002 is
    // INACTIVE here but its row -- and code -- is still in the list.
    mocks.findAll.mockResolvedValue([
      { id: "OUT-001", code: "001", status: "ACTIVE" },
      { id: "OUT-002", code: "002", status: "INACTIVE" },
      { id: "OUT-003", code: "003", status: "ACTIVE" },
    ]);

    const res = await addOutlet(formData({ name: "Điểm bán 4", brand_id: "BR-001" }));

    expect(res.code).toBe("004");
  });

  it("refuses without a name", async () => {
    const res = await addOutlet(formData({ brand_id: "BR-001" }));
    expect(res.error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses without a brand", async () => {
    const res = await addOutlet(formData({ name: "Điểm bán 3" }));
    expect(res.error).toBeTruthy();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("renameOutlet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(ADMIN);
  });

  it("updates only the name, leaving the code untouched", async () => {
    const res = await renameOutlet(formData({ id: "OUT-001", name: "Cửa hàng Quận 1" }));

    expect(res.success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Outlets", "OUT-001", { name: "Cửa hàng Quận 1" });
  });

  it("refuses without a name", async () => {
    const res = await renameOutlet(formData({ id: "OUT-001" }));
    expect(res.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("retireOutlet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(ADMIN);
  });

  it("sets status INACTIVE and an end_date, never deleting the row", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "OUT-001", code: "001", status: "ACTIVE" },
      { id: "OUT-002", code: "002", status: "ACTIVE" },
    ]);

    const res = await retireOutlet(formData({ id: "OUT-002" }));

    expect(res.success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith(
      "Outlets",
      "OUT-002",
      expect.objectContaining({ status: "INACTIVE", end_date: expect.any(String) }),
    );
  });

  it("refuses to retire the last active outlet", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "OUT-001", code: "001", status: "ACTIVE" },
      { id: "OUT-002", code: "002", status: "INACTIVE" },
    ]);

    const res = await retireOutlet(formData({ id: "OUT-001" }));

    expect(res.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses an outlet that is already retired", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "OUT-001", code: "001", status: "ACTIVE" },
      { id: "OUT-002", code: "002", status: "INACTIVE" },
    ]);

    const res = await retireOutlet(formData({ id: "OUT-002" }));

    expect(res.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
