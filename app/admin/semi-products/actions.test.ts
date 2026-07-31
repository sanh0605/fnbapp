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

    const before = new Date();
    const result = await saveSemiProduct(formData);
    const after = new Date();

    expect(result.success).toBe(true);
    const recipeInsertCall = insertMock.mock.calls.find(call => call[0] === "Recipes");
    expect(recipeInsertCall).toBeDefined();
    const payload = recipeInsertCall![1];
    expect(new Date(payload.start_date).toISOString().slice(0, 10)).toBe("2026-06-14");
    // created_at must record the real save moment, not the backdated effective
    // date -- this is the defect Task 4 (2026-07-31 plan) fixes.
    const createdAtMs = new Date(payload.created_at).getTime();
    expect(createdAtMs).toBeGreaterThanOrEqual(before.getTime());
    expect(createdAtMs).toBeLessThanOrEqual(after.getTime());
    expect(payload.start_date).not.toBe(payload.created_at);
  });
});

// The owner's three cases, 2026-07-31. created_at always records the real
// save moment; start_date carries the effective date, past or future.
describe("saveSemiProduct: start_date never overwrites created_at", () => {
  beforeEach(() => {
    findAllMock.mockReset();
    insertMock.mockReset();
    updateMock.mockReset();
    generateNewIdMock.mockReset();
    revalidatePathMock.mockReset();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, actor: { name: "Codex" } });
    findAllMock.mockResolvedValue([]);
  });

  function baseFormData(effectiveDate: string) {
    const formData = new FormData();
    formData.set("is_edit", "false");
    formData.set("name", "Test BTP");
    formData.set("base_unit", "UNT-001");
    formData.set("batch_yield", "100");
    if (effectiveDate) formData.set("effective_date", effectiveDate);
    formData.set("ingredients_json", JSON.stringify([
      { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 10 },
    ]));
    return formData;
  }

  it("case 1: blank effective date -- both columns equal the save moment", async () => {
    const { saveSemiProduct } = await import("./actions");
    generateNewIdMock.mockResolvedValueOnce("BTP-001").mockResolvedValueOnce("RC-001");

    const before = new Date();
    await saveSemiProduct(baseFormData(""));
    const after = new Date();

    const payload = insertMock.mock.calls.find(call => call[0] === "Recipes")![1];
    expect(payload.start_date).toBe(payload.created_at);
    const ms = new Date(payload.created_at).getTime();
    expect(ms).toBeGreaterThanOrEqual(before.getTime());
    expect(ms).toBeLessThanOrEqual(after.getTime());
  });

  it("case 2: past effective date -- created_at stays at the save moment", async () => {
    const { saveSemiProduct } = await import("./actions");
    generateNewIdMock.mockResolvedValueOnce("BTP-002").mockResolvedValueOnce("RC-002");

    const before = new Date();
    await saveSemiProduct(baseFormData("2026-06-01"));
    const after = new Date();

    const payload = insertMock.mock.calls.find(call => call[0] === "Recipes")![1];
    expect(new Date(payload.start_date).toISOString().slice(0, 10)).toBe("2026-06-01");
    const createdMs = new Date(payload.created_at).getTime();
    expect(createdMs).toBeGreaterThanOrEqual(before.getTime());
    expect(createdMs).toBeLessThanOrEqual(after.getTime());
    expect(payload.start_date).not.toBe(payload.created_at);
  });

  it("case 3: future effective date -- created_at stays at the save moment", async () => {
    const { saveSemiProduct } = await import("./actions");
    generateNewIdMock.mockResolvedValueOnce("BTP-003").mockResolvedValueOnce("RC-003");

    const before = new Date();
    await saveSemiProduct(baseFormData("2099-01-01"));
    const after = new Date();

    const payload = insertMock.mock.calls.find(call => call[0] === "Recipes")![1];
    expect(new Date(payload.start_date).toISOString().slice(0, 10)).toBe("2099-01-01");
    const createdMs = new Date(payload.created_at).getTime();
    expect(createdMs).toBeGreaterThanOrEqual(before.getTime());
    expect(createdMs).toBeLessThanOrEqual(after.getTime());
    expect(payload.start_date).not.toBe(payload.created_at);
  });
});
