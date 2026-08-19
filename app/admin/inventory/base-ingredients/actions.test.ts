import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  generateNewId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  insert: mocks.insert,
  update: mocks.update,
  remove: mocks.remove,
  generateNewId: mocks.generateNewId,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import * as actions from "./actions";

// Batch 1, item A, section A5: "a cross-table pair stays legal: creating a
// base_ingredients row named Da vien while SPM-005 exists must succeed."
// This exercises the real addBaseIngredient action with mocked I/O, not a
// source grep (OPEN-ITEMS 38) -- the caller passes only Base_Ingredients'
// own rows to the guard, so a purchased_items collision is invisible to it
// by construction, and this proves that end to end.
describe("addBaseIngredient -- duplicate-name guard (Batch 1, section A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
    mocks.generateNewId.mockResolvedValue("NNL-999");
  });

  it("a cross-table name collision stays legal -- Base_Ingredients has no row to conflict with", async () => {
    // Base_Ingredients' own rows contain no "Da vien" -- the fact that
    // purchased_items' SPM-005 is also named "Da vien" is never fetched
    // here and cannot block this save, matching section A1's scope rule.
    mocks.findAll.mockResolvedValue([
      { id: "ING-010", name: "Duong trang", status: "ACTIVE" },
    ]);

    const formData = new FormData();
    formData.set("name", "Da vien");
    formData.set("base_unit", "UNT-017");

    const res = await actions.addBaseIngredient(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledWith(
      "Base_Ingredients",
      expect.objectContaining({ name: "Da vien" }),
    );
  });

  it("refuses a within-table collision against an ACTIVE row, naming it in the message", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "ING-033", name: "Sữa yến mạch", status: "ACTIVE" },
    ]);

    const formData = new FormData();
    formData.set("name", "  SỮA  YẾN MẠCH  ");
    formData.set("base_unit", "UNT-017");

    const res = await actions.addBaseIngredient(formData);

    expect(res.error).toContain("Sữa yến mạch");
    expect(res.error).toContain("ING-033");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows reusing a retired (INACTIVE) row's name -- retirement makes it reusable (section A4)", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "NNL-004", name: "Sữa yến mạch", status: "INACTIVE" },
    ]);

    const formData = new FormData();
    formData.set("name", "Sữa yến mạch");
    formData.set("base_unit", "UNT-017");

    const res = await actions.addBaseIngredient(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.insert).toHaveBeenCalled();
  });

  it("bulk import refuses two new rows in the same batch sharing a name, before writing either", async () => {
    mocks.findAll.mockResolvedValue([]);

    const formData = new FormData();
    formData.set(
      "items_json",
      JSON.stringify([
        { name: "Tra xanh", base_unit: "UNT-017", is_non_inventory: false },
        { name: "Tra Xanh", base_unit: "UNT-017", is_non_inventory: false },
      ]),
    );

    const res = await actions.addBaseIngredient(formData);

    expect(res.error).toContain("Dòng 2");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("updateBaseIngredient -- duplicate-name guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("excludes the row's own id -- saving without changing the name is not a self-collision", async () => {
    mocks.findAll.mockResolvedValue([{ id: "ING-033", name: "Sữa yến mạch", status: "ACTIVE" }]);

    const formData = new FormData();
    formData.set("id", "ING-033");
    formData.set("name", "Sữa yến mạch");
    formData.set("base_unit", "UNT-017");

    const res = await actions.updateBaseIngredient(formData);

    expect(res.error).toBeUndefined();
    expect(mocks.update).toHaveBeenCalled();
  });

  it("refuses renaming a row to collide with a different ACTIVE row", async () => {
    mocks.findAll.mockResolvedValue([
      { id: "ING-033", name: "Sữa yến mạch", status: "ACTIVE" },
      { id: "ING-010", name: "Duong trang", status: "ACTIVE" },
    ]);

    const formData = new FormData();
    formData.set("id", "ING-010");
    formData.set("name", "Sữa yến mạch");
    formData.set("base_unit", "UNT-017");

    const res = await actions.updateBaseIngredient(formData);

    expect(res.error).toContain("ING-033");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
