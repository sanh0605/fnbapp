import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabaseClient: vi.fn() }));
vi.mock("@/lib/db/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));

import { setProductStatusAtomic } from "./product-status-transaction";

describe("setProductStatusAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("calls one rpc so the dish and its sizes change together", async () => {
    mocks.rpc.mockResolvedValue({ data: { product_id: "PROD-1", variants_changed: 2 }, error: null });

    await expect(setProductStatusAtomic("PROD-1", "INACTIVE")).resolves.toEqual({
      productId: "PROD-1",
      variantsChanged: 2,
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("set_product_status_atomic", {
      p_product_id: "PROD-1",
      p_status: "INACTIVE",
    });
  });

  it("throws the database message when the rpc fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Không tìm thấy món" } });

    await expect(setProductStatusAtomic("PROD-X", "ACTIVE")).rejects.toThrow("Không tìm thấy món");
  });
});
