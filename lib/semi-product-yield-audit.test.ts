import { describe, it, expect } from "vitest";
import { parseRecipeIngredients } from "./semi-product-yield-audit";

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
