import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  submitStockAdjustmentAtomic: vi.fn(),
  approveStockAdjustmentAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  unstableCache: vi.fn((fn: unknown) => fn),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("@/lib/stock-adjustment-transaction", () => ({
  submitStockAdjustmentAtomic: mocks.submitStockAdjustmentAtomic,
  approveStockAdjustmentAtomic: mocks.approveStockAdjustmentAtomic,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_cache: mocks.unstableCache,
}));

import { approveStockAdjustment, submitStockAdjustment } from "./actions";

describe("stock adjustment atomic persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin", role: "ADMIN" },
    });
  });

  it("submits an approved adjustment through one atomic RPC", async () => {
    mocks.submitStockAdjustmentAtomic.mockResolvedValue({
      adjustmentId: "SADJ-001",
      ledgerCount: 1,
    });

    await expect(submitStockAdjustment(makeAdjustmentInput())).resolves.toEqual({
      success: true,
    });
    expect(mocks.submitStockAdjustmentAtomic).toHaveBeenCalledTimes(1);
    expect(mocks.submitStockAdjustmentAtomic.mock.calls[0][0]).toMatchObject({
      item_reference: "ING-001",
      theoretical_qty: 10,
      actual_qty: 9,
      difference: -1,
      reason: "Kiểm kê",
      status: "APPROVED",
      created_by_id: "admin-1",
      created_by_name: "Admin",
      approved_by: "Admin",
    });
  });

  it("leaves no partial submit state after rollback and permits a clean retry", async () => {
    mocks.submitStockAdjustmentAtomic
      .mockRejectedValueOnce(new Error("forced rollback"))
      .mockResolvedValueOnce({ adjustmentId: "SADJ-001", ledgerCount: 1 });

    await expect(submitStockAdjustment(makeAdjustmentInput())).resolves.toEqual({
      error: "forced rollback",
    });
    await expect(submitStockAdjustment(makeAdjustmentInput())).resolves.toEqual({
      success: true,
    });
    expect(mocks.submitStockAdjustmentAtomic).toHaveBeenCalledTimes(2);
  });

  it("approves an existing adjustment through the completion-aware RPC", async () => {
    mocks.approveStockAdjustmentAtomic.mockResolvedValue({
      adjustmentId: "SADJ-EXISTING",
      ledgerCount: 1,
      alreadyCompleted: false,
    });

    await expect(approveStockAdjustment("SADJ-EXISTING")).resolves.toEqual({
      success: true,
    });
    expect(mocks.approveStockAdjustmentAtomic).toHaveBeenCalledWith({
      adjustmentId: "SADJ-EXISTING",
      approvedBy: "Admin",
      approvedAt: expect.any(String),
    });
  });

  it("repairs an approved-without-ledger legacy state on retry", async () => {
    mocks.approveStockAdjustmentAtomic
      .mockRejectedValueOnce(new Error("forced rollback"))
      .mockResolvedValueOnce({
        adjustmentId: "SADJ-EXISTING",
        ledgerCount: 1,
        alreadyCompleted: false,
      });

    await expect(approveStockAdjustment("SADJ-EXISTING")).resolves.toEqual({
      error: "forced rollback",
    });
    await expect(approveStockAdjustment("SADJ-EXISTING")).resolves.toEqual({
      success: true,
    });
    expect(mocks.approveStockAdjustmentAtomic).toHaveBeenCalledTimes(2);
  });
});

function makeAdjustmentInput(): Record<string, unknown> {
  return {
    item_id: "ING-001",
    theoretical_qty: 10,
    actual_qty: 9,
    difference: -1,
    reason: "Kiểm kê",
  };
}
