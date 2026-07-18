import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import { voidOrderAtomic } from "./void-order-transaction";

describe("voidOrderAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("sends the complete void mutation to one RPC call", async () => {
    mocks.rpc.mockResolvedValue({
      data: { order_id: "ord-1", reversal_count: 1, already_voided: false },
      error: null,
    });

    const result = await voidOrderAtomic({
      orderId: "ord-1",
      event: { id: "evt-1", event_type: "VOIDED", delta_json: "{\"voided\":true}" },
      reversalRows: [{ id: "stk-1", transaction_type: "EDIT_REVERSAL" }],
      voidedAt: "2026-07-19T00:00:00.000Z",
      voidedById: "admin-1",
      reason: "Customer request",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("void_order_atomic", {
      p_order_id: "ord-1",
      p_event: { id: "evt-1", event_type: "VOIDED", delta_json: { voided: true } },
      p_reversal_ledger: [{ id: "stk-1", transaction_type: "EDIT_REVERSAL" }],
      p_voided_at: "2026-07-19T00:00:00.000Z",
      p_voided_by_id: "admin-1",
      p_reason: "Customer request",
    });
    expect(result).toEqual({ orderId: "ord-1", reversalCount: 1, alreadyVoided: false });
  });

  it("surfaces an RPC failure without falling back to sequential writes", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "forced rollback" } });

    await expect(voidOrderAtomic({
      orderId: "ord-1",
      event: { id: "evt-1", event_type: "VOIDED" },
      reversalRows: [],
      voidedAt: "2026-07-19T00:00:00.000Z",
      voidedById: "admin-1",
      reason: "Customer request",
    })).rejects.toThrow("void_order_atomic: forced rollback");
  });
});
