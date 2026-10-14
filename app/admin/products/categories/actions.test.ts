import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  insert: mocks.insert,
  update: mocks.update,
  generateNewId: mocks.generateNewId,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteCategory, getCategoriesWithCounts, saveCategory, updateCategory } from "./actions";

// section 5: both required tests. The second guards against the fix
// becoming "throw on empty" -- a different bug wearing the same diff.
describe("getCategoriesWithCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("propagates the failure instead of returning a fabricated empty result", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getCategoriesWithCounts()).rejects.toThrow("db down");
  });

  it("a genuinely empty Product_Categories table still resolves with [] and does not throw", async () => {
    mocks.findAll.mockResolvedValue([]);

    await expect(getCategoriesWithCounts()).resolves.toEqual({ categories: [], counts: {} });
  });
});

describe("deleteCategory", () => {
  const form = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    return fd;
  };
  const tables = (products: Array<{ id: string; category_id: string; status: string }>) =>
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Product_Categories"
        ? [{ id: "CAT-001", name: "Cà phê", status: "ACTIVE" }]
        : products
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("refuses with the dish count while non-deleted dishes still use the group", async () => {
    tables([
      { id: "P1", category_id: "CAT-001", status: "ACTIVE" },
      { id: "P2", category_id: "CAT-001", status: "ACTIVE" },
      { id: "P3", category_id: "CAT-001", status: "DELETED" },
      { id: "P4", category_id: "CAT-002", status: "ACTIVE" },
    ]);

    const res = await deleteCategory(form("CAT-001"));

    expect(res).toEqual({ error: 'Không xoá được nhóm "Cà phê": còn 2 món đang dùng.' });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("soft-deletes when only deleted dishes remain", async () => {
    tables([{ id: "P3", category_id: "CAT-001", status: "DELETED" }]);

    const res = await deleteCategory(form("CAT-001"));

    expect(res).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith("Product_Categories", "CAT-001", { status: "DELETED" });
  });

  it("lets a MANAGER through (requireAdmin decides) and rejects a non-admin as before", async () => {
    tables([]);
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "m-1", name: "Quản lý", role: "MANAGER" } });
    expect(await deleteCategory(form("CAT-001"))).toEqual({ success: true });

    mocks.update.mockClear();
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Không có quyền" });
    const res = await deleteCategory(form("CAT-001"));
    expect(res).toEqual({ error: "Không có quyền" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("category product type", () => {
  const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("CAT-008");
    mocks.findAll.mockImplementation(async (sheet: string) =>
      sheet === "Product_Types" ? [{ id: "PT-001", name: "Thức uống" }] : []
    );
  });

  it("saveCategory refuses a missing or unknown type", async () => {
    expect(await saveCategory(form({ name: "Bánh" }))).toEqual({ error: "Chọn loại món" });
    expect(await saveCategory(form({ name: "Bánh", type_id: "PT-404" }))).toEqual({ error: "Chọn loại món" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("saveCategory stores the type", async () => {
    expect(await saveCategory(form({ name: "Bánh", type_id: "PT-001" }))).toEqual({ success: true });
    expect(mocks.insert).toHaveBeenCalledWith(
      "Product_Categories",
      expect.objectContaining({ id: "CAT-008", name: "Bánh", type_id: "PT-001" })
    );
  });

  it("updateCategory refuses a missing or unknown type and stores a valid one", async () => {
    expect(await updateCategory(form({ id: "CAT-001", name: "Cà phê" }))).toEqual({ error: "Chọn loại món" });
    expect(await updateCategory(form({ id: "CAT-001", name: "Cà phê", type_id: "PT-404" }))).toEqual({ error: "Chọn loại món" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(await updateCategory(form({ id: "CAT-001", name: "Cà phê", type_id: "PT-001" }))).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith("Product_Categories", "CAT-001", { name: "Cà phê", type_id: "PT-001" });
  });
});
