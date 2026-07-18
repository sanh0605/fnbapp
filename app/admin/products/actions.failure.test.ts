import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  saveProductAtomic: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  update: mocks.update,
}));
vi.mock("@/lib/product-save-transaction", () => ({
  saveProductAtomic: mocks.saveProductAtomic,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveProduct } from "./actions";

describe("saveProduct atomic persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Product_Variants") return [];
      if (sheet === "Recipes") return [];
      return [];
    });
  });

  it("creates product, variant, initial price history, and recipe through one RPC", async () => {
    mocks.saveProductAtomic.mockResolvedValue(makeRpcResult());

    await expect(saveProduct(makeCreateFormData())).resolves.toEqual({ success: true });

    expect(mocks.saveProductAtomic).toHaveBeenCalledTimes(1);
    expect(mocks.saveProductAtomic.mock.calls[0][0]).toEqual({
      isEdit: false,
      product: {
        category_id: "CAT-001",
        name: "Món thử lỗi",
        image_url: "",
        status: "ACTIVE",
        created_at: expect.any(String),
      },
      variants: [{
        id: null,
        size_name: "M",
        price: 30_000,
        recipe_decision: "CREATE_INITIAL",
        active_recipe_id: null,
        ingredients_json: [makeIngredient("ING-001")],
      }],
      removedVariantIds: [],
      effectiveAt: "2026-07-19T00:00:00.000Z",
      expectedPriceHistoryCount: 1,
      expectedRecipeCount: 1,
    });
  });

  it("leaves no partial create state after rollback and permits retry", async () => {
    mocks.saveProductAtomic
      .mockRejectedValueOnce(new Error("forced rollback"))
      .mockResolvedValueOnce(makeRpcResult());

    await expect(saveProduct(makeCreateFormData())).resolves.toEqual({
      error: "forced rollback",
    });
    await expect(saveProduct(makeCreateFormData())).resolves.toEqual({ success: true });
    expect(mocks.saveProductAtomic).toHaveBeenCalledTimes(2);
  });

  it("plans an atomic price update/history insert and soft-deletes removed variants", async () => {
    seedExisting({ withRemovedVariant: true });
    mocks.saveProductAtomic.mockResolvedValue({
      ...makeRpcResult(),
      productId: "PROD-EXISTING",
      removedVariantCount: 1,
    });

    await expect(saveProduct(makeEditFormData({ price: 30_000 }))).resolves.toEqual({
      success: true,
    });

    const input = mocks.saveProductAtomic.mock.calls[0][0];
    expect(input.isEdit).toBe(true);
    expect(input.expectedPriceHistoryCount).toBe(1);
    expect(input.expectedRecipeCount).toBe(0);
    expect(input.removedVariantIds).toEqual(["VAR-REMOVED"]);
    expect(input.variants[0]).toMatchObject({
      id: "VAR-EXISTING",
      price: 30_000,
      recipe_decision: "UNCHANGED",
      active_recipe_id: "REC-EXISTING",
    });
  });

  it("plans recipe close and replacement in the same transaction", async () => {
    seedExisting();
    mocks.saveProductAtomic.mockResolvedValue({
      ...makeRpcResult(),
      productId: "PROD-EXISTING",
      priceHistoryCount: 0,
    });

    await expect(saveProduct(makeEditFormData({ ingredientId: "ING-002" }))).resolves.toEqual({
      success: true,
    });
    expect(mocks.saveProductAtomic.mock.calls[0][0].variants[0]).toMatchObject({
      recipe_decision: "CREATE_VERSION",
      active_recipe_id: "REC-EXISTING",
      ingredients_json: [makeIngredient("ING-002")],
    });
  });

  function seedExisting(options: { withRemovedVariant?: boolean } = {}): void {
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Product_Variants") {
        return [
          {
            id: "VAR-EXISTING",
            product_id: "PROD-EXISTING",
            size_name: "M",
            price: 25_000,
            status: "ACTIVE",
          },
          ...(options.withRemovedVariant ? [{
            id: "VAR-REMOVED",
            product_id: "PROD-EXISTING",
            size_name: "L",
            price: 35_000,
            status: "ACTIVE",
          }] : []),
        ];
      }
      if (sheet === "Recipes") {
        return [{
          id: "REC-EXISTING",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-EXISTING",
          ingredients_json: JSON.stringify([makeIngredient("ING-001")]),
          created_at: "2026-07-01T00:00:00.000Z",
          end_date: null,
        }];
      }
      return [];
    });
  }
});

function makeRpcResult() {
  return {
    productId: "PROD-001",
    variantCount: 1,
    priceHistoryCount: 1,
    recipeCount: 1,
    removedVariantCount: 0,
  };
}

function makeCreateFormData(): FormData {
  const formData = new FormData();
  formData.set("category_id", "CAT-001");
  formData.set("name", "Món thử lỗi");
  formData.set("variants_json", JSON.stringify([{
    id: "",
    size_name: "M",
    price: 30_000,
    ingredients: [makeIngredient("ING-001")],
  }]));
  formData.set("effective_date", "2026-07-19T00:00:00.000Z");
  return formData;
}

function makeEditFormData(options: { price?: number; ingredientId?: string } = {}): FormData {
  const formData = new FormData();
  formData.set("id", "PROD-EXISTING");
  formData.set("category_id", "CAT-001");
  formData.set("name", "Existing product updated");
  formData.set("variants_json", JSON.stringify([{
    id: "VAR-EXISTING",
    size_name: "M",
    price: options.price ?? 25_000,
    ingredients: [makeIngredient(options.ingredientId ?? "ING-001")],
  }]));
  formData.set("effective_date", "2026-07-19T00:00:00.000Z");
  return formData;
}

function makeIngredient(ingredientId: string): Record<string, unknown> {
  return {
    ingredient_type: "BASE_INGREDIENT",
    ingredient_id: ingredientId,
    quantity: 10,
    unit_id: "UNT-001",
  };
}
