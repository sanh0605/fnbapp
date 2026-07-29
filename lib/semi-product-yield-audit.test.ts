import { describe, it, expect } from "vitest";
import { parseRecipeIngredients, auditSemiProductYields } from "./semi-product-yield-audit";

describe("parseRecipeIngredients", () => {
  it("reads an ingredients_json array", () => {
    const result = parseRecipeIngredients({
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      ingredients_json: [{ ingredient_id: "NNL-001", ingredient_type: "BASE_INGREDIENT", quantity: 40 }],
    });
    expect(result).toEqual([
      { ingredient_id: "NNL-001", ingredient_type: "BASE_INGREDIENT", quantity: 40 },
    ]);
  });

  it("reads ingredients_json delivered as a JSON string", () => {
    const result = parseRecipeIngredients({
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      ingredients_json: '[{"ingredient_id":"NNL-001","ingredient_type":"BASE_INGREDIENT","quantity":40}]',
    });
    expect(result).toHaveLength(1);
    expect(result[0].ingredient_id).toBe("NNL-001");
  });

  it("returns an empty array for malformed JSON instead of throwing", () => {
    const result = parseRecipeIngredients({
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      ingredients_json: "not json",
    });
    expect(result).toEqual([]);
  });
});

const teaBase = { id: "BTP-001", name: "Hồng trà", base_unit: "ml", batch_yield: 2000, status: "ACTIVE" };

const cookingRecipe = (yieldTargetId: string) => ({
  target_type: "SEMI_PRODUCT",
  target_id: yieldTargetId,
  status: "ACTIVE",
  ingredients_json: [
    { ingredient_id: "NNL-001", ingredient_type: "BASE_INGREDIENT", quantity: 40 },
    { ingredient_id: "NNL-002", ingredient_type: "BASE_INGREDIENT", quantity: 2000 },
  ],
});

const drinkRecipe = (semiId: string, qty: number) => ({
  target_type: "PRODUCT_VARIANT",
  target_id: "SP-001",
  status: "ACTIVE",
  ingredients_json: [{ ingredient_id: semiId, ingredient_type: "SEMI_PRODUCT", quantity: qty }],
});

describe("auditSemiProductYields", () => {
  it("flags a correctly configured yield as OK", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [teaBase],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    expect(finding.flag).toBe("OK");
    expect(finding.scaleRatio).toBe(1);
  });

  it("flags an unconfigured yield of exactly 1 as YIELD_DEFAULT_1", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [{ ...teaBase, batch_yield: 1 }],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    expect(finding.flag).toBe("YIELD_DEFAULT_1");
  });

  it("flags a litres-vs-millilitres mismatch as YIELD_SCALE_SUSPECT", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [{ ...teaBase, batch_yield: 2 }],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    expect(finding.flag).toBe("YIELD_SCALE_SUSPECT");
    expect(finding.scaleRatio).toBe(1000);
  });

  it("flags a consumed semi-product with no cooking recipe", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [teaBase],
      recipes: [drinkRecipe("BTP-001", 200)],
    });
    expect(finding.flag).toBe("NO_COOKING_RECIPE");
  });

  it("computes implied raw consumption per serving", () => {
    // yield 2 instead of 2000: 40 / 2 * 200 = 4000 units of leaf per drink.
    const [finding] = auditSemiProductYields({
      semiProducts: [{ ...teaBase, batch_yield: 2 }],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    const leaf = finding.impliedRawPerServing.find(row => row.ingredientId === "NNL-001");
    expect(leaf?.quantity).toBe(4000);
  });

  it("uses the median consumed quantity when consumers disagree", () => {
    const [finding] = auditSemiProductYields({
      semiProducts: [teaBase],
      recipes: [
        cookingRecipe("BTP-001"),
        drinkRecipe("BTP-001", 100),
        drinkRecipe("BTP-001", 200),
        drinkRecipe("BTP-001", 900),
      ],
    });
    expect(finding.typicalConsumedQuantity).toBe(200);
  });

  it("skips semi-products that nothing consumes", () => {
    const findings = auditSemiProductYields({
      semiProducts: [teaBase],
      recipes: [cookingRecipe("BTP-001")],
    });
    expect(findings).toEqual([]);
  });

  it("ignores DELETED semi-products and non-ACTIVE recipes", () => {
    const findings = auditSemiProductYields({
      semiProducts: [{ ...teaBase, status: "DELETED" }],
      recipes: [cookingRecipe("BTP-001"), drinkRecipe("BTP-001", 200)],
    });
    expect(findings).toEqual([]);
  });

  it("never mutates its inputs", () => {
    const semiProducts = [Object.freeze({ ...teaBase })];
    const recipes = [Object.freeze(cookingRecipe("BTP-001")), Object.freeze(drinkRecipe("BTP-001", 200))];
    expect(() => auditSemiProductYields({ semiProducts, recipes } as never)).not.toThrow();
  });
});
