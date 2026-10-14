import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/db/supabase", () => ({
  getSupabaseClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { savePurchaseOrderAtomic } from "@/lib/purchasing/purchase-order-transaction";

describe("savePurchaseOrderAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the complete PO write plan to one RPC call", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        purchase_order_id: "PO-050",
        line_count: 1,
      },
      error: null,
    });

    const result = await savePurchaseOrderAtomic({
      order: { id: "", status: "COMPLETED" },
      lines: [{ id: "pol-uuid", quantity: 1 }],
      replaceExisting: false,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("save_purchase_order_atomic", {
      p_order: { id: "", status: "COMPLETED" },
      p_lines: [{ id: "pol-uuid", quantity: 1 }],
      p_replace_existing: false,
    });
    expect(result.purchaseOrderId).toBe("PO-050");
  });

  it("sends the asset plan in the same RPC call, so order and assets commit together (audit A7)", async () => {
    mocks.rpc.mockResolvedValue({ data: { purchase_order_id: "PO-051", line_count: 1 }, error: null });
    const assets = {
      create: [{
        purchased_item_id: "SPM-200", purchase_order_line_id: "POL-002", name_snapshot: "Bình nhựa",
        unit_cost: 95_150, total_cost: 761_200, quantity: 8, term_months: 12, acquired_date: "2026-08-20",
      }],
      update: [{ id: "TS-018", patch: { quantity: 3 } }],
      retire: ["TS-019"],
    };

    await savePurchaseOrderAtomic({
      order: { id: "PO-051" },
      lines: [{ id: "POL-002" }],
      replaceExisting: true,
      assets,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("save_purchase_order_atomic", {
      p_order: { id: "PO-051" },
      p_lines: [{ id: "POL-002" }],
      p_replace_existing: true,
      p_assets: assets,
    });
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
        replaceExisting: true,
      }),
    ).rejects.toThrow("transaction aborted");
  });

  it("rejects a response whose persisted line count does not match the write plan", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        purchase_order_id: "PO-050",
        line_count: 0,
      },
      error: null,
    });

    await expect(
      savePurchaseOrderAtomic({
        order: { id: "" },
        lines: [{ id: "pol-uuid" }],
        replaceExisting: false,
      }),
    ).rejects.toThrow("persisted row count mismatch");
  });
});
