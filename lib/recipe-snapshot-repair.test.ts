import { describe, it, expect } from "vitest";
import { findSnapshotMismatches, buildRepairedSnapshot } from "./recipe-snapshot-repair";

// REC-001 for VAR-001 (Cà phê đá 500ml), consuming BTP-004 (Nước đường), in
// force 2026-03-26 -> 2026-05-12. Its successor (REC-002), effective from
// that same instant, consumes ING-022 instead -- the real shape verified
// against production. RCP-MOD-001 for MOD-001 (a topping), same pattern.
const recipeFixture = [
  {
    id: "REC-001", target_type: "PRODUCT_VARIANT", target_id: "VAR-001",
    ingredients_json: JSON.stringify([{ ingredient_id: "BTP-004", ingredient_type: "SEMI_PRODUCT", quantity: 20, unit_id: "U-ML" }]),
    status: "ACTIVE", start_date: "2026-03-26T17:00:00.000Z",
    created_at: "2026-03-26T17:00:00.000Z", end_date: "2026-05-12T17:00:00.000Z",
  },
  {
    id: "REC-002", target_type: "PRODUCT_VARIANT", target_id: "VAR-001",
    ingredients_json: JSON.stringify([{ ingredient_id: "ING-022", ingredient_type: "BASE_INGREDIENT", quantity: 20, unit_id: "U-ML" }]),
    status: "ACTIVE", start_date: "2026-05-12T17:00:00.000Z",
    created_at: "2026-05-12T17:00:00.000Z", end_date: null,
  },
  {
    id: "RCP-MOD-001-OLD", target_type: "MODIFIER", target_id: "MOD-001",
    ingredients_json: JSON.stringify([{ ingredient_id: "ING-050", ingredient_type: "BASE_INGREDIENT", quantity: 30, unit_id: "U-G" }]),
    status: "ACTIVE", start_date: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z", end_date: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "RCP-MOD-001-NEW", target_type: "MODIFIER", target_id: "MOD-001",
    ingredients_json: JSON.stringify([{ ingredient_id: "ING-051", ingredient_type: "BASE_INGREDIENT", quantity: 25, unit_id: "U-G" }]),
    status: "ACTIVE", start_date: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z", end_date: null,
  },
];

function snapshotJson(variantIngredientIds: string[], modifiers: Array<{ modifier_id: string; ingredientIds: string[] }> = []) {
  return JSON.stringify({
    variant: {
      target_type: "PRODUCT_VARIANT", target_id: "VAR-001",
      ingredients: variantIngredientIds.map(id => ({ ingredient_id: id, ingredient_type: "BASE_INGREDIENT", quantity: 20, unit_id: "U-ML" })),
    },
    modifiers: modifiers.map(m => ({
      modifier_id: m.modifier_id,
      modifier_name: m.modifier_id,
      recipe: {
        target_type: "MODIFIER", target_id: m.modifier_id,
        ingredients: m.ingredientIds.map(id => ({ ingredient_id: id, ingredient_type: "BASE_INGREDIENT", quantity: 30, unit_id: "U-G" })),
      },
    })),
  });
}

