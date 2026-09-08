import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  generateNewId: vi.fn(),
  syncToppingPriceAtomic: vi.fn(),
  createStandaloneToppingProductAtomic: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  insert: mocks.insert,
  update: mocks.update,
  generateNewId: mocks.generateNewId,
  getCacheTag: (sheetName: string) => `sheets-${sheetName}`,
}));
vi.mock("@/lib/products/topping-price-sync", () => ({ syncToppingPriceAtomic: mocks.syncToppingPriceAtomic }));
vi.mock("@/lib/products/create-standalone-topping", () => ({
  createStandaloneToppingProductAtomic: mocks.createStandaloneToppingProductAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: mocks.revalidateTag }));

import { getModifiersData, saveModifierAction, deleteModifierAction, createStandaloneToppingAction } from "./actions";

// section 5: both required tests. The second guards against the fix
// becoming "throw on empty" -- a different bug wearing the same diff.
describe("getModifiersData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("propagates the failure instead of returning a fabricated empty result", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getModifiersData()).rejects.toThrow("db down");
  });

  it("a genuinely empty Modifiers table still resolves with [] and does not throw", async () => {
    mocks.findAll.mockResolvedValue([]);

    await expect(getModifiersData()).resolves.toEqual({ modifiers: [] });
  });
});

// docs/superpowers/plans/2026-09-07-one-price-per-topping.md Task 1 Step 3:
// editing a modifier's price must go through the atomic sync RPC (one write,
// not a plain update() for price plus a second call for name/group_name),
// and must revalidate the product caches so a synced price does not sit
// stale behind Products/Product_Variants.
describe("saveModifierAction edit path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  function editFormData(overrides: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("is_edit", "true");
    fd.set("id", "MOD-002");
    fd.set("name", "Kem muối");
    fd.set("group_name", "Topping");
    fd.set("price", "5000");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("calls syncToppingPriceAtomic instead of update() when editing", async () => {
    mocks.syncToppingPriceAtomic.mockResolvedValue({
      modifierId: "MOD-002", variantId: "VAR-030", priceHistory: [],
    });

    const result = await saveModifierAction(editFormData());

    expect(result.success).toBe(true);
    expect(mocks.syncToppingPriceAtomic).toHaveBeenCalledWith({
      modifierId: "MOD-002", price: 5000, name: "Kem muối", groupName: "Topping",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("revalidates the Products and Product_Variants cache tags after a synced edit", async () => {
    mocks.syncToppingPriceAtomic.mockResolvedValue({
      modifierId: "MOD-002", variantId: "VAR-030", priceHistory: [],
    });

    await saveModifierAction(editFormData());

    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Products");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Product_Variants");
  });

  it("surfaces the RPC's trap error instead of a generic failure", async () => {
    mocks.syncToppingPriceAtomic.mockRejectedValue(
      new Error('sync_topping_price_atomic: Product PROD-035 has 2 ACTIVE modifiers -- price sync needs exactly one writer'),
    );

    const result = await saveModifierAction(editFormData());

    expect(result.success).toBeFalsy();
    expect(result.error).toBeTruthy();
  });

  // Opus code review, 2026-09-08 (finding 2): nothing in the repo ever
  // revalidated sheets-Modifiers, which was harmless staleness while
  // nothing structural read Modifiers.product_id. Task 5 made both the
  // report merge and POS quick-add exclusion read it, and Task 2's
  // create-and-link path is about to become a third writer -- so a stale
  // Modifiers cache now means a stale link, not just a stale name/price.
  it("revalidates the Modifiers cache tag after a synced edit", async () => {
    mocks.syncToppingPriceAtomic.mockResolvedValue({
      modifierId: "MOD-002", variantId: "VAR-030", priceHistory: [],
    });

    await saveModifierAction(editFormData());

    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Modifiers");
  });
});

describe("saveModifierAction new-modifier path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("MOD-099");
  });

  function newFormData(overrides: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("is_edit", "false");
    fd.set("name", "Trân châu đen");
    fd.set("group_name", "Thêm Topping");
    fd.set("price", "5000");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("revalidates the Modifiers cache tag after creating a new modifier", async () => {
    mocks.insert.mockResolvedValue(undefined);

    const result = await saveModifierAction(newFormData());

    expect(result.success).toBe(true);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Modifiers");
  });
});

describe("deleteModifierAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("revalidates the Modifiers cache tag after a delete", async () => {
    mocks.update.mockResolvedValue(undefined);
    const fd = new FormData();
    fd.set("id", "MOD-002");

    const result = await deleteModifierAction(fd);

    expect(result.success).toBe(true);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Modifiers");
  });
});

// docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 2. Turning
// "Bán độc lập" on for a modifier with no linked product (state c). All the
// actual guards (already-linked re-check, Thêm Topping group, price > 0)
// live in the RPC (migration 0100) -- this action only forwards the id,
// shapes the result, and revalidates the three caches now driven by
// modifiers.product_id (Products, Product_Variants, Modifiers).
describe("createStandaloneToppingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("creates the product+variant+link and revalidates Products, Product_Variants, and Modifiers", async () => {
    mocks.createStandaloneToppingProductAtomic.mockResolvedValue({
      productId: "PROD-036", variantId: "VAR-045",
    });

    const result = await createStandaloneToppingAction("MOD-009");

    expect(result.success).toBe(true);
    expect(mocks.createStandaloneToppingProductAtomic).toHaveBeenCalledWith({ modifierId: "MOD-009" });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Products");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Product_Variants");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Modifiers");
  });

  it("surfaces the RPC's refusal (e.g. non-Thêm-Topping group) as a plain failure, not a thrown error", async () => {
    mocks.createStandaloneToppingProductAtomic.mockRejectedValue(
      new Error("create_standalone_topping_product_atomic: Modifier MOD-005 is not in the Thêm Topping group -- cannot be sold standalone"),
    );

    const result = await createStandaloneToppingAction("MOD-005");

    expect(result.success).toBeFalsy();
    expect(result.error).toBeTruthy();
  });

  it("rejects a missing modifier id before calling the RPC", async () => {
    const result = await createStandaloneToppingAction("");

    expect(result.success).toBeFalsy();
    expect(mocks.createStandaloneToppingProductAtomic).not.toHaveBeenCalled();
  });
});
