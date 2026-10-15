import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));

import { clearProductCache } from "./actions";

describe("clearProductCache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expires the three product tags immediately for an admin", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: true });
    await clearProductCache();
    expect(mocks.revalidateTag.mock.calls).toEqual([
      ["sheets-Product_Variants", { expire: 0 }],
      ["sheets-Products", { expire: 0 }],
      ["sheets-Product_Price_History", { expire: 0 }],
    ]);
  });

  it("rejects a non-admin and clears nothing", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Forbidden" });
    await expect(clearProductCache()).rejects.toThrow("Forbidden");
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});
