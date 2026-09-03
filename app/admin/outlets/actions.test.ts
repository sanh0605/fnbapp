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

import { getOutlets, addOutlet, editOutlet, retireOutlet } from "./actions";

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

  // this test previously asserted the defect itself -- "returns an empty
  // list instead of throwing when the read fails" was the bug, codified as
  // the expected behaviour. Found by running the suite after the fix: this
  // is the one pre-existing test in the codebase that failed on the value
  // (result no longer equalled [], it rejected instead), not on a missing
  // function -- the mirror image of the usual "write a failing test first"
  // flow, since the wrong behaviour was already pinned by a test before
  // this task started.
  it("propagates the failure instead of returning a fabricated empty list", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getOutlets()).rejects.toThrow("db down");
  });

  it("a genuinely empty Outlets table still resolves with [] and does not throw", async () => {
    mocks.requireAdmin.mockResolvedValue(ADMIN);
    mocks.findAll.mockResolvedValue([]);

    await expect(getOutlets()).resolves.toEqual([]);
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

  it("saves hours when given, and null when left blank -- never guessed", async () => {
    mocks.findAll.mockResolvedValue([]);

    await addOutlet(formData({ name: "Điểm bán 3", brand_id: "BR-001", open_time: "06:00", close_time: "21:00" }));
    expect(mocks.insert).toHaveBeenCalledWith(
      "Outlets",
      expect.objectContaining({ open_time: "06:00", close_time: "21:00" }),
    );

    mocks.insert.mockClear();
    await addOutlet(formData({ name: "Điểm bán 4", brand_id: "BR-001" }));
    expect(mocks.insert).toHaveBeenCalledWith(
      "Outlets",
      expect.objectContaining({ open_time: null, close_time: null }),
    );
  });
});

describe("editOutlet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(ADMIN);
  });

  it("updates name, brand, address, start date and hours in one call", async () => {
    const res = await editOutlet(formData({
      id: "OUT-001",
      name: "Cửa hàng Quận 1",
      brand_id: "BR-002",
      address: "1 Đường ABC",
      start_date: "2026-01-01",
      open_time: "07:00",
      close_time: "22:00",
    }));

    expect(res.success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Outlets", "OUT-001", {
      name: "Cửa hàng Quận 1",
      brand_id: "BR-002",
      address: "1 Đường ABC",
      start_date: "2026-01-01",
      open_time: "07:00",
      close_time: "22:00",
    });
  });

  it("refuses without a name", async () => {
    const res = await editOutlet(formData({ id: "OUT-001", brand_id: "BR-001" }));
    expect(res.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses without a brand", async () => {
    const res = await editOutlet(formData({ id: "OUT-001", name: "Cửa hàng Quận 1" }));
    expect(res.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  // Plan section 5: "code cannot be changed by posting a different value,
  // not merely disabled in the form" -- proven here by posting one and
  // confirming the update call the server actually makes carries no code
  // key at all, not just that the field was absent from a form the client
  // controls.
  it("ignores a client-posted code -- it cannot be changed by posting a different value", async () => {
    await editOutlet(formData({
      id: "OUT-001",
      name: "Cửa hàng Quận 1",
      brand_id: "BR-001",
      code: "999",
    }));

    const [, , payload] = mocks.update.mock.calls[0];
    expect(payload).not.toHaveProperty("code");
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
