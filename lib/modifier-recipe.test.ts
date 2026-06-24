import { describe, expect, it } from "vitest";
import {
  findActiveRecipeIntegrity,
  normalizeModifierIngredients,
  normalizeQuantityInput,
  parseModifierIngredients,
  validateModifierIngredients,
} from "@/lib/modifier-recipe";

describe("modifier recipe helpers", () => {
  it("returns an empty ingredient list for invalid recipe JSON", () => {
    expect(parseModifierIngredients("{broken")).toEqual([]);
  });

  it("rejects ingredients with non-positive quantities", () => {
    const result = validateModifierIngredients([
      { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: "0" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("lớn hơn 0");
  });

  it("normalizes numeric quantity strings before saving", () => {
    expect(normalizeModifierIngredients([
      { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: "010" },
    ])).toEqual([
      { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 10 },
    ]);
  });

  it("strips leading zeroes while typing quantity", () => {
    expect(normalizeQuantityInput("010")).toBe("10");
    expect(normalizeQuantityInput("0005")).toBe("5");
    expect(normalizeQuantityInput("0.5")).toBe("0.5");
  });

  it("detects multiple active recipes for one modifier", () => {
    const integrity = findActiveRecipeIntegrity([
      { id: "RC-1", end_date: "" },
      { id: "RC-2", end_date: "" },
      { id: "RC-3", end_date: "2026-06-01T00:00:00Z" },
    ]);

    expect(integrity.activeRecipe?.id).toBe("RC-1");
    expect(integrity.hasMultipleActiveRecipes).toBe(true);
    expect(integrity.activeRecipeCount).toBe(2);
  });
});
