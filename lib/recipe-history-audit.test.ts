import { describe, expect, it } from "vitest";
import {
  auditRecipeHistory,
  renderRecipeAuditMarkdown,
} from "@/lib/recipe-history-audit";

describe("auditRecipeHistory", () => {
  it("classifies a same-name ingredient ID change as TYPE_REPLACEMENT", () => {
    const report = auditRecipeHistory({
      recipes: [
        {
          id: "REC-001",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-03-26T17:00:00.000Z",
          end_date: "2026-05-12T17:00:00.000Z",
          ingredients_json: JSON.stringify([
            {
              ingredient_type: "SEMI_PRODUCT",
              ingredient_id: "BTP-001",
              quantity: 60,
            },
            {
              ingredient_type: "SEMI_PRODUCT",
              ingredient_id: "BTP-004",
              quantity: 20,
            },
          ]),
        },
        {
          id: "REC-011",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-05-12T17:00:00.000Z",
          end_date: null,
          ingredients_json: JSON.stringify([
            {
              ingredient_type: "SEMI_PRODUCT",
              ingredient_id: "BTP-001",
              quantity: 60,
            },
            {
              ingredient_type: "BASE_INGREDIENT",
              ingredient_id: "ING-022",
              quantity: 25,
            },
          ]),
        },
      ],
      variants: [
        { id: "VAR-001", product_id: "PROD-001", size_name: "500ml" },
      ],
      products: [
        { id: "PROD-001", name: "Cà phê đá" },
      ],
      baseIngredients: [
        { id: "ING-022", name: "Nước đường" },
      ],
      semiProducts: [
        { id: "BTP-001", name: "Cốt cà phê" },
        { id: "BTP-004", name: "  NƯỚC   ĐƯỜNG " },
      ],
    });

    const transition = report.variants[0].transitions[0];
    expect(transition.typeReplacements).toEqual([
      expect.objectContaining({
        name: "Nước đường",
        fromIngredientId: "BTP-004",
        toIngredientId: "ING-022",
      }),
    ]);
    expect(transition.quantityChanges).toEqual([
      {
        name: "Nước đường",
        ingredientId: "ING-022",
        fromQuantity: 20,
        toQuantity: 25,
      },
    ]);
    expect(transition.trueDrops).toEqual([]);
    expect(report.cleanupRecommendations).toEqual([]);
  });

  it("classifies a missing ingredient name as TRUE_DROP", () => {
    const report = auditRecipeHistory({
      recipes: [
        {
          id: "REC-062",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-016",
          created_at: "2026-06-14T17:00:01.000Z",
          end_date: "2026-06-25T03:03:10.431Z",
          ingredients_json: JSON.stringify([
            {
              ingredient_type: "SEMI_PRODUCT",
              ingredient_id: "BTP-008",
              quantity: 150,
            },
            {
              ingredient_type: "BASE_INGREDIENT",
              ingredient_id: "ING-022",
              quantity: 40,
            },
            {
              ingredient_type: "BASE_INGREDIENT",
              ingredient_id: "NNL-006",
              quantity: 1,
            },
          ]),
        },
        {
          id: "REC-068",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-016",
          created_at: "2026-06-25T03:03:10.431Z",
          end_date: null,
          ingredients_json: JSON.stringify([
            {
              ingredient_type: "SEMI_PRODUCT",
              ingredient_id: "BTP-008",
              quantity: 220,
            },
            {
              ingredient_type: "BASE_INGREDIENT",
              ingredient_id: "ING-022",
              quantity: 40,
            },
          ]),
        },
      ],
      variants: [
        { id: "VAR-016", product_id: "PROD-011", size_name: "700ml" },
      ],
      products: [
        { id: "PROD-011", name: "Hồng trà chanh" },
      ],
      baseIngredients: [
        { id: "ING-022", name: "Nước đường" },
        { id: "NNL-006", name: "Trái chanh" },
      ],
      semiProducts: [
        { id: "BTP-008", name: "Hồng trà" },
      ],
    });

    const transition = report.variants[0].transitions[0];
    expect(transition.trueDrops).toEqual([
      {
        name: "Trái chanh",
        ingredientId: "NNL-006",
        ingredientType: "BASE_INGREDIENT",
      },
    ]);
    expect(report.cleanupRecommendations).toEqual([
      expect.objectContaining({
        targetId: "VAR-016",
        recipeId: "REC-068",
        reasons: ["TRUE_DROP: Trái chanh"],
      }),
    ]);
  });

  it("reports quantity changes without treating the ingredient as dropped", () => {
    const report = auditRecipeHistory({
      recipes: [
        {
          id: "REC-OLD",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-06-01T00:00:00.000Z",
          end_date: "2026-06-02T00:00:00.000Z",
          ingredients_json: JSON.stringify([
            {
              ingredient_type: "SEMI_PRODUCT",
              ingredient_id: "BTP-008",
              quantity: 150,
            },
          ]),
        },
        {
          id: "REC-NEW",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-06-02T00:00:00.000Z",
          end_date: null,
          ingredients_json: JSON.stringify([
            {
              ingredient_type: "SEMI_PRODUCT",
              ingredient_id: "BTP-008",
              quantity: 220,
            },
          ]),
        },
      ],
      variants: [
        { id: "VAR-001", product_id: "PROD-001", size_name: "700ml" },
      ],
      products: [
        { id: "PROD-001", name: "Hồng trà chanh" },
      ],
      baseIngredients: [],
      semiProducts: [
        { id: "BTP-008", name: "Hồng trà" },
      ],
    });

    const transition = report.variants[0].transitions[0];
    expect(transition.quantityChanges).toEqual([
      {
        name: "Hồng trà",
        ingredientId: "BTP-008",
        fromQuantity: 150,
        toQuantity: 220,
      },
    ]);
    expect(transition.trueDrops).toEqual([]);
  });

  it("reports multiple open recipes as an actionable cleanup recommendation", () => {
    const report = auditRecipeHistory({
      recipes: [
        {
          id: "REC-OLD",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-06-01T00:00:00.000Z",
          end_date: null,
          ingredients_json: "[]",
        },
        {
          id: "REC-NEW",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-06-02T00:00:00.000Z",
          end_date: "",
          ingredients_json: "[]",
        },
        {
          id: "REC-INACTIVE",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          status: "INACTIVE",
          created_at: "2026-06-03T00:00:00.000Z",
          end_date: null,
          ingredients_json: "[]",
        },
      ],
      variants: [
        { id: "VAR-001", product_id: "PROD-001", size_name: "500ml" },
      ],
      products: [
        { id: "PROD-001", name: "Cà phê đá" },
      ],
      baseIngredients: [],
      semiProducts: [],
    });

    expect(report.variants[0].activeRecipeCount).toBe(2);
    expect(report.cleanupRecommendations).toEqual([
      {
        targetId: "VAR-001",
        recipeId: "REC-NEW",
        reasons: ["MULTIPLE_ACTIVE: 2 open recipes"],
      },
    ]);
  });

  it("reports invalid ingredient JSON for manual cleanup review", () => {
    const report = auditRecipeHistory({
      recipes: [
        {
          id: "REC-OLD",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-06-01T00:00:00.000Z",
          end_date: "2026-06-02T00:00:00.000Z",
          ingredients_json: "[]",
        },
        {
          id: "REC-BAD",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-06-02T00:00:00.000Z",
          end_date: null,
          ingredients_json: "{",
        },
      ],
      variants: [
        { id: "VAR-001", product_id: "PROD-001", size_name: "500ml" },
      ],
      products: [
        { id: "PROD-001", name: "Cà phê đá" },
      ],
      baseIngredients: [],
      semiProducts: [],
    });

    expect(report.errors).toEqual([
      "REC-BAD: invalid ingredients JSON",
    ]);
    expect(report.cleanupRecommendations).toEqual([
      {
        targetId: "VAR-001",
        recipeId: "REC-BAD",
        reasons: ["INVALID_JSON: REC-BAD"],
      },
    ]);
  });

  it("routes ambiguous same-name matching to manual review", () => {
    const report = auditRecipeHistory({
      recipes: [
        {
          id: "REC-OLD",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-06-01T00:00:00.000Z",
          end_date: "2026-06-02T00:00:00.000Z",
          ingredients_json: JSON.stringify([
            { ingredient_type: "SEMI_PRODUCT", ingredient_id: "BTP-004", quantity: 20 },
            { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-OLD", quantity: 10 },
          ]),
        },
        {
          id: "REC-NEW",
          target_type: "PRODUCT_VARIANT",
          target_id: "VAR-001",
          created_at: "2026-06-02T00:00:00.000Z",
          end_date: null,
          ingredients_json: JSON.stringify([
            { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-022", quantity: 20 },
          ]),
        },
      ],
      variants: [
        { id: "VAR-001", product_id: "PROD-001", size_name: "500ml" },
      ],
      products: [
        { id: "PROD-001", name: "Cà phê đá" },
      ],
      baseIngredients: [
        { id: "ING-OLD", name: "Nước đường" },
        { id: "ING-022", name: "Nước đường" },
      ],
      semiProducts: [
        { id: "BTP-004", name: "Nước đường" },
      ],
    });

    const transition = report.variants[0].transitions[0];
    expect(transition.ambiguousNames).toEqual(["Nước đường"]);
    expect(transition.trueDrops).toEqual([]);
    expect(report.cleanupRecommendations[0].reasons).toEqual([
      "AMBIGUOUS_NAME: Nước đường",
    ]);
  });
});

describe("renderRecipeAuditMarkdown", () => {
  it("renders read-only cleanup options and actionable recipe IDs", () => {
    const markdown = renderRecipeAuditMarkdown(
      {
        variants: [{
          targetId: "VAR-016",
          productName: "Hồng trà chanh",
          sizeName: "700ml",
          activeRecipeCount: 1,
          timeline: [{
            id: "REC-068",
            target_type: "PRODUCT_VARIANT",
            target_id: "VAR-016",
            created_at: "2026-06-25T03:03:10.431Z",
            end_date: null,
            ingredients_json: [],
          }],
          transitions: [],
        }],
        cleanupRecommendations: [{
          targetId: "VAR-016",
          recipeId: "REC-068",
          reasons: ["TRUE_DROP: Trái chanh"],
        }],
        errors: [],
      },
      "2026-07-04T00:00:00.000Z",
    );

    expect(markdown).toContain("READ ONLY");
    expect(markdown).toContain("Hồng trà chanh / 700ml");
    expect(markdown).toContain("REC-068");
    expect(markdown).toContain("Option A");
    expect(markdown).toContain("Option B");
    expect(markdown).toContain("Option C");
  });
});
