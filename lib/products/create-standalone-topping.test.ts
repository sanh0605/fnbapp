import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 2. The actual
// create-product/create-variant/link/re-check-under-lock sequence lives in
// the Postgres function (migration 0100); this wrapper only forwards the
// param and shapes the response, matching how topping-price-sync.test.ts
// tests its own RPC wrapper -- not re-tested here.

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { createStandaloneToppingProductAtomic } from "./create-standalone-topping";

describe("createStandaloneToppingProductAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("creates the product and variant, and returns their ids", async () => {
    mocks.rpc.mockResolvedValue({
      data: { product_id: "PROD-036", variant_id: "VAR-045" },
      error: null,
    });

    const result = await createStandaloneToppingProductAtomic({ modifierId: "MOD-009" });

    expect(result).toEqual({ productId: "PROD-036", variantId: "VAR-045" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_standalone_topping_product_atomic", {
      p_modifier_id: "MOD-009",
    });
  });

  it("throws when the RPC refuses a modifier that already has a linked product (the FOR UPDATE re-check)", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Modifier MOD-002 already has a linked product -- refusing to create a second one" },
    });

    await expect(
      createStandaloneToppingProductAtomic({ modifierId: "MOD-002" }),
    ).rejects.toThrow(/already has a linked product/);
  });

  it("throws when the RPC refuses a non-Thêm-Topping-group modifier", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Modifier MOD-005 is not in the Thêm Topping group -- cannot be sold standalone" },
    });

    await expect(
      createStandaloneToppingProductAtomic({ modifierId: "MOD-005" }),
    ).rejects.toThrow(/Thêm Topping/);
  });

  it("throws when the RPC refuses a zero or negative price", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Modifier MOD-010 has price 0 -- refusing to create a 0đ món" },
    });

    await expect(
      createStandaloneToppingProductAtomic({ modifierId: "MOD-010" }),
    ).rejects.toThrow(/0đ/);
  });
});
