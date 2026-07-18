import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ supersedeOrderAtomic: vi.fn() }));
vi.mock("@/lib/order-edit-transaction", () => ({
  supersedeOrderAtomic: mocks.supersedeOrderAtomic,
}));

import { supersedeOrderV2, type SupersedeOrderV2Input } from "./sheets-db-v2-edit";

describe("supersedeOrderV2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the replacement order, lines, event, and combined ledger batch", async () => {
    mocks.supersedeOrderAtomic.mockResolvedValue({
      newOrderId: "ord-new",
      lineCount: 1,
      ledgerCount: 2,
    });
    const input = makeInput();

    await expect(supersedeOrderV2(input)).resolves.toEqual({ success: true });
    expect(mocks.supersedeOrderAtomic).toHaveBeenCalledWith({
      oldOrderId: "ord-old",
      expectedOldVersion: 1,
      newOrder: input.newOrder,
      newLines: input.newLines,
      event: input.event,
      ledgerRows: [...input.reversalEntries, ...input.consumeEntries],
    });
  });

  it.each([
    "Optimistic lock failed: expected version 1 but found 2",
    "Order status is VOIDED, must be COMPLETED to edit",
  ])("returns an RPC invariant failure without changing the public result shape", async (message) => {
    mocks.supersedeOrderAtomic.mockRejectedValue(new Error(message));

    await expect(supersedeOrderV2(makeInput())).resolves.toEqual({
      success: false,
      error: message,
    });
  });
});

function makeInput(): SupersedeOrderV2Input {
  return {
    oldOrderId: "ord-old",
    expectedOldVersion: 1,
    newOrder: {
      id: "ord-new",
      status: "COMPLETED",
      version: 2,
      parent_order_id: "ord-old",
    } as SupersedeOrderV2Input["newOrder"],
    newLines: [{ id: "line-new", order_id: "ord-new" }] as SupersedeOrderV2Input["newLines"],
    event: {
      id: "event-edit",
      order_id: "ord-new",
      event_type: "EDITED",
    } as SupersedeOrderV2Input["event"],
    reversalEntries: [{
      id: "ledger-reversal",
      transaction_type: "EDIT_REVERSAL",
      reference_id: "ord-old",
      item_reference: "ING-001",
      quantity_change: 10,
      unit_cost: 100,
      created_at: "2026-07-19T00:00:00.000Z",
      order_event_id: "event-edit",
      cost_at_sale: 1_000,
    }],
    consumeEntries: [{
      id: "ledger-consume",
      transaction_type: "SALES_CONSUME",
      reference_id: "ord-new",
      item_reference: "ING-001",
      quantity_change: -12,
      unit_cost: 100,
      created_at: "2026-07-19T00:00:00.000Z",
      order_event_id: "event-edit",
      cost_at_sale: 1_200,
    }],
  };
}
