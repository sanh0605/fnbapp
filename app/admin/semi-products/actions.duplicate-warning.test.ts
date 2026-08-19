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

// Batch 1 follow-up, level 2 (section A3b, BR-CATALOG-001), wired into
// Semi_Products the same way as Base_Ingredients.
describe("saveSemiProduct -- level 2, diacritic-stripped warning (Batch 1 follow-up)", () => {
  beforeEach(() => {
    findAllMock.mockReset();
    insertMock.mockReset();
    updateMock.mockReset();
    generateNewIdMock.mockReset();
    revalidatePathMock.mockReset();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ ok: true, actor: { name: "Admin" } });
  });

  function baseFormData(name: string): FormData {
    const formData = new FormData();
    formData.set("is_edit", "false");
    formData.set("name", name);
    formData.set("base_unit", "UNT-001");
    formData.set("batch_yield", "100");
    formData.set("ingredients_json", JSON.stringify([
      { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 10 },
    ]));
    return formData;
  }

  it("'Tra xanh ct' against an existing 'Trà xanh CT' warns, and does not save on decline", async () => {
    const { saveSemiProduct } = await import("./actions");
    findAllMock.mockImplementation(async (sheet: string) => {
      if (sheet === "Semi_Products") return [{ id: "BTP-020", name: "Trà xanh CT", status: "ACTIVE" }];
      return [];
    });

    const res: any = await saveSemiProduct(baseFormData("Tra xanh ct"));

    expect(res.error).toBeUndefined();
    expect(res.needsDuplicateWarning).toBeTruthy();
    expect(res.needsDuplicateWarning.conflictId).toBe("BTP-020");
    expect(insertMock).not.toHaveBeenCalledWith("Semi_Products", expect.anything());

    // "tôi gõ nhầm" -- no resubmission with the confirmation flag, so
    // nothing beyond the warning above is needed to prove decline.
  });

  it("a genuinely different name that strips the same warns, then SAVES on confirmation ('món khác'), recording it", async () => {
    // "Thạch dứa" strips to the same letters as the existing "Thạch dừa"
    // (pineapple vs coconut jelly -- the parent plan's own motivating pair
    // for why level 2 warns instead of refusing).
    const { saveSemiProduct } = await import("./actions");
    findAllMock.mockImplementation(async (sheet: string) => {
      if (sheet === "Semi_Products") return [{ id: "BTP-009", name: "Thạch dừa", status: "ACTIVE" }];
      return [];
    });
    generateNewIdMock.mockResolvedValueOnce("BTP-100").mockResolvedValueOnce("RC-100");

    const warned: any = await saveSemiProduct(baseFormData("Thạch dứa"));
    expect(warned.needsDuplicateWarning).toBeTruthy();
    expect(insertMock).not.toHaveBeenCalledWith("Semi_Products", expect.anything());

    const confirmedFormData = baseFormData("Thạch dứa");
    confirmedFormData.set("duplicate_warning_confirmed", "true");
    const saved: any = await saveSemiProduct(confirmedFormData);

    expect(saved.error).toBeUndefined();
    expect(insertMock).toHaveBeenCalledWith(
      "Semi_Products",
      expect.objectContaining({
        name: "Thạch dứa",
        duplicate_warning_confirmed: true,
        duplicate_warning_confirmed_by: "Admin",
      }),
    );
  });

  it("an exact match (case-fold only, same diacritics) still hits level 1 (refuse), never level 2", async () => {
    const { saveSemiProduct } = await import("./actions");
    findAllMock.mockImplementation(async (sheet: string) => {
      if (sheet === "Semi_Products") return [{ id: "BTP-020", name: "Trà xanh CT", status: "ACTIVE" }];
      return [];
    });

    const res: any = await saveSemiProduct(baseFormData("trà xanh ct"));

    expect(res.error).toBeTruthy();
    expect(res.needsDuplicateWarning).toBeUndefined();
  });
});
