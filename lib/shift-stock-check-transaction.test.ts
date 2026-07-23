import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { openShiftStockCheckAtomic, closeShiftStockCheckAtomic } from "@/lib/shift-stock-check-transaction";

describe("openShiftStockCheckAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends opened-by identity and the checked items to the RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: "SHF-001",
        status: "OPEN",
        opened_by_id: "u1",
        opened_by_name: "Chủ quán",
        opened_at: "2026-07-23T00:00:00Z",
        notes: "",
        checks: [{ id: "CHK-0001", item_reference: "BTP-013", counted_qty: 10, theoretical_qty: 10, variance: 0 }],
      },
      error: null,
    });

    const result = await openShiftStockCheckAtomic({
      openedById: "u1",
      openedByName: "Chủ quán",
      checks: [{ itemReference: "BTP-013", countedQty: 10 }],
    });

    expect(mocks.rpc).toHaveBeenCalledWith("open_shift_stock_check_atomic", {
      p_opened_by_id: "u1",
      p_opened_by_name: "Chủ quán",
      p_checks: [{ item_reference: "BTP-013", counted_qty: 10 }],
      p_notes: "",
    });
    expect(result.id).toBe("SHF-001");
    expect(result.checks[0].variance).toBe(0);
  });

  it("throws with the RPC name on database error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(
      openShiftStockCheckAtomic({ openedById: "u1", openedByName: "A", checks: [{ itemReference: "BTP-013", countedQty: 1 }] }),
    ).rejects.toThrow("open_shift_stock_check_atomic: boom");
  });
});

describe("closeShiftStockCheckAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends closed-by identity, shift id, and the checked items to the RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: "SHF-001",
        status: "CLOSED",
        closed_by_id: "u1",
        closed_by_name: "Chủ quán",
        closed_at: "2026-07-23T05:00:00Z",
        checks: [{ id: "CHK-0002", item_reference: "BTP-013", counted_qty: 8, theoretical_qty: 9, variance: -1 }],
      },
      error: null,
    });

    const result = await closeShiftStockCheckAtomic({
      shiftId: "SHF-001",
      closedById: "u1",
      closedByName: "Chủ quán",
      checks: [{ itemReference: "BTP-013", countedQty: 8 }],
    });

    expect(mocks.rpc).toHaveBeenCalledWith("close_shift_stock_check_atomic", {
      p_shift_id: "SHF-001",
      p_closed_by_id: "u1",
      p_closed_by_name: "Chủ quán",
      p_checks: [{ item_reference: "BTP-013", counted_qty: 8 }],
      p_notes: null,
    });
    expect(result.checks[0].variance).toBe(-1);
  });

  it("throws with the RPC name on database error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "already closed" } });

    await expect(
      closeShiftStockCheckAtomic({ shiftId: "SHF-001", closedById: "u1", closedByName: "A", checks: [{ itemReference: "BTP-013", countedQty: 1 }] }),
    ).rejects.toThrow("close_shift_stock_check_atomic: already closed");
  });
});
