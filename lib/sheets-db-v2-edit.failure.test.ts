import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ supersedeOrderAtomic: vi.fn() }));
vi.mock("@/lib/order-edit-transaction", () => ({
  supersedeOrderAtomic: mocks.supersedeOrderAtomic,
}));

import {
  supersedeOrderV2,
  type SupersedeOrderV2Input,
} from "./sheets-db-v2-edit";

describe("supersedeOrderV2 atomic failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves no intermediate state after a forced rollback and permits retry", async () => {
    mocks.supersedeOrderAtomic
      .mockRejectedValueOnce(new Error("forced rollback"))
      .mockResolvedValueOnce({ newOrderId: "ord-new", lineCount: 1 });

    await expect(supersedeOrderV2(makeInput())).resolves.toEqual({
      success: false,
      error: "forced rollback",
    });
    await expect(supersedeOrderV2(makeInput())).resolves.toEqual({ success: true });
    expect(mocks.supersedeOrderAtomic).toHaveBeenCalledTimes(2);
  });

  it("returns the optimistic-lock failure produced inside the RPC", async () => {
    mocks.supersedeOrderAtomic.mockRejectedValue(
      new Error("Optimistic lock failed: expected version 1 but found 2"),
    );

    const result = await supersedeOrderV2(makeInput());

    expect(result).toEqual({
      success: false,
      error: "Optimistic lock failed: expected version 1 but found 2",
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
    payments: [{
      id: "pay-new",
      order_id: "ord-new",
      method: "CASH",
      amount: 30_000,
      reference: "",
    }],
  };
}
