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

// Task 5 Step 5 (2026-07-30 phase6 plan): saveSemiProduct used to insert
// Recipes rows with created_at but no start_date, which is the origin of
// the 129 null start_date rows -- and, worse, is invisible to 0043's
// backdated-recipe trigger, since effectiveness is decided by start_date
// falling back to created_at (lib/recipe-selection.ts).
describe("saveSemiProduct writes start_date on every recipe it creates", () => {
  beforeEach(() => {
    findAllMock.mockReset();
    insertMock.mockReset();
    updateMock.mockReset();
    generateNewIdMock.mockReset();
    revalidatePathMock.mockReset();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, actor: { name: "Codex" } });
  });

  it("sets start_date on the first recipe for a new semi-product", async () => {
    const { saveSemiProduct } = await import("./actions");

    generateNewIdMock.mockResolvedValueOnce("BTP-999").mockResolvedValueOnce("RC-999");
    findAllMock.mockResolvedValue([]);

    const formData = new FormData();
    formData.set("is_edit", "false");
    formData.set("name", "Test BTP");
    formData.set("base_unit", "UNT-001");
    formData.set("batch_yield", "100");
    formData.set("ingredients_json", JSON.stringify([
      { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 10 },
    ]));

    const result = await saveSemiProduct(formData);

    expect(result.success).toBe(true);
    const recipeInsertCall = insertMock.mock.calls.find(call => call[0] === "Recipes");
    expect(recipeInsertCall).toBeDefined();
    const payload = recipeInsertCall![1];
    expect(payload.start_date).toBeTruthy();
    expect(payload.start_date).toBe(payload.created_at);
  });

  it("sets start_date on a new recipe version when the effective date is backdated", async () => {
    const { saveSemiProduct } = await import("./actions");

    generateNewIdMock.mockResolvedValueOnce("RC-NEW");
    findAllMock.mockResolvedValue([
      {
        id: "RC-OLD",
        target_type: "SEMI_PRODUCT",
        target_id: "BTP-777",
        ingredients_json: JSON.stringify([
          { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 10 },
        ]),
        status: "ACTIVE",
        created_at: "2026-06-01T00:00:00.000Z",
        end_date: "",
      },
    ]);

    const formData = new FormData();
    formData.set("is_edit", "true");
    formData.set("id", "BTP-777");
    formData.set("name", "Test BTP");
    formData.set("base_unit", "UNT-001");
    formData.set("batch_yield", "100");
    formData.set("effective_date", "2026-06-14");
    formData.set("ingredients_json", JSON.stringify([
      { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 25 },
    ]));

    const result = await saveSemiProduct(formData);

    expect(result.success).toBe(true);
    const recipeInsertCall = insertMock.mock.calls.find(call => call[0] === "Recipes");
    expect(recipeInsertCall).toBeDefined();
    const payload = recipeInsertCall![1];
    expect(payload.start_date).toBe(payload.created_at);
    expect(new Date(payload.start_date).toISOString().slice(0, 10)).toBe("2026-06-14");
  });
});
