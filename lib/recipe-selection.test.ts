import { describe, expect, it } from "vitest";
import {
  findLatestActiveRecipe,
  planRecipeSave,
  selectEffectiveRecipe,
} from "@/lib/recipe-selection";

const asOf = "2026-07-01T00:00:00.000Z";

describe("selectEffectiveRecipe", () => {
  it("ignores ended recipes regardless of input order", () => {
    const ended = {
      id: "RC-OLD",
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      status: "ACTIVE",
      start_date: "2026-04-01T00:00:00.000Z",
      created_at: "2026-04-01T00:00:00.000Z",
      end_date: "2026-06-01T00:00:00.000Z",
    };
    const current = {
      id: "RC-CURRENT",
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      status: "ACTIVE",
      start_date: "2026-06-01T00:00:00.000Z",
      created_at: "2026-06-01T00:00:00.000Z",
      end_date: null,
    };

    expect(
      selectEffectiveRecipe(
        [ended, current],
        "SEMI_PRODUCT",
        "BTP-001",
        asOf,
      )?.id,
    ).toBe("RC-CURRENT");
  });

  it("selects the latest effective active recipe", () => {
    const recipes = [
      {
        id: "RC-NEWER",
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-001",
        status: "ACTIVE",
        start_date: "2026-06-20T00:00:00.000Z",
        created_at: "2026-06-19T00:00:00.000Z",
      },
      {
        id: "RC-OLDER",
        target_type: "PRODUCT_VARIANT",
        target_id: "VAR-001",
        status: "ACTIVE",
        start_date: "2026-06-01T00:00:00.000Z",
        created_at: "2026-06-01T00:00:00.000Z",
      },
    ];

    expect(
      selectEffectiveRecipe(
        recipes.reverse(),
        "PRODUCT_VARIANT",
        "VAR-001",
        asOf,
      )?.id,
    ).toBe("RC-NEWER");
  });

  it("excludes inactive and future recipes", () => {
    const recipes = [
      {
        id: "RC-INACTIVE",
        target_type: "MODIFIER",
        target_id: "MOD-001",
        status: "INACTIVE",
        created_at: "2026-06-01T00:00:00.000Z",
      },
      {
        id: "RC-FUTURE",
        target_type: "MODIFIER",
        target_id: "MOD-001",
        status: "ACTIVE",
        start_date: "2026-08-01T00:00:00.000Z",
        created_at: "2026-06-01T00:00:00.000Z",
      },
    ];

    expect(
      selectEffectiveRecipe(recipes, "MODIFIER", "MOD-001", asOf),
    ).toBeNull();
  });

  it("accepts legacy recipes without a status field", () => {
    const legacy = {
      id: "RC-LEGACY",
      target_type: "MODIFIER",
      target_id: "MOD-001",
      start_date: "2026-06-01T00:00:00.000Z",
      created_at: "2026-06-01T00:00:00.000Z",
      end_date: "",
    };

    expect(
      selectEffectiveRecipe([legacy], "MODIFIER", "MOD-001", asOf)?.id,
    ).toBe("RC-LEGACY");
  });
});

describe("selectEffectiveRecipe without the created_at fallback", () => {
  // After 0048, start_date is never null. A recipe whose start_date is in
  // the future must not be selected even when its created_at is in the past
  // -- under the old fallback this distinction could not be expressed.
  it("ignores created_at entirely and honours start_date alone", () => {
    const recipes = [
      { id: "RC-OLD", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
        status: "ACTIVE", ingredients_json: "[]",
        start_date: "2026-04-01T00:00:00.000Z", created_at: "2026-04-01T00:00:00.000Z" },
      { id: "RC-FUTURE", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
        status: "ACTIVE", ingredients_json: "[]",
        start_date: "2026-09-01T00:00:00.000Z", created_at: "2026-04-02T00:00:00.000Z" },
    ];
    const picked = selectEffectiveRecipe(recipes, "SEMI_PRODUCT", "BTP-001", "2026-05-01T00:00:00.000Z");
    expect(picked?.id).toBe("RC-OLD");
  });

  it("throws when start_date is missing instead of silently guessing", () => {
    const recipes = [
      { id: "RC-BAD", target_type: "SEMI_PRODUCT", target_id: "BTP-001",
        status: "ACTIVE", ingredients_json: "[]",
        start_date: null as unknown as string, created_at: "2026-04-01T00:00:00.000Z" },
    ];
    expect(() =>
      selectEffectiveRecipe(recipes, "SEMI_PRODUCT", "BTP-001", "2026-05-01T00:00:00.000Z"),
    ).toThrow(/RC-BAD/);
  });
});

