import { describe, expect, it } from "vitest";
import { allocateRecipeConsumption } from "@/lib/inventory-consumption";
import type { RecipeIngredientSnapshot } from "@/lib/order-types";

const ingredient = (overrides: Partial<RecipeIngredientSnapshot>): RecipeIngredientSnapshot => ({
  ingredient_id: "ING-X",
  ingredient_type: "BASE_INGREDIENT",
  quantity: 1,
  unit_id: "U-001",
  ...overrides,
});

describe("allocateRecipeConsumption", () => {
  it("consumes base ingredients directly", () => {
    const balances = new Map<string, number>();
    const rows = allocateRecipeConsumption({
      ingredients: [ingredient({ ingredient_id: "ING-COFFEE", quantity: 20 })],
      multiplier: 2,
      balances,
      semiProductRecipes: new Map(),
      semiProductYields: new Map(),
    });

    expect(rows).toEqual([{ item_reference: "ING-COFFEE", quantity: 40, source: "VARIANT_RECIPE" }]);
    expect(balances.get("ING-COFFEE")).toBe(-40);
  });

  it("splits semi-product consumption between available stock and recipe shortfall", () => {
    const balances = new Map<string, number>([["BTP-COFFEE", 10]]);
    const rows = allocateRecipeConsumption({
      ingredients: [ingredient({
        ingredient_id: "BTP-COFFEE",
        ingredient_type: "SEMI_PRODUCT",
        quantity: 20,
      })],
      multiplier: 1,
      balances,
      semiProductRecipes: new Map([
        ["BTP-COFFEE", [ingredient({ ingredient_id: "ING-BEAN", quantity: 100 })]],
      ]),
      semiProductYields: new Map([["BTP-COFFEE", 100]]),
    });

    expect(rows).toEqual([
      { item_reference: "BTP-COFFEE", quantity: 10, source: "VARIANT_RECIPE" },
      { item_reference: "ING-BEAN", quantity: 10, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE" },
    ]);
    expect(balances.get("BTP-COFFEE")).toBe(0);
    expect(balances.get("ING-BEAN")).toBe(-10);
  });

  it("explodes the full semi-product quantity when stock is zero", () => {
    const balances = new Map<string, number>([["BTP-COFFEE", 0]]);
    const rows = allocateRecipeConsumption({
      ingredients: [ingredient({
        ingredient_id: "BTP-COFFEE",
        ingredient_type: "SEMI_PRODUCT",
        quantity: 20,
      })],
      multiplier: 1,
      balances,
      semiProductRecipes: new Map([
        ["BTP-COFFEE", [ingredient({ ingredient_id: "ING-BEAN", quantity: 100 })]],
      ]),
      semiProductYields: new Map([["BTP-COFFEE", 100]]),
    });

    expect(rows).toEqual([
      { item_reference: "ING-BEAN", quantity: 20, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE" },
    ]);
    expect(balances.get("BTP-COFFEE")).toBe(0);
    expect(balances.get("ING-BEAN")).toBe(-20);
  });
});
