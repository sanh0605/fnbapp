import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  remove: mocks.remove,
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
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin", role: "ADMIN" } });
  });

  it("refuses with the dish count while dishes still use the group", async () => {
    tables([
      { id: "P1", category_id: "CAT-001", status: "ACTIVE" },
      { id: "P2", category_id: "CAT-001", status: "INACTIVE" },
      { id: "P4", category_id: "CAT-002", status: "ACTIVE" },
    ]);

    const res = await deleteCategory(form("CAT-001"));

    expect(res).toEqual({ error: 'Không xoá được nhóm "Cà phê": còn 2 món đang dùng.' });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("erases an empty group for good and never writes DELETED", async () => {
    tables([{ id: "P4", category_id: "CAT-002", status: "ACTIVE" }]);

    const res = await deleteCategory(form("CAT-001"));

    expect(res).toEqual({ success: true });
    expect(mocks.remove).toHaveBeenCalledWith("Product_Categories", "CAT-001");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("is owner only: a non-owner is rejected and nothing is erased", async () => {
    tables([]);
    mocks.requireOwner.mockResolvedValue({ ok: false, error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" });

    const res = await deleteCategory(form("CAT-001"));

    expect(res).toEqual({ error: "Chỉ Chủ quán mới có quyền thực hiện thao tác này" });
    expect(mocks.remove).not.toHaveBeenCalled();
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
    expect(mocks.update).toHaveBeenCalledWith("Product_Categories", "CAT-001", { name: "Cà phê", type_id: "PT-001", icon: null });
  });

  it("stores a trimmed icon, blank becomes null, and over 8 characters is refused", async () => {
    await saveCategory(form({ name: "Bánh", type_id: "PT-001", icon: " ☕ " }));
    expect(mocks.insert).toHaveBeenLastCalledWith("Product_Categories", expect.objectContaining({ icon: "☕" }));
    await saveCategory(form({ name: "Bánh", type_id: "PT-001", icon: "  " }));
    expect(mocks.insert).toHaveBeenLastCalledWith("Product_Categories", expect.objectContaining({ icon: null }));
    await updateCategory(form({ id: "CAT-001", name: "Cà phê", type_id: "PT-001", icon: "🍵" }));
    expect(mocks.update).toHaveBeenLastCalledWith("Product_Categories", "CAT-001", expect.objectContaining({ icon: "🍵" }));
    mocks.insert.mockClear();
    mocks.update.mockClear();
    const tooLong = "123456789";
    expect(await saveCategory(form({ name: "Bánh", type_id: "PT-001", icon: tooLong }))).toEqual({ error: "Biểu tượng tối đa 8 ký tự" });
    expect(await updateCategory(form({ id: "CAT-001", name: "Cà phê", type_id: "PT-001", icon: tooLong }))).toEqual({ error: "Biểu tượng tối đa 8 ký tự" });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("category duplicate name", () => {
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
      sheet === "Product_Types"
        ? [{ id: "PT-001", name: "Thức uống" }]
        : [
            { id: "CAT-001", name: "Cà phê", status: "ACTIVE" },
            { id: "CAT-002", name: "Bánh cũ", status: "DELETED" },
          ]
    );
  });

  it("saveCategory refuses a name an ACTIVE group already has, but allows a DELETED one's name", async () => {
    const res = await saveCategory(form({ name: "  cà PHÊ ", type_id: "PT-001" }));
    expect(res.error).toContain("CAT-001");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(await saveCategory(form({ name: "Bánh cũ", type_id: "PT-001" }))).toEqual({ success: true });
  });

  it("updateCategory refuses a rename onto another ACTIVE group's name but keeps its own", async () => {
    const res = await updateCategory(form({ id: "CAT-009", name: "Cà phê", type_id: "PT-001" }));
    expect(res.error).toContain("CAT-001");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(await updateCategory(form({ id: "CAT-001", name: "Cà phê", type_id: "PT-001" }))).toEqual({ success: true });
  });
});
