import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { savePurchaseOrderAtomic } from "@/lib/purchase-order-transaction";

describe("savePurchaseOrderAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the complete PO write plan to one RPC call", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        purchase_order_id: "PO-050",
        line_count: 1,
        ledger_count: 1,
      },
      error: null,
    });

    const result = await savePurchaseOrderAtomic({
      order: { id: "", status: "COMPLETED" },
      lines: [{ id: "pol-uuid", quantity: 1 }],
      ledgerRows: [{ id: "stk-uuid", unit_cost: 19.6 }],
      replaceExisting: false,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("save_purchase_order_atomic", {
      p_order: { id: "", status: "COMPLETED" },
      p_lines: [{ id: "pol-uuid", quantity: 1 }],
      p_ledger: [{ id: "stk-uuid", unit_cost: 19.6 }],
      p_replace_existing: false,
    });
    expect(result.purchaseOrderId).toBe("PO-050");
  });

  it("surfaces RPC errors without attempting client-side cleanup", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "transaction aborted" },
    });

    await expect(
      savePurchaseOrderAtomic({
        order: { id: "PO-050" },
        lines: [],
        ledgerRows: [],
        replaceExisting: true,
      }),
    ).rejects.toThrow("transaction aborted");
  });

  it("rejects a response whose persisted counts do not match the write plan", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        purchase_order_id: "PO-050",
        line_count: 1,
        ledger_count: 0,
      },
      error: null,
    });

    await expect(
      savePurchaseOrderAtomic({
        order: { id: "" },
        lines: [{ id: "pol-uuid" }],
        ledgerRows: [{ id: "stk-uuid" }],
        replaceExisting: false,
      }),
    ).rejects.toThrow("persisted row count mismatch");
  });
});
