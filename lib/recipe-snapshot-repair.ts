import { selectEffectiveRecipe } from "@/lib/recipe-selection";
import { buildRecipeSnapshot } from "@/lib/order-snapshot";
import { parseLineRecipeSnapshot, type LineRecipeSnapshot } from "@/lib/order-types";

/**
 * Finds order lines whose recorded recipe_snapshot_json disagrees with the
 * recipe actually in force at the line's own sale time -- checking both the
 * variant recipe and every modifier (topping) recipe independently, since
 * either can drift on its own. Always resolves through selectEffectiveRecipe;
 * never re-implements its filtering (a hand-rolled filter is exactly what
 * caused the bug this module exists to find and repair).
 */

export type SnapshotCheckLine = {
  id: string;
  order_no?: string;
  variant_id: string;
  sale_time: string;
  recipe_snapshot_json: string;
};

export type SnapshotMismatchReason = "INGREDIENT_MISMATCH" | "NO_EFFECTIVE_RECIPE";
export type SnapshotMismatchTarget = "VARIANT" | "MODIFIER";

export type SnapshotMismatchFinding = {
  line_id: string;
  order_no?: string;
  sale_time: string;
  target: SnapshotMismatchTarget;
  target_id: string;
  reason: SnapshotMismatchReason;
  repairable: boolean;
  current_ingredient_ids: string[];
  expected_ingredient_ids: string[] | null;
};

// Includes quantity: per the plan's own finding, most real recipe changes
// are a quantity adjustment on the same ingredient (e.g. 40 ml -> 30 ml of
// syrup), not a different ingredient. Comparing id+type alone would silently
// miss the majority of real mismatches.
function normalizedIngredients(ingredients: Array<{ ingredient_id: string; ingredient_type: string; quantity: number }>): string[] {
  return [...ingredients]
    .map(i => `${i.ingredient_type}:${i.ingredient_id}:${Number(i.quantity)}`)
    .sort();
}

function bareIds(ingredients: Array<{ ingredient_id: string }>): string[] {
  return ingredients.map(i => i.ingredient_id);
}

export function findSnapshotMismatches(input: {
  lines: SnapshotCheckLine[];
  recipes: any[];
}): SnapshotMismatchFinding[] {
  const findings: SnapshotMismatchFinding[] = [];

  for (const line of input.lines) {
    const snapshot = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");

    // ---- Variant recipe ----
    const effectiveVariantRecipe = selectEffectiveRecipe(
      input.recipes, "PRODUCT_VARIANT", line.variant_id, line.sale_time,
    );
    if (!effectiveVariantRecipe) {
      findings.push({
        line_id: line.id, order_no: line.order_no, sale_time: line.sale_time,
        target: "VARIANT", target_id: line.variant_id,
        reason: "NO_EFFECTIVE_RECIPE", repairable: false,
        current_ingredient_ids: bareIds(snapshot.variant.ingredients),
        expected_ingredient_ids: null,
      });
    } else {
      const expectedSnapshot = buildRecipeSnapshot(effectiveVariantRecipe);
      if (normalizedIngredients(snapshot.variant.ingredients).join(",") !== normalizedIngredients(expectedSnapshot.ingredients).join(",")) {
        findings.push({
          line_id: line.id, order_no: line.order_no, sale_time: line.sale_time,
          target: "VARIANT", target_id: line.variant_id,
          reason: "INGREDIENT_MISMATCH", repairable: true,
          current_ingredient_ids: bareIds(snapshot.variant.ingredients),
          expected_ingredient_ids: bareIds(expectedSnapshot.ingredients),
        });
      }
    }

    // ---- Modifier (topping) recipes, each checked independently ----
    for (const modEntry of snapshot.modifiers) {
      const effectiveModRecipe = selectEffectiveRecipe(
        input.recipes, "MODIFIER", modEntry.modifier_id, line.sale_time,
      );
      if (!effectiveModRecipe) {
        findings.push({
          line_id: line.id, order_no: line.order_no, sale_time: line.sale_time,
          target: "MODIFIER", target_id: modEntry.modifier_id,
          reason: "NO_EFFECTIVE_RECIPE", repairable: false,
          current_ingredient_ids: bareIds(modEntry.recipe.ingredients),
          expected_ingredient_ids: null,
        });
        continue;
      }
      const expectedModSnapshot = buildRecipeSnapshot(effectiveModRecipe);
      if (normalizedIngredients(modEntry.recipe.ingredients).join(",") !== normalizedIngredients(expectedModSnapshot.ingredients).join(",")) {
        findings.push({
          line_id: line.id, order_no: line.order_no, sale_time: line.sale_time,
          target: "MODIFIER", target_id: modEntry.modifier_id,
          reason: "INGREDIENT_MISMATCH", repairable: true,
          current_ingredient_ids: bareIds(modEntry.recipe.ingredients),
          expected_ingredient_ids: bareIds(expectedModSnapshot.ingredients),
        });
      }
    }
  }

  return findings;
}

/**
 * Rebuilds a line's full recipe_snapshot_json (variant + every modifier)
 * against whatever is effective at saleTime, via selectEffectiveRecipe --
 * the same resolver findSnapshotMismatches checks against. Used both by the
 * one-time Task 3 repair script and by the backdated-recipe-event recovery
 * path, so there is exactly one place that turns "recipe in force at time X"
 * into a snapshot.
 *
 * A target with no effective recipe is left as-is (matches
 * NO_EFFECTIVE_RECIPE / repairable: false in findSnapshotMismatches --
 * nothing to rebuild against).
 */
export function buildRepairedSnapshot(input: {
  recipeSnapshotJson: string;
  variantId: string;
  saleTime: string;
  recipes: any[];
}): string {
  const snapshot = parseLineRecipeSnapshot(input.recipeSnapshotJson || "{}");

  const effectiveVariantRecipe = selectEffectiveRecipe(
    input.recipes, "PRODUCT_VARIANT", input.variantId, input.saleTime,
  );
  const repairedVariant = effectiveVariantRecipe
    ? buildRecipeSnapshot(effectiveVariantRecipe)
    : snapshot.variant;

  const repairedModifiers = snapshot.modifiers.map(modEntry => {
    const effectiveModRecipe = selectEffectiveRecipe(
      input.recipes, "MODIFIER", modEntry.modifier_id, input.saleTime,
    );
    return effectiveModRecipe
      ? { ...modEntry, recipe: buildRecipeSnapshot(effectiveModRecipe) }
      : modEntry;
  });

  const repaired: LineRecipeSnapshot = { variant: repairedVariant, modifiers: repairedModifiers };
  return JSON.stringify(repaired);
}
