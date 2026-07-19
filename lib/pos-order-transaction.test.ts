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
      clientRequestId: "request-1",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_pos_order_atomic", {
      p_brand_code: "PHD",
      p_order: { id: "ord-1" },
      p_lines: [{ id: "line-1" }],
      p_event: { id: "event-1" },
      p_ledger: [{ id: "stock-1" }, { id: "stock-2" }],
      p_client_request_id: "request-1",
    });
    expect(result).toEqual({
      orderId: "ord-1",
      orderNo: "PHD000999",
      lineCount: 1,
      ledgerCount: 2,
      paymentCount: 0,
    });
  });

  it("sends split payments and validates the persisted payment count", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        order_id: "ord-split",
        order_no: "PHD001001",
        line_count: 1,
        ledger_count: 1,
        payment_count: 2,
      },
      error: null,
    });

    const result = await savePosOrderAtomic({
      brandCode: "PHD",
      order: { id: "ord-split" },
      lines: [{ id: "line-1" }],
      event: { id: "event-1" },
      ledgerRows: [{ id: "stock-1" }],
      payments: [
        { id: "pay-1", method: "CASH", amount: 30000 },
        { id: "pay-2", method: "BANK_TRANSFER", amount: 20000, reference: "TX123" },
      ],
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_pos_order_atomic",
      expect.objectContaining({
        p_payments: [
          { id: "pay-1", method: "CASH", amount: 30000 },
          { id: "pay-2", method: "BANK_TRANSFER", amount: 20000, reference: "TX123" },
        ],
      }),
    );
    expect(result).toEqual({
      orderId: "ord-split",
      orderNo: "PHD001001",
      lineCount: 1,
      ledgerCount: 1,
      paymentCount: 2,
    });
  });

  it("fails closed when the persisted payment count does not match what was sent", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        order_id: "ord-split",
        order_no: "PHD001001",
        line_count: 1,
        ledger_count: 1,
        payment_count: 1,
      },
      error: null,
    });

    await expect(savePosOrderAtomic({
      brandCode: "PHD",
      order: { id: "ord-split" },
      lines: [{ id: "line-1" }],
      event: { id: "event-1" },
      ledgerRows: [{ id: "stock-1" }],
      payments: [
        { id: "pay-1", method: "CASH", amount: 30000 },
        { id: "pay-2", method: "BANK_TRANSFER", amount: 20000 },
      ],
    })).rejects.toThrow("persisted row count mismatch");
  });

  it("keeps the idempotency key optional for legacy callers", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        order_id: "ord-legacy",
        order_no: "PHD000998",
        line_count: 1,
        ledger_count: 0,
      },
      error: null,
    });

    await savePosOrderAtomic({
      brandCode: "PHD",
      order: { id: "ord-legacy" },
      lines: [{ id: "line-legacy" }],
      event: { id: "event-legacy" },
      ledgerRows: [],
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_pos_order_atomic",
      expect.not.objectContaining({ p_client_request_id: expect.anything() }),
    );
  });

  it("returns the same persisted bill when an ambiguous success is retried", async () => {
    const persistedOrders = new Map<string, {
      order_id: string;
      order_no: string;
      line_count: number;
      ledger_count: number;
      idempotent_replay: boolean;
    }>();
    const persistedLineIds = new Set<string>();
    const persistedLedgerIds = new Set<string>();
    mocks.rpc.mockImplementation(async (_name: string, args: any) => {
      const requestId = String(args.p_client_request_id);
      const existing = persistedOrders.get(requestId);
      if (existing) {
        return {
          data: { ...existing, idempotent_replay: true },
          error: null,
        };
      }

      const persisted = {
        order_id: String(args.p_order.id),
        order_no: "PHD001000",
        line_count: args.p_lines.length,
        ledger_count: args.p_ledger.length,
        idempotent_replay: false,
      };
      persistedOrders.set(requestId, persisted);
      args.p_lines.forEach((line: { id: string }) => persistedLineIds.add(line.id));
      args.p_ledger.forEach((row: { id: string }) => persistedLedgerIds.add(row.id));
      return { data: persisted, error: null };
    });
    const common = {
      brandCode: "PHD",
      clientRequestId: "request-ambiguous-success",
    };

    const firstResponse = await savePosOrderAtomic({
      ...common,
      order: { id: "ord-first-generated" },
      lines: [{ id: "line-first-generated" }],
      event: { id: "event-first-generated" },
      ledgerRows: [{ id: "ledger-first-generated" }],
    });
    const retryResponse = await savePosOrderAtomic({
      ...common,
      order: { id: "ord-second-generated" },
      lines: [{ id: "line-second-generated" }],
      event: { id: "event-second-generated" },
      ledgerRows: [{ id: "ledger-second-generated" }],
    });

    expect(retryResponse).toEqual(firstResponse);
    expect(retryResponse).toMatchObject({
      orderId: "ord-first-generated",
      orderNo: "PHD001000",
    });
    expect(persistedOrders.size).toBe(1);
    expect(persistedLineIds.size).toBe(1);
    expect(persistedLedgerIds.size).toBe(1);
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "create_pos_order_atomic",
      expect.objectContaining({
        p_client_request_id: "request-ambiguous-success",
      }),
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      "create_pos_order_atomic",
      expect.objectContaining({
        p_client_request_id: "request-ambiguous-success",
      }),
    );
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
