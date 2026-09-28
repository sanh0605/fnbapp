import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { saveProductAtomic } from "./product-save-transaction";

describe("saveProductAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("sends one catalog write plan to the atomic RPC, with no recipe fields", async () => {
    // Recipes were removed (owner 2026-08-27; table dropped by 0105): the
    // RPC result carries no recipe_count and nothing checks one.
    mocks.rpc.mockResolvedValue({
      data: {
        product_id: "PROD-001",
        variant_count: 1,
        price_history_count: 1,
        removed_variant_count: 0,
      },
      error: null,
    });
    const input = {
      isEdit: false,
      product: { category_id: "CAT-001", name: "Món mới" },
      variants: [{ id: null, size_name: "M", price: 30_000 }],
      removedVariantIds: [],
      effectiveAt: "2026-07-19T00:00:00.000Z",
      expectedPriceHistoryCount: 1,
    };

    await expect(saveProductAtomic(input)).resolves.toEqual({
      productId: "PROD-001",
      variantCount: 1,
      priceHistoryCount: 1,
      removedVariantCount: 0,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("save_product_atomic", {
      p_is_edit: false,
      p_product: input.product,
      p_variants: input.variants,
      p_removed_variant_ids: [],
      p_effective_at: input.effectiveAt,
    });
  });

  it("refuses a result whose price-history count differs from the plan", async () => {
    mocks.rpc.mockResolvedValue({
      data: { product_id: "PROD-001", variant_count: 1, price_history_count: 0, removed_variant_count: 0 },
      error: null,
    });

    await expect(saveProductAtomic({
      isEdit: false,
      product: { category_id: "CAT-001", name: "Món mới" },
      variants: [{ id: null, size_name: "M", price: 30_000 }],
      removedVariantIds: [],
      effectiveAt: "2026-07-19T00:00:00.000Z",
      expectedPriceHistoryCount: 1,
    })).rejects.toThrow("save_product_atomic persisted row count mismatch");
  });

  it("surfaces a rollback error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "forced rollback" } });

    await expect(saveProductAtomic({
      isEdit: true,
      product: { id: "PROD-001" },
      variants: [],
      removedVariantIds: [],
      effectiveAt: "2026-07-19T00:00:00.000Z",
      expectedPriceHistoryCount: 0,
    })).rejects.toThrow("save_product_atomic: forced rollback");
  });
});