describe("findSnapshotMismatches", () => {
  it("flags a variant whose snapshot differs from the recipe in force at sale time", () => {
    const findings = findSnapshotMismatches({
      lines: [{ id: "L1", order_no: "O1", variant_id: "VAR-001", sale_time: "2026-04-20T03:00:00Z", recipe_snapshot_json: snapshotJson(["ING-022"]) }],
      recipes: recipeFixture,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].target).toBe("VARIANT");
    expect(findings[0].expected_ingredient_ids).toEqual(["BTP-004"]);
    expect(findings[0].repairable).toBe(true);
  });

  it("flags a variant whose ingredient set matches but quantity differs (the common case: syrup amount changed, not the ingredient itself)", () => {
    const findings = findSnapshotMismatches({
      lines: [{
        id: "L1b", order_no: "O1b", variant_id: "VAR-001", sale_time: "2026-06-20T03:00:00Z",
        recipe_snapshot_json: JSON.stringify({
          variant: {
            target_type: "PRODUCT_VARIANT", target_id: "VAR-001",
            ingredients: [{ ingredient_id: "ING-022", ingredient_type: "BASE_INGREDIENT", quantity: 999, unit_id: "U-ML" }],
          },
          modifiers: [],
        }),
      }],
      recipes: recipeFixture,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe("INGREDIENT_MISMATCH");
  });

  it("leaves a line alone when its variant snapshot already matches", () => {
    const findings = findSnapshotMismatches({
      lines: [{ id: "L2", order_no: "O2", variant_id: "VAR-001", sale_time: "2026-06-20T03:00:00Z", recipe_snapshot_json: snapshotJson(["ING-022"]) }],
      recipes: recipeFixture,
    });
    expect(findings).toEqual([]);
  });

  it("reports rather than repairs a line with no effective recipe", () => {
    const findings = findSnapshotMismatches({
      lines: [{ id: "L3", order_no: "O3", variant_id: "VAR-999", sale_time: "2026-06-20T03:00:00Z", recipe_snapshot_json: snapshotJson(["ANY"]) }],
      recipes: recipeFixture,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe("NO_EFFECTIVE_RECIPE");
    expect(findings[0].repairable).toBe(false);
    expect(findings[0].expected_ingredient_ids).toBeNull();
  });

  it("flags a modifier (topping) whose snapshot differs from the recipe in force at sale time", () => {
    const findings = findSnapshotMismatches({
      lines: [{
        id: "L4", order_no: "O4", variant_id: "VAR-001", sale_time: "2026-05-20T00:00:00Z",
        recipe_snapshot_json: snapshotJson(["ING-022"], [{ modifier_id: "MOD-001", ingredientIds: ["ING-051"] }]),
      }],
      recipes: recipeFixture,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].target).toBe("MODIFIER");
    expect(findings[0].target_id).toBe("MOD-001");
    expect(findings[0].expected_ingredient_ids).toEqual(["ING-050"]);
  });

  it("leaves a line alone when both variant and modifier snapshots already match", () => {
    const findings = findSnapshotMismatches({
      lines: [{
        id: "L5", order_no: "O5", variant_id: "VAR-001", sale_time: "2026-05-20T00:00:00Z",
        recipe_snapshot_json: snapshotJson(["ING-022"], [{ modifier_id: "MOD-001", ingredientIds: ["ING-050"] }]),
      }],
      recipes: recipeFixture,
    });
    expect(findings).toEqual([]);
  });

  it("can flag both the variant and a modifier on the same line independently", () => {
    const findings = findSnapshotMismatches({
      lines: [{
        id: "L6", order_no: "O6", variant_id: "VAR-001", sale_time: "2026-04-20T03:00:00Z",
        recipe_snapshot_json: snapshotJson(["ING-022"], [{ modifier_id: "MOD-001", ingredientIds: ["ING-051"] }]),
      }],
      recipes: recipeFixture,
    });
    expect(findings).toHaveLength(2);
    expect(findings.map(f => f.target).sort()).toEqual(["MODIFIER", "VARIANT"]);
  });
});

describe("buildRepairedSnapshot", () => {
  it("rebuilds the variant recipe against the recipe in force at sale time", () => {
    const repaired = buildRepairedSnapshot({
      recipeSnapshotJson: snapshotJson(["ING-022"]),
      variantId: "VAR-001",
      saleTime: "2026-04-20T03:00:00Z",
      recipes: recipeFixture,
    });
    const parsed = JSON.parse(repaired);
    expect(parsed.variant.ingredients).toEqual([
      { ingredient_id: "BTP-004", ingredient_type: "SEMI_PRODUCT", quantity: 20, unit_id: "U-ML" },
    ]);
  });

  it("also rebuilds every modifier recipe independently", () => {
    const repaired = buildRepairedSnapshot({
      recipeSnapshotJson: snapshotJson(["ING-022"], [{ modifier_id: "MOD-001", ingredientIds: ["ING-051"] }]),
      variantId: "VAR-001",
      saleTime: "2026-04-20T03:00:00Z",
      recipes: recipeFixture,
    });
    const parsed = JSON.parse(repaired);
    expect(parsed.modifiers[0].recipe.ingredients).toEqual([
      { ingredient_id: "ING-050", ingredient_type: "BASE_INGREDIENT", quantity: 30, unit_id: "U-G" },
    ]);
    // modifier_id/modifier_name are preserved, only the recipe fragment changes.
    expect(parsed.modifiers[0].modifier_id).toBe("MOD-001");
  });

  it("leaves the variant untouched when there is no effective recipe to repair against", () => {
    const original = snapshotJson(["ANY"]);
    const repaired = buildRepairedSnapshot({
      recipeSnapshotJson: original,
      variantId: "VAR-999",
      saleTime: "2026-06-20T03:00:00Z",
      recipes: recipeFixture,
    });
    expect(JSON.parse(repaired)).toEqual(JSON.parse(original));
  });

  it("is a no-op (byte-identical modulo key order) when the snapshot already matches", () => {
    const repaired = buildRepairedSnapshot({
      recipeSnapshotJson: snapshotJson(["ING-022"], [{ modifier_id: "MOD-001", ingredientIds: ["ING-050"] }]),
      variantId: "VAR-001",
      saleTime: "2026-05-20T00:00:00Z",
      recipes: recipeFixture,
    });
    const parsed = JSON.parse(repaired);
    expect(parsed.variant.ingredients).toEqual([
      { ingredient_id: "ING-022", ingredient_type: "BASE_INGREDIENT", quantity: 20, unit_id: "U-ML" },
    ]);
    expect(parsed.modifiers[0].recipe.ingredients).toEqual([
      { ingredient_id: "ING-050", ingredient_type: "BASE_INGREDIENT", quantity: 30, unit_id: "U-G" },
    ]);
  });
});
