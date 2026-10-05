import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/tables")>("@/lib/db/tables");
  return {
    findAll: mocks.findAll,
    findAllWhere: mocks.findAllWhere,
    findAllNoCache: vi.fn(),
    insert: mocks.insert,
    update: mocks.update,
    remove: mocks.remove,
    generateNewId: mocks.generateNewId,
    getCacheTag: actual.getCacheTag,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { deleteItemCategory } from "./actions";

function fd(id: string): FormData {
  const f = new FormData();
  f.set("id", id);
  return f;
}

function seed(itemsInCategory: number) {
  mocks.findAll.mockImplementation((sheet: string) => {
    if (sheet === "Item_Categories") return Promise.resolve([{ id: "NHH-001", name: "Nguyên liệu" }]);
    if (sheet === "Purchased_Items") {
      return Promise.resolve([
        ...Array.from({ length: itemsInCategory }, (_, i) => ({ id: `SPM-${i}`, item_category_id: "NHH-001" })),
        { id: "SPM-X", item_category_id: "NHH-002" },
      ]);
    }
    return Promise.resolve([]);
  });
}

describe("deleteItemCategory -- refuses with a readable reason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.requireOwner.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("refuses a category that still has items, naming the count (Nguyên liệu)", async () => {
    seed(56);
    const res = await deleteItemCategory(fd("NHH-001"));
    expect(res.error).toBe("Không xoá được Nguyên liệu: còn 56 hàng hoá thuộc phân loại này.");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes an empty category", async () => {
    seed(0);
    const res = await deleteItemCategory(fd("NHH-001"));
    expect(res.error).toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith("Item_Categories", "NHH-001");
  });

  it("says so when the category does not exist", async () => {
    mocks.findAll.mockResolvedValue([]);
    const res = await deleteItemCategory(fd("NHH-404"));
    expect(res.error).toBe("Không tìm thấy phân loại.");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("never shows a raw database error", async () => {
    seed(0);
    mocks.remove.mockRejectedValue(new Error('update or delete on table "item_categories" violates foreign key constraint'));
    const res = await deleteItemCategory(fd("NHH-001"));
    expect(res.error).not.toContain("violates");
    expect(res.error).toMatch(/Có lỗi xảy ra/);
  });

  it("refuses a non-owner before reading anything", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: false, error: "Chỉ chủ quán mới được xoá." });
    const res = await deleteItemCategory(fd("NHH-001"));
    expect(res.error).toBe("Chỉ chủ quán mới được xoá.");
    expect(mocks.findAll).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
