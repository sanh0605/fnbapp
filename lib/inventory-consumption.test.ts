import { describe, expect, it } from "vitest";
import {
  allocateRecipeConsumption,
  buildSemiProductRecipeMaps,
  splitImplicitProduction,
} from "@/lib/inventory-consumption";
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

  it("tracks the shortfall quantity in implicitYields when provided, without changing the returned rows", () => {
    const balances = new Map<string, number>([["BTP-COFFEE", 10]]);
    const implicitYields = new Map<string, number>();
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
      implicitYields,
    });

    expect(rows).toEqual([
      { item_reference: "BTP-COFFEE", quantity: 10, source: "VARIANT_RECIPE" },
      { item_reference: "ING-BEAN", quantity: 10, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE" },
    ]);
    expect(implicitYields.get("VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE")).toBe(10);
  });
});

describe("splitImplicitProduction", () => {
  it("passes rows through unchanged when there was no shortfall", () => {
    const rows = [{ item_reference: "ING-BEAN", quantity: 40, source: "VARIANT_RECIPE" }];
    const result = splitImplicitProduction(rows, new Map());

    expect(result.saleRows).toBe(rows);
    expect(result.productionConsumeRows).toEqual([]);
    expect(result.productionYieldRows).toEqual([]);
  });

  it("folds a partial shortfall into the existing semi-product sale row", () => {
    const rows = [
      { item_reference: "BTP-COFFEE", quantity: 10, source: "VARIANT_RECIPE" },
      { item_reference: "ING-BEAN", quantity: 10, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE" },
    ];
    const implicitYields = new Map([["VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE", 10]]);

    const result = splitImplicitProduction(rows, implicitYields);

    expect(result.saleRows).toEqual([
      { item_reference: "BTP-COFFEE", quantity: 20, source: "VARIANT_RECIPE" },
    ]);
    expect(result.productionConsumeRows).toEqual([
      { item_reference: "ING-BEAN", quantity: 10, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE" },
    ]);
    expect(result.productionYieldRows).toEqual([
      { item_reference: "BTP-COFFEE", quantity: 10 },
    ]);
  });

  it("creates a new semi-product sale row when there was no available-stock portion at all", () => {
    const rows = [
      { item_reference: "ING-BEAN", quantity: 20, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE" },
    ];
    const implicitYields = new Map([["VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE", 20]]);

    const result = splitImplicitProduction(rows, implicitYields);

    expect(result.saleRows).toEqual([
      { item_reference: "BTP-COFFEE", quantity: 20, source: "VARIANT_RECIPE" },
    ]);
    expect(result.productionConsumeRows).toEqual([
      { item_reference: "ING-BEAN", quantity: 20, source: "VARIANT_RECIPE:BTP_SHORTFALL:BTP-COFFEE" },
    ]);
    expect(result.productionYieldRows).toEqual([
      { item_reference: "BTP-COFFEE", quantity: 20 },
    ]);
  });

  it("keeps a modifier-sourced shortfall separate from a variant-sourced sale row for the same item", () => {
    const rows = [
      { item_reference: "BTP-COFFEE", quantity: 10, source: "VARIANT_RECIPE" },
      { item_reference: "ING-BEAN", quantity: 5, source: "MODIFIER_RECIPE:MOD-001:BTP_SHORTFALL:BTP-COFFEE" },
    ];
    const implicitYields = new Map([["MODIFIER_RECIPE:MOD-001:BTP_SHORTFALL:BTP-COFFEE", 5]]);

    const result = splitImplicitProduction(rows, implicitYields);

    // The variant-sourced row is untouched; a separate modifier-sourced row
    // is created rather than incorrectly folding into the variant row.
    expect(result.saleRows).toEqual(expect.arrayContaining([
      { item_reference: "BTP-COFFEE", quantity: 10, source: "VARIANT_RECIPE" },
      { item_reference: "BTP-COFFEE", quantity: 5, source: "MODIFIER_RECIPE:MOD-001" },
    ]));
    expect(result.saleRows).toHaveLength(2);
  });
});

describe("buildSemiProductRecipeMaps", () => {
  it("uses the effective recipe instead of input order", () => {
    const currentIngredients = [
      ingredient({ ingredient_id: "ING-CURRENT", quantity: 100 }),
    ];
    const endedIngredients = [
      ingredient({ ingredient_id: "ING-ENDED", quantity: 100 }),
    ];

    const maps = buildSemiProductRecipeMaps(
      [
        {
          id: "RC-CURRENT",
          target_type: "SEMI_PRODUCT",
          target_id: "BTP-COFFEE",
          ingredients_json: JSON.stringify(currentIngredients),
          status: "ACTIVE",
          created_at: "2026-06-01T00:00:00.000Z",
          end_date: null,
        },
        {
          id: "RC-ENDED",
          target_type: "SEMI_PRODUCT",
          target_id: "BTP-COFFEE",
          ingredients_json: JSON.stringify(endedIngredients),
          status: "ACTIVE",
          created_at: "2026-04-01T00:00:00.000Z",
          end_date: "2026-05-01T00:00:00.000Z",
        },
      ],
      [{ id: "BTP-COFFEE", batch_yield: 100 }],
      "2026-07-01T00:00:00.000Z",
    );

    expect(
      maps.semiProductRecipes.get("BTP-COFFEE")?.[0].ingredient_id,
    ).toBe("ING-CURRENT");
  });
});
