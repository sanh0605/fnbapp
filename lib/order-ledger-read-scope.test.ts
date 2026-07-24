import { describe, expect, it } from "vitest";

import { collectOrderConsumptionItemReferences } from "./order-ledger-read-scope";

describe("collectOrderConsumptionItemReferences", () => {
  it("includes direct ingredients and recursively expands semi-product recipes", () => {
    const result = collectOrderConsumptionItemReferences(
      [{
        recipe_snapshot_json: JSON.stringify({
          variant: {
            ingredients: [
              { ingredient_id: "BI-DIRECT", ingredient_type: "BASE_INGREDIENT", quantity: 1 },
              // Legacy snapshots may omit ingredient_type; MAC still identifies
              // semi-products by their BTP prefix for recipe-cost fallback.
              { ingredient_id: "BTP-OUTER", quantity: 1 },
            ],
          },
          modifiers: [{
            modifier_id: "MOD-1",
            modifier_name: "Extra",
            recipe: {
              ingredients: [
                { ingredient_id: "BI-MODIFIER", ingredient_type: "BASE_INGREDIENT", quantity: 1 },
              ],
            },
          }],
        }),
      }],
      {
        semiProductRecipes: new Map([
          ["BTP-OUTER", [
            { ingredient_id: "BTP-INNER", ingredient_type: "SEMI_PRODUCT", quantity: 1, unit_id: "UNIT" },
          ]],
          ["BTP-INNER", [
            { ingredient_id: "BI-NESTED", ingredient_type: "BASE_INGREDIENT", quantity: 1, unit_id: "UNIT" },
          ]],
        ]),
        semiProductYields: new Map(),
      },
    );

    expect(result).toEqual([
      "BI-DIRECT",
      "BI-MODIFIER",
      "BI-NESTED",
      "BTP-INNER",
      "BTP-OUTER",
    ]);
  });

  it("deduplicates references and terminates cyclic semi-product recipes", () => {
    const result = collectOrderConsumptionItemReferences(
      [{
        recipe_snapshot_json: JSON.stringify({
          variant: {
            ingredients: [
              { ingredient_id: "BTP-A", ingredient_type: "SEMI_PRODUCT", quantity: 1 },
              { ingredient_id: "BTP-A", ingredient_type: "SEMI_PRODUCT", quantity: 2 },
            ],
          },
          modifiers: [],
        }),
      }],
      {
        semiProductRecipes: new Map([
          ["BTP-A", [{ ingredient_id: "BTP-B", ingredient_type: "SEMI_PRODUCT", quantity: 1, unit_id: "UNIT" }]],
          ["BTP-B", [{ ingredient_id: "BTP-A", ingredient_type: "SEMI_PRODUCT", quantity: 1, unit_id: "UNIT" }]],
        ]),
        semiProductYields: new Map(),
      },
    );

    expect(result).toEqual(["BTP-A", "BTP-B"]);
  });
});
