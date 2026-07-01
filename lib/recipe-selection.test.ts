import { describe, expect, it } from "vitest";
import { selectEffectiveRecipe } from "@/lib/recipe-selection";

const asOf = "2026-07-01T00:00:00.000Z";

describe("selectEffectiveRecipe", () => {
  it("ignores ended recipes regardless of input order", () => {
    const ended = {
      id: "RC-OLD",
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      status: "ACTIVE",
      created_at: "2026-04-01T00:00:00.000Z",
      end_date: "2026-06-01T00:00:00.000Z",
    };
    const current = {
      id: "RC-CURRENT",
      target_type: "SEMI_PRODUCT",
      target_id: "BTP-001",
      status: "ACTIVE",
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
      created_at: "2026-06-01T00:00:00.000Z",
      end_date: "",
    };

    expect(
      selectEffectiveRecipe([legacy], "MODIFIER", "MOD-001", asOf)?.id,
    ).toBe("RC-LEGACY");
  });
});
