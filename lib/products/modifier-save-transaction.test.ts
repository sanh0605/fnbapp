import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { saveModifierAtomic } from "./modifier-save-transaction";

const modifier = { id: "MOD-004", name: "Trân châu trắng", price: 5000, group_id: "MG-001", is_default: false, max_qty: 2 };

describe("saveModifierAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("sends the option to one RPC and shapes the synced-price result", async () => {
    mocks.rpc.mockResolvedValue({
      data: { modifier_id: "MOD-004", variant_id: "VAR-030", price_history: [{ id: "PPH-042", variant_id: "VAR-030", old_price: 4000, new_price: 5000 }] },
      error: null,
    });
    await expect(saveModifierAtomic({ isEdit: true, modifier })).resolves.toEqual({
      modifierId: "MOD-004",
      variantId: "VAR-030",
      priceHistory: [{ id: "PPH-042", variant_id: "VAR-030", old_price: 4000, new_price: 5000 }],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("save_modifier_atomic", { p_is_edit: true, p_modifier: modifier });
  });

  it("surfaces a rollback error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "forced rollback" } });
    await expect(saveModifierAtomic({ isEdit: false, modifier })).rejects.toThrow("save_modifier_atomic: forced rollback");
  });
});
