import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import {
  approveStockAdjustmentAtomic,
  submitStockAdjustmentAtomic,
} from "./stock-adjustment-transaction";

describe("stock adjustment atomic adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("submits one approved adjustment and its ledger effect through one RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: { adjustment_id: "SADJ-001", ledger_count: 1 },
      error: null,
    });
    const adjustment = {
      item_reference: "ING-001",
      theoretical_qty: 10,
      actual_qty: 9,
      difference: -1,
      reason: "Kiểm kê",
      created_by_id: "admin-1",
      created_by_name: "Admin",
      approved_by: "Admin",
      created_at: "2026-07-19T00:00:00.000Z",
      approved_at: "2026-07-19T00:00:00.000Z",
    };

    await expect(submitStockAdjustmentAtomic(adjustment)).resolves.toEqual({
      adjustmentId: "SADJ-001",
      ledgerCount: 1,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("submit_stock_adjustment_atomic", {
      p_adjustment: adjustment,
    });
  });

  it("approves or repairs one existing adjustment through one RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        adjustment_id: "SADJ-001",
        ledger_count: 1,
        already_completed: true,
      },
      error: null,
    });

    await expect(approveStockAdjustmentAtomic({
      adjustmentId: "SADJ-001",
      approvedBy: "Admin",
      approvedAt: "2026-07-19T00:00:00.000Z",
    })).resolves.toEqual({
      adjustmentId: "SADJ-001",
      ledgerCount: 1,
      alreadyCompleted: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("approve_stock_adjustment_atomic", {
      p_adjustment_id: "SADJ-001",
      p_approved_by: "Admin",
      p_approved_at: "2026-07-19T00:00:00.000Z",
    });
  });

  it("surfaces a transaction rollback", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "forced rollback" } });

    await expect(submitStockAdjustmentAtomic({})).rejects.toThrow(
      "submit_stock_adjustment_atomic: forced rollback",
    );
  });
});
