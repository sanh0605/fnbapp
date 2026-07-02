import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { savePosOrderAtomic } from "@/lib/pos-order-transaction";

describe("savePosOrderAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the complete bill in one database call", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        order_id: "ord-1",
        order_no: "PHD000999",
        line_count: 1,
        ledger_count: 2,
      },
      error: null,
    });

    const result = await savePosOrderAtomic({
      brandCode: "PHD",
      order: { id: "ord-1" },
      lines: [{ id: "line-1" }],
      event: { id: "event-1" },
      ledgerRows: [{ id: "stock-1" }, { id: "stock-2" }],
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_pos_order_atomic", {
      p_brand_code: "PHD",
      p_order: { id: "ord-1" },
      p_lines: [{ id: "line-1" }],
      p_event: { id: "event-1" },
      p_ledger: [{ id: "stock-1" }, { id: "stock-2" }],
    });
    expect(result).toEqual({
      orderId: "ord-1",
      orderNo: "PHD000999",
      lineCount: 1,
      ledgerCount: 2,
    });
  });

  it("fails closed on database errors or count mismatches", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "transaction aborted" },
    });
    await expect(
      savePosOrderAtomic({
        brandCode: "PHD",
        order: { id: "ord-1" },
        lines: [],
        event: { id: "event-1" },
        ledgerRows: [],
      }),
    ).rejects.toThrow("transaction aborted");

    mocks.rpc.mockResolvedValueOnce({
      data: {
        order_id: "ord-1",
        order_no: "PHD000999",
        line_count: 0,
        ledger_count: 0,
      },
      error: null,
    });
    await expect(
      savePosOrderAtomic({
        brandCode: "PHD",
        order: { id: "ord-1" },
        lines: [{ id: "line-1" }],
        event: { id: "event-1" },
        ledgerRows: [],
      }),
    ).rejects.toThrow("persisted row count mismatch");
  });

  it("converts legacy JSON strings before sending them to jsonb columns", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        order_id: "ord-1",
        order_no: "PHD000999",
        line_count: 1,
        ledger_count: 0,
      },
      error: null,
    });

    await savePosOrderAtomic({
      brandCode: "PHD",
      order: {
        id: "ord-1",
        pos_snapshot_json: "{\"source\":\"POS\"}",
        applied_promotion_snapshot_json: "",
      },
      lines: [{
        id: "line-1",
        product_snapshot_json: "{\"name\":\"Coffee\"}",
        modifiers_snapshot_json: "[]",
      }],
      event: { id: "event-1", delta_json: "{\"line_count\":1}" },
      ledgerRows: [],
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_pos_order_atomic",
      expect.objectContaining({
        p_order: expect.objectContaining({
          pos_snapshot_json: { source: "POS" },
          applied_promotion_snapshot_json: {},
        }),
        p_lines: [expect.objectContaining({
          product_snapshot_json: { name: "Coffee" },
          modifiers_snapshot_json: [],
        })],
        p_event: expect.objectContaining({
          delta_json: { line_count: 1 },
        }),
      }),
    );
  });
});
