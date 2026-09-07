import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/superpowers/plans/2026-09-07-one-price-per-topping.md Task 1 Step 4.
// The actual sync/trap/PPH- sequence logic lives in the Postgres function
// (migration 0098), matching how save_product_atomic's own tests only
// exercise this wrapper's param-forwarding and response-shaping, not SQL
// internals -- those are proven by the migration's own header comment and
// by re-using 0044's already-live id derivation, not re-tested here.

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { syncToppingPriceAtomic } from "./topping-price-sync";

describe("syncToppingPriceAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("a linked modifier updates both the modifier and its variant, and writes one PPH- history row", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        modifier_id: "MOD-002",
        variant_id: "VAR-030",
        price_history: [{ id: "PPH-042", variant_id: "VAR-030", old_price: 4000, new_price: 5000 }],
      },
      error: null,
    });

    const result = await syncToppingPriceAtomic({
      modifierId: "MOD-002",
      price: 5000,
      name: "Kem muối",
      groupName: "Topping",
    });

    expect(result).toEqual({
      modifierId: "MOD-002",
      variantId: "VAR-030",
      priceHistory: [{ id: "PPH-042", variant_id: "VAR-030", old_price: 4000, new_price: 5000 }],
    });
    expect(result.priceHistory[0].id).toMatch(/^PPH-\d+$/);
    expect(mocks.rpc).toHaveBeenCalledWith("sync_topping_price_atomic", {
      p_modifier_id: "MOD-002",
      p_price: 5000,
      p_name: "Kem muối",
      p_group_name: "Topping",
    });
  });

  it("a modifier with no linked product (MOD-009's shape) updates only itself", async () => {
    mocks.rpc.mockResolvedValue({
      data: { modifier_id: "MOD-009", variant_id: null, price_history: [] },
      error: null,
    });

    const result = await syncToppingPriceAtomic({
      modifierId: "MOD-009",
      price: 12000,
      name: "Hộp sữa chua",
      groupName: "Topping",
    });

    expect(result).toEqual({ modifierId: "MOD-009", variantId: null, priceHistory: [] });
  });

  it("throws when the RPC reports two ACTIVE modifiers on one product", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Product PROD-035 has 2 ACTIVE modifiers -- price sync needs exactly one writer' },
    });

    await expect(
      syncToppingPriceAtomic({ modifierId: "MOD-008", price: 11000, name: "Dâu sấy", groupName: "Topping" }),
    ).rejects.toThrow(/2 ACTIVE modifiers/);
  });

  it("throws when the RPC reports the product has other than one ACTIVE variant", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Product PROD-035 has 2 ACTIVE variants -- "the standalone price" is not a single number' },
    });

    await expect(
      syncToppingPriceAtomic({ modifierId: "MOD-008", price: 11000, name: "Dâu sấy", groupName: "Topping" }),
    ).rejects.toThrow(/ACTIVE variants/);
  });
});
