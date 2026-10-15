import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  insert: mocks.insert,
  update: mocks.update,
  remove: vi.fn(),
  generateNewId: vi.fn(),
}));

import { getPromotionsData, savePromotion } from "./actions";

// section 5: both required tests. The second guards against the fix
// becoming "throw on empty" -- a different bug wearing the same diff.
describe("getPromotionsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("propagates the failure instead of returning a fabricated empty result", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getPromotionsData()).rejects.toThrow("db down");
  });

  it("genuinely empty tables still resolve with [] and do not throw", async () => {
    mocks.findAll.mockResolvedValue([]);

    await expect(getPromotionsData()).resolves.toEqual({
      promotions: [], brands: [], products: [], variants: [], categories: [],
    });
  });
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("savePromotion -- Dùng chung and whole-order promotions (BR-SALE-011)", () => {
  const form = (extra: Record<string, unknown>) => ({
    id: "PRM-9", name: "KM", type: "ORDER_DISCOUNT", discount_type: "PERCENT", discount_value: 10,
    start_date: "2026-01-01T00:00:00.000Z", ...extra,
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("refuses Đồng giá on a whole-order promotion", async () => {
    const r = await savePromotion(form({ discount_type: "FLAT_PRICE" }));
    expect(r.error).toContain("Đồng giá");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("writes stackable when the form sends it and leaves it alone when it does not", async () => {
    await savePromotion(form({ stackable: true }));
    expect(mocks.update.mock.calls[0][2]).toMatchObject({ stackable: true });
    await savePromotion(form({}));
    expect(mocks.update.mock.calls[1][2]).not.toHaveProperty("stackable");
  });
});
