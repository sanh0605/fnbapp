import { beforeEach, describe, expect, it, vi } from "vitest";

const findAllMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
const generateNewIdMock = vi.fn();
const revalidatePathMock = vi.fn();
const requireAdminMock = vi.fn();

vi.mock("@/lib/sheets_db", () => ({
  findAll: findAllMock,
  insert: insertMock,
  update: updateMock,
  generateNewId: generateNewIdMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

describe("saveModifierAction recipe versioning", () => {
  beforeEach(() => {
    findAllMock.mockReset();
    insertMock.mockReset();
    updateMock.mockReset();
    generateNewIdMock.mockReset();
    revalidatePathMock.mockReset();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, actor: { name: "Codex" } });
  });

  it("does not create a modifier recipe version when the latest open recipe is unchanged", async () => {
    const { saveModifierAction } = await import("./actions");
    const submittedIngredients = [
      { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
    ];

    findAllMock.mockResolvedValue([
      {
        id: "REC-OLD",
        target_type: "MODIFIER",
        target_id: "MOD-001",
        ingredients_json: JSON.stringify([
          { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 10 },
        ]),
        status: "ACTIVE",
        created_at: "2026-06-01T00:00:00.000Z",
        end_date: null,
      },
      {
        id: "REC-LATEST",
        target_type: "MODIFIER",
        target_id: "MOD-001",
        ingredients_json: JSON.stringify(submittedIngredients),
        status: "ACTIVE",
        created_at: "2026-06-25T00:00:00.000Z",
        end_date: null,
      },
    ]);

    const formData = new FormData();
    formData.set("is_edit", "true");
    formData.set("id", "MOD-001");
    formData.set("name", "Đá");
    formData.set("group_name", "Topping");
    formData.set("price", "0");
    formData.set("ingredients_json", JSON.stringify(submittedIngredients));

    const result = await saveModifierAction(formData);

    expect(result.success).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith("Modifiers", "MOD-001", {
      name: "Đá",
      group_name: "Topping",
      price: "0",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("closes only the latest open modifier recipe when ingredients change", async () => {
    const { saveModifierAction } = await import("./actions");

    findAllMock.mockResolvedValue([
      {
        id: "REC-OLD",
        target_type: "MODIFIER",
        target_id: "MOD-001",
        ingredients_json: JSON.stringify([
          { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 10 },
        ]),
        status: "ACTIVE",
        created_at: "2026-06-01T00:00:00.000Z",
        end_date: null,
      },
      {
        id: "REC-LATEST",
        target_type: "MODIFIER",
        target_id: "MOD-001",
        ingredients_json: JSON.stringify([
          { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
        ]),
        status: "ACTIVE",
        created_at: "2026-06-25T00:00:00.000Z",
        end_date: null,
      },
    ]);
    generateNewIdMock.mockResolvedValue("REC-NEW");

    const formData = new FormData();
    formData.set("is_edit", "true");
    formData.set("id", "MOD-001");
    formData.set("name", "Đá");
    formData.set("group_name", "Topping");
    formData.set("price", "0");
    formData.set("ingredients_json", JSON.stringify([
      { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 30 },
    ]));

    const result = await saveModifierAction(formData);

    expect(result.success).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      "Recipes",
      "REC-LATEST",
      expect.objectContaining({ end_date: expect.any(String) }),
    );
    expect(updateMock).not.toHaveBeenCalledWith(
      "Recipes",
      "REC-OLD",
      expect.anything(),
    );
    expect(insertMock).toHaveBeenCalledWith(
      "Recipes",
      expect.objectContaining({
        id: "REC-NEW",
        target_type: "MODIFIER",
        target_id: "MOD-001",
      }),
    );
  });
});
