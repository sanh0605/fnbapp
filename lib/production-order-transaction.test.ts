import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}));

import { saveProductionOrderAtomic } from "./production-order-transaction";

describe("saveProductionOrderAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("sends the canonical production batch to one RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: { production_order_id: "PRD-001", item_count: 1, ledger_count: 2 },
      error: null,
    });
    const input = {
      order: {
        semi_product_id: "BTP-001",
        batch_yield: 100,
        status: "COMPLETED",
        created_by_id: "admin-1",
      },
      items: [{
        ingredient_id: "ING-001",
        ingredient_type: "BASE_INGREDIENT",
        quantity: 20,
        unit_id: "UNT-G",
      }],
      ledgerRows: [
        { transaction_type: "PRODUCTION_CONSUME", item_reference: "ING-001", quantity_change: -20 },
        { transaction_type: "PRODUCTION_YIELD", item_reference: "BTP-001", quantity_change: 100 },
      ],
    };

    const result = await saveProductionOrderAtomic(input);

    expect(mocks.rpc).toHaveBeenCalledWith("save_production_order_atomic", {
      p_order: input.order,
      p_items: input.items,
      p_ledger: input.ledgerRows,
    });
    expect(result).toEqual({ productionOrderId: "PRD-001", itemCount: 1, ledgerCount: 2 });
  });

  it("surfaces RPC rollback errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "forced rollback" } });

    await expect(saveProductionOrderAtomic({
      order: { semi_product_id: "BTP-001", batch_yield: 100 },
      items: [],
      ledgerRows: [{
        transaction_type: "PRODUCTION_YIELD",
        item_reference: "BTP-001",
        quantity_change: 100,
      }],
    })).rejects.toThrow("save_production_order_atomic: forced rollback");
  });
});
