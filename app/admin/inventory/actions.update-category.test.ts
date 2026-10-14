import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  findAllWhere: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: vi.fn() }));
vi.mock("@/lib/db/tables", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/tables")>("@/lib/db/tables");
  return {
    findAll: mocks.findAll,
    findAllWhere: mocks.findAllWhere,
    findAllNoCache: vi.fn(),
    insert: vi.fn(),
    update: mocks.update,
    remove: vi.fn(),
    generateNewId: vi.fn(),
    getCacheTag: actual.getCacheTag,
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { updateItemCategory } from "./actions";

function fd(name: string, systemType: string): FormData {
  const f = new FormData();
  f.set("id", "NHH-001");
  f.set("name", name);
  f.set("system_type", systemType);
  return f;
}

describe("updateItemCategory (BR-COGS: a past month's Giá vốn is not rewritten)", () => {
  let issues: any[];
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "a", name: "A" } });
    issues = [{ id: "ISS-1", purchased_item_id: "SPM-1" }];
    mocks.findAll.mockImplementation((sheet: string) => {
      if (sheet === "Item_Categories") return Promise.resolve([{ id: "NHH-001", name: "Nguyên liệu", system_type: "RAW" }]);
      if (sheet === "Purchased_Items") return Promise.resolve([{ id: "SPM-1", item_category_id: "NHH-001" }]);
      return Promise.resolve([]);
    });
    mocks.findAllWhere.mockImplementation((sheet: string) => Promise.resolve(sheet === "Stock_Issues" ? issues : []));
  });

  it("refuses a system_type change while an item of the category has issue rows", async () => {
    const res = await updateItemCategory(fd("Nguyên liệu", "EQUIPMENT"));
    expect(res.error).toBe("Loại này đã có hàng xuất kho. Đổi sang loại khác sẽ làm sai giá vốn các tháng trước.");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows a rename that keeps the system_type, even with issue rows", async () => {
    const res = await updateItemCategory(fd("Nguyên liệu pha chế", "RAW"));
    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith("Item_Categories", "NHH-001", { name: "Nguyên liệu pha chế", system_type: "RAW" });
  });

  it("allows a system_type change when no item of the category was ever issued", async () => {
    issues = [];
    const res = await updateItemCategory(fd("Nguyên liệu", "CONSUMABLE"));
    expect(res.error).toBeUndefined();
  });

  it("refuses a blank name", async () => {
    const res = await updateItemCategory(fd("   ", "RAW"));
    expect(res.error).toBe("Vui lòng nhập tên loại");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("shows a database failure in Vietnamese, not the raw text", async () => {
    mocks.update.mockRejectedValue(new Error("duplicate key value violates unique constraint"));
    const res = await updateItemCategory(fd("Nguyên liệu", "RAW"));
    expect(res.error).not.toContain("duplicate key");
  });
});
