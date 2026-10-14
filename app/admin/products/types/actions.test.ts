import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({ requireAdmin: mocks.requireAdmin, requireOwner: mocks.requireOwner }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findById: mocks.findById,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteProductType, getProductType, getProductTypes, saveProductType, updateProductType } from "./actions";

const actor = { id: "a-1", name: "Admin", role: "ADMIN" };
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const TYPES = [
  { id: "PT-002", name: "Thức ăn", is_drink: false, created_at: "x" },
  { id: "PT-001", name: "Thức uống", is_drink: true, created_at: "x" },
  { id: "PT-003", name: "Topping", is_drink: false, created_at: "x" },
];
const CATEGORIES = [
  { id: "CAT-001", name: "Cà phê", status: "ACTIVE", type_id: "PT-001" },
  { id: "CAT-002", name: "Trà", status: "ACTIVE", type_id: "PT-001" },
  { id: "CAT-006", name: "Đồ ăn", status: "ACTIVE", type_id: "PT-002" },
];
const tables = (types = TYPES, categories = CATEGORIES) =>
  mocks.findAll.mockImplementation(async (sheet: string) =>
    sheet === "Product_Types" ? types : sheet === "Product_Categories" ? categories : [],
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ ok: true, actor });
  mocks.requireOwner.mockResolvedValue({ ok: true, actor });
  mocks.generateNewId.mockResolvedValue("PT-004");
  tables();
});

describe("getProductTypes", () => {
  it("sorts by name and lists the categories using each type", async () => {
    const rows = await getProductTypes();
    expect(rows.map((r) => r.type.name)).toEqual(["Thức ăn", "Thức uống", "Topping"]);
    const drink = rows.find((r) => r.type.id === "PT-001")!;
    expect(drink.categoryCount).toBe(2);
    expect(drink.categoryNames).toEqual(["Cà phê", "Trà"]);
    expect(rows.find((r) => r.type.id === "PT-003")!.categoryCount).toBe(0);
  });

  it("getProductType returns one row or null", async () => {
    mocks.findById.mockResolvedValue(TYPES[1]);
    expect(await getProductType("PT-001")).toEqual(TYPES[1]);
    mocks.findById.mockResolvedValue(null);
    expect(await getProductType("PT-999")).toBeNull();
  });
});

describe("saveProductType", () => {
  it("requires a name", async () => {
    expect(await saveProductType(form({ name: "  " }))).toEqual({ error: "Nhập tên loại món" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses a name that exists ignoring case and spacing", async () => {
    const res = await saveProductType(form({ name: "  thức   UỐNG " }));
    expect(res).toEqual({ error: "Tên loại món đã có" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("inserts with a PT id and the drink flag", async () => {
    const res = await saveProductType(form({ name: "Bánh", is_drink: "on" }));
    expect(res).toEqual({ success: true });
    expect(mocks.generateNewId).toHaveBeenCalledWith("Product_Types", "PT");
    expect(mocks.insert).toHaveBeenCalledWith("Product_Types", { id: "PT-004", name: "Bánh", is_drink: true });
  });
});

describe("updateProductType", () => {
  it("lets a type keep its own name", async () => {
    const res = await updateProductType(form({ id: "PT-001", name: "Thức uống", is_drink: "on" }));
    expect(res).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith("Product_Types", "PT-001", { name: "Thức uống", is_drink: true });
  });

  it("refuses another type's name", async () => {
    expect(await updateProductType(form({ id: "PT-001", name: "topping" }))).toEqual({ error: "Tên loại món đã có" });
  });
});

describe("deleteProductType", () => {
  it("is owner only", async () => {
    mocks.requireOwner.mockResolvedValue({ ok: false, error: "Chỉ Chủ quán" });
    expect(await deleteProductType(form({ id: "PT-003" }))).toEqual({ error: "Chỉ Chủ quán" });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("names the categories still using the type", async () => {
    const res = await deleteProductType(form({ id: "PT-001" }));
    expect(res).toEqual({ error: "Loại món đang được dùng ở nhóm: Cà phê, Trà." });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes an unused type", async () => {
    expect(await deleteProductType(form({ id: "PT-003" }))).toEqual({ success: true });
    expect(mocks.remove).toHaveBeenCalledWith("Product_Types", "PT-003");
  });

  it("translates a foreign key refusal from the database (a race) into Vietnamese", async () => {
    mocks.remove.mockRejectedValue(
      new Error('remove(Product_Types, PT-003): update or delete on table "product_types" violates foreign key constraint "product_categories_type_id_fkey" on table "product_categories"'),
    );
    // Categories appear between the check and the delete.
    mocks.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: "CAT-009", name: "Bánh", status: "ACTIVE", type_id: "PT-003" }]);
    const res = await deleteProductType(form({ id: "PT-003" }));
    expect(res.error).toBe("Loại món đang được dùng ở nhóm: Bánh.");
  });
});
