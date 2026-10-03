import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requireOwner: mocks.requireOwner,
}));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllWhere: mocks.findAllWhere,
  findById: mocks.findById,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  addCashTransfer,
  cancelCashTransfer,
  deleteCashTransfer,
  getCashTransfers,
  updateCashTransfer,
} from "./actions";

const ADMIN = { ok: true as const, actor: { id: "usr-1", name: "Chủ quán", role: "ADMIN" as const } };
const MANAGER_DENIED = { ok: false as const, error: "Chỉ chủ quán mới được xoá hẳn" };

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const goodFields = {
  transfer_date: "2026-09-10",
  amount: "5.000.000",
  from: "CASH",
  to: "BA-001",
  note: "Gửi két",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue(ADMIN);
  mocks.findAll.mockResolvedValue([
    { id: "BA-001", name: "ACB - Phin Di", status: "ACTIVE" },
    { id: "BA-002", name: "Cũ", status: "INACTIVE" },
  ]);
  mocks.generateNewId.mockResolvedValue("CT-001");
});

describe("addCashTransfer", () => {
  it("writes an ACTIVE row with the parsed fields and audit columns", async () => {
    const result = await addCashTransfer(formData(goodFields));

    expect(result.error).toBeUndefined();
    expect(mocks.generateNewId).toHaveBeenCalledWith("Cash_Transfers", "CT");
    expect(mocks.insert).toHaveBeenCalledWith("Cash_Transfers", {
      id: "CT-001",
      transfer_date: "2026-09-10",
      amount: 5_000_000,
      from_account_id: null,
      to_account_id: "BA-001",
      note: "Gửi két",
      status: "ACTIVE",
      created_by_id: "usr-1",
      created_by_name: "Chủ quán",
      updated_by_id: "usr-1",
      updated_by_name: "Chủ quán",
    });
  });

  it("accepts 150.000 as 150000", async () => {
    await addCashTransfer(formData({ ...goodFields, amount: "150.000" }));
    expect(mocks.insert.mock.calls[0][1].amount).toBe(150000);
  });

  it.each([
    [{ transfer_date: "" }, "Chọn ngày chuyển"],
    [{ amount: "0" }, "Số tiền phải lớn hơn 0"],
    [{ from: "CASH", to: "CASH" }, "Nơi chuyển và nơi nhận phải khác nhau"],
    [{ from: "BA-001", to: "BA-001" }, "Nơi chuyển và nơi nhận phải khác nhau"],
    [{ to: "BA-002" }, "Tài khoản không còn dùng"],
    [{ to: "BA-404" }, "Tài khoản không còn dùng"],
  ])("refuses %j with %s and writes nothing", async (over, message) => {
    const result = await addCashTransfer(formData({ ...goodFields, ...over }));
    expect(result.error).toBe(message);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses when not signed in as admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Chưa đăng nhập" });
    const result = await addCashTransfer(formData(goodFields));
    expect(result.error).toBe("Chưa đăng nhập");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("updateCashTransfer", () => {
  it("refuses a cancelled row", async () => {
    mocks.findById.mockResolvedValue({ id: "CT-001", status: "CANCELLED" });
    const result = await updateCashTransfer(formData({ id: "CT-001", ...goodFields }));
    expect(result.error).toBe("Dòng đã huỷ, không sửa được");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates an active row with the parsed fields and the editor, not a new status", async () => {
    mocks.findById.mockResolvedValue({ id: "CT-001", status: "ACTIVE" });
    const result = await updateCashTransfer(formData({ id: "CT-001", ...goodFields }));
    expect(result.error).toBeUndefined();
    const [, id, patch] = mocks.update.mock.calls[0];
    expect(id).toBe("CT-001");
    expect(patch).toMatchObject({ amount: 5_000_000, updated_by_id: "usr-1" });
    expect(patch).not.toHaveProperty("status");
  });

  it("says so when the row does not exist", async () => {
    mocks.findById.mockResolvedValue(null);
    const result = await updateCashTransfer(formData({ id: "CT-404", ...goodFields }));
    expect(result.error).toBe("Không tìm thấy dòng chuyển tiền");
  });
});

describe("cancelCashTransfer", () => {
  it("sets CANCELLED and keeps the row", async () => {
    mocks.findById.mockResolvedValue({ id: "CT-001", status: "ACTIVE" });
    const result = await cancelCashTransfer(formData({ id: "CT-001" }));
    expect(result.error).toBeUndefined();
    expect(mocks.update.mock.calls[0][2]).toMatchObject({ status: "CANCELLED", updated_by_id: "usr-1" });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("refuses an already cancelled row", async () => {
    mocks.findById.mockResolvedValue({ id: "CT-001", status: "CANCELLED" });
    const result = await cancelCashTransfer(formData({ id: "CT-001" }));
    expect(result.error).toBe("Dòng đã huỷ rồi");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("deleteCashTransfer", () => {
  it("is refused for a non-owner and removes nothing", async () => {
    mocks.requireOwner.mockResolvedValue(MANAGER_DENIED);
    const result = await deleteCashTransfer(formData({ id: "CT-001" }));
    expect(result.error).toBe(MANAGER_DENIED.error);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("removes the row for the owner", async () => {
    mocks.requireOwner.mockResolvedValue(ADMIN);
    const result = await deleteCashTransfer(formData({ id: "CT-001" }));
    expect(result.error).toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith("Cash_Transfers", "CT-001");
  });
});

describe("getCashTransfers", () => {
  it("reads every transfer up to the day, with no lower bound", async () => {
    mocks.findAllWhere.mockResolvedValue([]);
    await getCashTransfers("2026-09-30");
    expect(mocks.findAllWhere).toHaveBeenCalledWith("Cash_Transfers", {
      lte: { transfer_date: "2026-09-30" },
    });
  });
});
