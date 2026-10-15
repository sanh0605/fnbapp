import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  generateNewId: vi.fn(),
  saveModifierAtomic: vi.fn(),
  createStandaloneToppingProductAtomic: vi.fn(),
  setProductStatusAtomic: vi.fn(),
  revalidatePath: vi.fn(),
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
vi.mock("@/lib/products/modifier-save-transaction", () => ({ saveModifierAtomic: mocks.saveModifierAtomic }));
vi.mock("@/lib/products/create-standalone-topping", () => ({
  createStandaloneToppingProductAtomic: mocks.createStandaloneToppingProductAtomic,
}));
vi.mock("@/lib/products/product-status-transaction", () => ({ setProductStatusAtomic: mocks.setProductStatusAtomic }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { getModifiersData, saveModifierAction, deleteModifierAction, createStandaloneToppingAction, toggleToppingStandalone } from "./actions";

const GROUPS = [
  { id: "MG-001", name: "Thêm Topping", selection_mode: "MANY", allow_standalone: true },
  { id: "MG-002", name: "Mức đường", selection_mode: "ONE", allow_standalone: false },
];
const OPTIONS = [
  { id: "MOD-002", name: "Kem muối", group_id: "MG-001", status: "ACTIVE", product_id: null },
  { id: "MOD-004", name: "Trân châu trắng", group_id: "MG-001", status: "ACTIVE", product_id: "PROD-031" },
];
function seedTables() {
  mocks.findAll.mockImplementation(async (sheet: string) =>
    sheet === "Modifier_Groups" ? GROUPS : sheet === "Modifiers" ? OPTIONS : []);
}

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

// BR-CATALOG-003:
// editing a modifier's price must go through the atomic sync RPC (one write,
// not a plain update() for price plus a second call for the name),
// and must revalidate the product caches so a synced price does not sit
// stale behind Products/Product_Variants.
describe("saveModifierAction edit path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedTables();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  function editFormData(overrides: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("is_edit", "true");
    fd.set("id", "MOD-002");
    fd.set("name", "Kem muối");
    fd.set("group_id", "MG-001");
    fd.set("price", "5000");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("calls saveModifierAtomic instead of update() when editing", async () => {
    mocks.saveModifierAtomic.mockResolvedValue({
      modifierId: "MOD-002", variantId: "VAR-030", priceHistory: [],
    });

    const result = await saveModifierAction(editFormData());

    expect(result.success).toBe(true);
    expect(mocks.saveModifierAtomic).toHaveBeenCalledWith({
      isEdit: true,
      modifier: { id: "MOD-002", name: "Kem muối", price: 5000, group_id: "MG-001", is_default: false, max_qty: null },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("revalidates the Products and Product_Variants cache tags after a synced edit", async () => {
    mocks.saveModifierAtomic.mockResolvedValue({
      modifierId: "MOD-002", variantId: "VAR-030", priceHistory: [],
    });

    await saveModifierAction(editFormData());

    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Products", { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Product_Variants", { expire: 0 });
  });

  it("surfaces the RPC's trap error instead of a generic failure", async () => {
    mocks.saveModifierAtomic.mockRejectedValue(
      new Error('sync_topping_price_atomic: Product PROD-035 has 2 ACTIVE modifiers -- price sync needs exactly one writer'),
    );

    const result = await saveModifierAction(editFormData());

    expect(result.success).toBeFalsy();
    expect(result.error).toBeTruthy();
  });

  // Opus code review, 2026-09-08 (finding 2): nothing in the repo ever
  // revalidated sheets-Modifiers, which was harmless staleness while
  // nothing structural read Modifiers.product_id. the 2026-09-08 standalone-topping change made both the
  // report merge and POS quick-add exclusion read it, and the
  // create-and-link path is about to become a third writer -- so a stale
  // Modifiers cache now means a stale link, not just a stale name/price.
  it("revalidates the Modifiers cache tag after a synced edit", async () => {
    mocks.saveModifierAtomic.mockResolvedValue({
      modifierId: "MOD-002", variantId: "VAR-030", priceHistory: [],
    });

    await saveModifierAction(editFormData());

    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Modifiers", { expire: 0 });
  });
});

describe("saveModifierAction new-modifier path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("MOD-099");
    seedTables();
  });

  function newFormData(overrides: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("is_edit", "false");
    fd.set("name", "Trân châu đen");
    fd.set("group_id", "MG-001");
    fd.set("price", "5000");
    for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
    return fd;
  }

  it("creates through saveModifierAtomic with the group and revalidates the Modifiers cache tag", async () => {
    mocks.saveModifierAtomic.mockResolvedValue({ modifierId: "MOD-099", variantId: null, priceHistory: [] });

    const result = await saveModifierAction(newFormData());

    expect(result.success).toBe(true);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.saveModifierAtomic).toHaveBeenCalledWith({
      isEdit: false,
      modifier: { id: "MOD-099", name: "Trân châu đen", price: 5000, group_id: "MG-001", is_default: false, max_qty: null },
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Modifiers", { expire: 0 });
  });

  it("refuses an option sold on its own in a group that does not allow it", async () => {
    const result = await saveModifierAction(newFormData({ is_edit: "true", id: "MOD-004", name: "Trân châu trắng", group_id: "MG-002" }));

    expect(result).toEqual({ error: "Món Trân châu trắng đang bán riêng; nhóm này không cho bán riêng." });
    expect(mocks.saveModifierAtomic).not.toHaveBeenCalled();
  });

  it("refuses Có sẵn on a Chọn nhiều group", async () => {
    const result = await saveModifierAction(newFormData({ is_default: "on" }));

    expect(result).toEqual({ error: "Chỉ nhóm chọn một mới có lựa chọn có sẵn" });
    expect(mocks.saveModifierAtomic).not.toHaveBeenCalled();
  });

  it("sends Có sẵn for a Chọn một group and drops max_qty there", async () => {
    mocks.saveModifierAtomic.mockResolvedValue({ modifierId: "MOD-099", variantId: null, priceHistory: [] });

    await saveModifierAction(newFormData({ group_id: "MG-002", is_default: "on", max_qty: "2" }));

    expect(mocks.saveModifierAtomic).toHaveBeenCalledWith({
      isEdit: false,
      modifier: expect.objectContaining({ group_id: "MG-002", is_default: true, max_qty: null }),
    });
  });

  it("keeps the per-option cap between 1 and 20 in a Chọn nhiều group", async () => {
    expect(await saveModifierAction(newFormData({ max_qty: "21" }))).toEqual({ error: "Tối đa từ 1 đến 20 phần" });
    mocks.saveModifierAtomic.mockResolvedValue({ modifierId: "MOD-099", variantId: null, priceHistory: [] });
    await saveModifierAction(newFormData({ max_qty: "2" }));
    expect(mocks.saveModifierAtomic).toHaveBeenCalledWith({ isEdit: false, modifier: expect.objectContaining({ max_qty: 2 }) });
  });
});

describe("deleteModifierAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedTables();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("revalidates the Modifiers cache tag after a delete", async () => {
    mocks.update.mockResolvedValue(undefined);
    const fd = new FormData();
    fd.set("id", "MOD-002");

    const result = await deleteModifierAction(fd);

    expect(result.success).toBe(true);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Modifiers", { expire: 0 });
  });

  // The linked dish would otherwise stay on the till with no option behind it.
  it("refuses while the linked dish is ACTIVE, naming the dish, and deletes nothing", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Modifiers" ? OPTIONS : [{ id: "PROD-031", name: "Trân châu trắng (lẻ)", status: "ACTIVE" }]);
    const fd = new FormData();
    fd.set("id", "MOD-004");

    const result = await deleteModifierAction(fd);

    expect(result.error).toBe(
      "Tuỳ chọn này đang bán riêng thành món Trân châu trắng (lẻ). Tắt Bán độc lập trước rồi xoá",
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("deletes once the linked dish is INACTIVE", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Modifiers" ? OPTIONS : [{ id: "PROD-031", name: "Trân châu trắng (lẻ)", status: "INACTIVE" }]);
    const fd = new FormData();
    fd.set("id", "MOD-004");

    expect((await deleteModifierAction(fd)).success).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith("Modifiers", "MOD-004", { status: "DELETED" });
  });
});