describe("findLatestActiveRecipe", () => {
  it("selects the newest open recipe regardless of input order", () => {
    const oldest = {
      id: "REC-OLD",
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-001",
      status: "ACTIVE",
      created_at: "2026-06-01T00:00:00.000Z",
      end_date: null,
    };
    const newest = {
      ...oldest,
      id: "REC-NEW",
      created_at: "2026-06-25T00:00:00.000Z",
    };

    expect(
      findLatestActiveRecipe([oldest, newest], "PRODUCT_VARIANT", "VAR-001")?.id,
    ).toBe("REC-NEW");
  });

  it("uses descending recipe ID as a deterministic timestamp tie-breaker", () => {
    const timestamp = "2026-06-25T00:00:00.000Z";
    const recipes = ["REC-010", "REC-011"].map(id => ({
      id,
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-001",
      status: "ACTIVE",
      created_at: timestamp,
      end_date: null,
    }));

    expect(
      findLatestActiveRecipe(
        recipes,
        "PRODUCT_VARIANT",
        "VAR-001",
      )?.id,
    ).toBe("REC-011");
  });

  it("filters by both target type and target ID", () => {
    const base = {
      status: "ACTIVE",
      created_at: "2026-06-25T00:00:00.000Z",
      end_date: null,
    };
    const recipes = [
      {
        ...base,
        id: "REC-WRONG-TYPE",
        target_type: "PRODUCT_VARIANT",
        target_id: "MOD-001",
      },
      {
        ...base,
        id: "REC-WRONG-ID",
        target_type: "MODIFIER",
        target_id: "MOD-002",
      },
      {
        ...base,
        id: "REC-MODIFIER",
        target_type: "MODIFIER",
        target_id: "MOD-001",
        created_at: "2026-06-01T00:00:00.000Z",
      },
    ];

    expect(
      findLatestActiveRecipe(recipes, "MODIFIER", "MOD-001")?.id,
    ).toBe("REC-MODIFIER");
  });
});

describe("planRecipeSave", () => {
  it("returns UNCHANGED for equivalent normalized ingredients", () => {
    const activeRecipe = {
      id: "REC-NEW",
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-001",
      status: "ACTIVE",
      created_at: "2026-06-25T00:00:00.000Z",
      end_date: null,
      ingredients_json: JSON.stringify([
        { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
        { ingredient_type: "SEMI_PRODUCT", ingredient_id: "BTP-001", quantity: 60 },
      ]),
    };

    const result = planRecipeSave(
      [activeRecipe],
      "PRODUCT_VARIANT",
      "VAR-001",
      [
        { ingredient_type: "SEMI_PRODUCT", ingredient_id: "BTP-001", quantity: "60" },
        { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
      ],
    );

    expect(result).toMatchObject({
      decision: "UNCHANGED",
      activeRecipe,
    });
  });

  it("returns CREATE_VERSION exactly once when ingredients change", () => {
    const activeRecipe = {
      id: "REC-NEW",
      target_type: "PRODUCT_VARIANT",
      target_id: "VAR-001",
      status: "ACTIVE",
      created_at: "2026-06-25T00:00:00.000Z",
      end_date: null,
      ingredients_json: JSON.stringify([
        { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
      ]),
    };

    expect(
      planRecipeSave(
        [activeRecipe],
        "PRODUCT_VARIANT",
        "VAR-001",
        [
          { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 30 },
        ],
      ),
    ).toMatchObject({
      decision: "CREATE_VERSION",
      activeRecipe,
      newRecipeCount: 1,
    });
  });

  it("returns CREATE_INITIAL exactly once when no open recipe exists", () => {
    expect(
      planRecipeSave(
        [],
        "PRODUCT_VARIANT",
        "VAR-001",
        [
          { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
        ],
      ),
    ).toEqual({
      decision: "CREATE_INITIAL",
      activeRecipe: null,
      newRecipeCount: 1,
    });
  });

  it("returns UNCHANGED for equivalent modifier ingredients", () => {
    const activeRecipe = {
      id: "REC-MODIFIER",
      target_type: "MODIFIER",
      target_id: "MOD-001",
      status: "ACTIVE",
      created_at: "2026-06-25T00:00:00.000Z",
      end_date: null,
      ingredients_json: JSON.stringify([
        { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
        { ingredient_type: "SEMI_PRODUCT", ingredient_id: "BTP-001", quantity: 60 },
      ]),
    };

    expect(
      planRecipeSave(
        [activeRecipe],
        "MODIFIER",
        "MOD-001",
        [
          { ingredient_type: "SEMI_PRODUCT", ingredient_id: "BTP-001", quantity: "60" },
          { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
        ],
      ),
    ).toMatchObject({
      decision: "UNCHANGED",
      activeRecipe,
      newRecipeCount: 0,
    });
  });

  it("returns CREATE_VERSION for changed modifier ingredients", () => {
    const activeRecipe = {
      id: "REC-MODIFIER",
      target_type: "MODIFIER",
      target_id: "MOD-001",
      status: "ACTIVE",
      created_at: "2026-06-25T00:00:00.000Z",
      end_date: null,
      ingredients_json: JSON.stringify([
        { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
      ]),
    };

    expect(
      planRecipeSave(
        [activeRecipe],
        "MODIFIER",
        "MOD-001",
        [
          { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 30 },
        ],
      ),
    ).toMatchObject({
      decision: "CREATE_VERSION",
      activeRecipe,
      newRecipeCount: 1,
    });
  });

  it("returns CREATE_INITIAL for modifier ingredients with no active recipe", () => {
    expect(
      planRecipeSave(
        [],
        "MODIFIER",
        "MOD-001",
        [
          { ingredient_type: "BASE_INGREDIENT", ingredient_id: "ING-001", quantity: 20 },
        ],
      ),
    ).toEqual({
      decision: "CREATE_INITIAL",
      activeRecipe: null,
      newRecipeCount: 1,
    });
  });
});
