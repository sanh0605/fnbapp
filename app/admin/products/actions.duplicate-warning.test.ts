import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  saveProductAtomic: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  update: mocks.update,
}));
vi.mock("@/lib/product-save-transaction", () => ({
  saveProductAtomic: mocks.saveProductAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { saveProduct } from "./actions";

// Batch 1 follow-up, level 2 (section A3b, BR-CATALOG-001), on the table the
// owner's own example named. Production has PROD-001 named "Cà phê đá"
// (verified live, 2026-08-20) -- this is the required §A5 two-outcome proof,
// carried over from base-ingredients to the table the owner actually typed.
describe("saveProduct -- level 2, diacritic-stripped warning (Batch 1 follow-up)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Admin" },
    });
  });

  it("'Ca phe da' against PROD-001 'Cà phê đá' warns, and does not save on decline ('tôi gõ nhầm')", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Products") return [{ id: "PROD-001", name: "Cà phê đá", status: "ACTIVE" }];
      return [];
    });

    const res: any = await saveProduct(makeCreateFormData("Ca phe da"));

    expect(res.error).toBeUndefined(); // a warning is not a refusal
    expect(res.needsDuplicateWarning).toBeTruthy();
    expect(res.needsDuplicateWarning.conflictId).toBe("PROD-001");
    expect(res.needsDuplicateWarning.conflictName).toBe("Cà phê đá");
    expect(mocks.saveProductAtomic).not.toHaveBeenCalled();

    // "tôi gõ nhầm" -- the owner declines, the form simply never resubmits
    // with the confirmation flag. Nothing beyond the warning above is
    // needed to prove this: no further call means nothing was saved.
  });

  it("a genuinely different name that strips to the same letters warns, then SAVES on confirmation ('món khác'), recording it", async () => {
    // "Cá phê đá" (fish, not coffee -- a plausible different product name)
    // strips to the same letters as "Cà phê đá" once diacritics are
    // removed, exactly the same shape as base-ingredients' Thạch dứa /
    // Thạch dừa case.
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Products") return [{ id: "PROD-001", name: "Cà phê đá", status: "ACTIVE" }];
      return [];
    });
    mocks.saveProductAtomic.mockResolvedValue({
      productId: "PROD-100",
      variantCount: 1,
      priceHistoryCount: 1,
      recipeCount: 1,
      removedVariantCount: 0,
    });

    const warned: any = await saveProduct(makeCreateFormData("Cá phê đá"));
    expect(warned.needsDuplicateWarning).toBeTruthy();
    expect(mocks.saveProductAtomic).not.toHaveBeenCalled();

    const confirmedFormData = makeCreateFormData("Cá phê đá");
    confirmedFormData.set("duplicate_warning_confirmed", "true");
    const saved: any = await saveProduct(confirmedFormData);

    expect(saved.error).toBeUndefined();
    expect(mocks.saveProductAtomic).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(
      "Products",
      "PROD-100",
      expect.objectContaining({
        duplicate_warning_confirmed: true,
        duplicate_warning_confirmed_by: "Admin",
      }),
    );
  });

  it("an exact match (same diacritics, case-fold only) still hits level 1 (refuse), never level 2", async () => {
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Products") return [{ id: "PROD-001", name: "Cà phê đá", status: "ACTIVE" }];
      return [];
    });

    const res: any = await saveProduct(makeCreateFormData("cà phê đá"));

    expect(res.error).toBeTruthy();
    expect(res.needsDuplicateWarning).toBeUndefined();
    expect(mocks.saveProductAtomic).not.toHaveBeenCalled();
  });
});

function makeCreateFormData(name: string): FormData {
  const formData = new FormData();
  formData.set("category_id", "CAT-001");
  formData.set("name", name);
  formData.set("variants_json", JSON.stringify([{
    id: "",
    size_name: "M",
    price: 30_000,
    ingredients: [{
      ingredient_type: "BASE_INGREDIENT",
      ingredient_id: "ING-001",
      quantity: 10,
      unit_id: "UNT-001",
    }],
  }]));
  formData.set("effective_date", "2026-08-20T00:00:00.000Z");
  return formData;
}
