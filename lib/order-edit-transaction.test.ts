import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { supersedeOrderAtomic } from "./order-edit-transaction";

describe("supersedeOrderAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("sends the whole replacement batch to one RPC with parsed JSON columns", async () => {
    mocks.rpc.mockResolvedValue({
      data: { new_order_id: "ord-new", line_count: 1, ledger_count: 2, payment_count: 2 },
      error: null,
    });
    const input = makeInput();

    await expect(supersedeOrderAtomic(input)).resolves.toEqual({
      newOrderId: "ord-new",
      lineCount: 1,
      ledgerCount: 2,
      paymentCount: 2,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("supersede_order_v2_atomic", {
      p_old_order_id: "ord-old",
      p_expected_old_version: 1,
      p_new_order: expect.objectContaining({ pos_snapshot_json: { source: "edit" } }),
      p_new_lines: [expect.objectContaining({ recipe_snapshot_json: { ingredients: [] } })],
      p_event: expect.objectContaining({ delta_json: { changed: true } }),
      p_ledger: input.ledgerRows,
      p_payments: input.payments,
    });
  });

  it("surfaces optimistic-lock and rollback errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Optimistic lock failed" },
    });

    await expect(supersedeOrderAtomic(makeInput())).rejects.toThrow(
      "supersede_order_v2_atomic: Optimistic lock failed",
    );
  });
});

function makeInput() {
  return {
    oldOrderId: "ord-old",
    expectedOldVersion: 1,
    newOrder: {
      id: "ord-new",
      pos_snapshot_json: JSON.stringify({ source: "edit" }),
      applied_promotion_snapshot_json: "{}",
    },
    newLines: [{
      id: "line-new",
      recipe_snapshot_json: JSON.stringify({ ingredients: [] }),
      product_snapshot_json: "{}",
      variant_snapshot_json: "{}",
      modifiers_snapshot_json: "[]",
    }],
    event: { id: "event-edit", delta_json: JSON.stringify({ changed: true }) },
    ledgerRows: [{ id: "rev" }, { id: "consume" }],
    payments: [
      { id: "pay-cash", order_id: "ord-new", method: "CASH", amount: 15000, reference: "" },
      { id: "pay-bank", order_id: "ord-new", method: "BANK_TRANSFER", amount: 10000, reference: "TX-1" },
    ],
  };
}