// Moved from toppings/actions: the Bán độc lập switch on a linked dish. The
// status change goes through the atomic rpc so the dish and its sizes move together.
describe("toggleToppingStandalone", () => {
  const linked = [{ id: "MOD-004", product_id: "PROD-031", status: "ACTIVE" }];
  const seed = (productStatus: string, modifiers: any[] = linked) =>
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Modifiers" ? modifiers : [{ id: "PROD-031", name: "Trân châu trắng", status: productStatus }]);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it.each([[true, "ACTIVE"], [false, "INACTIVE"]] as const)(
    "enabled=%s sets %s through the atomic rpc and revalidates the till caches",
    async (enabled, status) => {
      seed(enabled ? "INACTIVE" : "ACTIVE");

      const res = await toggleToppingStandalone("PROD-031", enabled);

      expect(res.error).toBeUndefined();
      expect(mocks.setProductStatusAtomic).toHaveBeenCalledWith("PROD-031", status);
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Products", { expire: 0 });
      expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Product_Variants", { expire: 0 });
    },
  );

  it("refuses a DELETED dish", async () => {
    seed("DELETED");

    const res = await toggleToppingStandalone("PROD-031", true);

    expect(res.error).toBeTruthy();
    expect(mocks.setProductStatusAtomic).not.toHaveBeenCalled();
  });

  it("refuses a dish no option links to", async () => {
    seed("ACTIVE", []);

    const res = await toggleToppingStandalone("PROD-031", true);

    expect(res.error).toBeTruthy();
    expect(mocks.setProductStatusAtomic).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});

// BR-CATALOG-003. Turning
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
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Products", { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Product_Variants", { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sheets-Modifiers", { expire: 0 });
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
