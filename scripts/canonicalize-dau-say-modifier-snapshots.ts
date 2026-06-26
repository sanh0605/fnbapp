import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

type ModifierRow = {
  id?: string;
  name?: string;
  status?: string;
  created_at?: string;
};

type OrderLineRow = {
  id?: string;
  order_id?: string;
  modifiers_snapshot_json?: string;
  recipe_snapshot_json?: string;
};

type PlannedUpdate = {
  lineId: string;
  orderId: string;
  oldModifierIds: string[];
  modifiers_snapshot_json?: string;
  recipe_snapshot_json?: string;
};

function normalizeName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function idNumber(id: string): number {
  const match = String(id || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function compareCanonical(a: ModifierRow, b: ModifierRow): number {
  const aActive = a.status === "DELETED" ? 0 : 1;
  const bActive = b.status === "DELETED" ? 0 : 1;
  if (aActive !== bActive) return bActive - aActive;

  const aTime = new Date(a.created_at || 0).getTime();
  const bTime = new Date(b.created_at || 0).getTime();
  if (aTime !== bTime) return bTime - aTime;

  return idNumber(b.id || "") - idNumber(a.id || "");
}

function safeParseArray(json: string | undefined): any[] | null {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function safeParseObject(json: string | undefined): any | null {
  try {
    const parsed = JSON.parse(json || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function planLineUpdate(line: OrderLineRow, oldIds: Set<string>, canonical: ModifierRow): PlannedUpdate | null {
  const oldModifierIds = new Set<string>();
  let modifiersChanged = false;
  let recipeChanged = false;
  let nextModifiersJson: string | undefined;
  let nextRecipeJson: string | undefined;

  const modifiers = safeParseArray(line.modifiers_snapshot_json);
  if (modifiers) {
    const nextModifiers = modifiers.map(modifier => {
      const modifierId = String(modifier?.id || "");
      const modifierName = String(modifier?.name || "");
      if (oldIds.has(modifierId) || normalizeName(modifierName) === normalizeName(canonical.name || "")) {
        if (modifierId !== canonical.id) {
          oldModifierIds.add(modifierId);
          modifiersChanged = true;
          return { ...modifier, id: canonical.id };
        }
      }
      return modifier;
    });
    if (modifiersChanged) nextModifiersJson = JSON.stringify(nextModifiers);
  }

  const recipe = safeParseObject(line.recipe_snapshot_json);
  if (recipe && Array.isArray(recipe.modifiers)) {
    const nextRecipe = {
      ...recipe,
      modifiers: recipe.modifiers.map((modifier: any) => {
        const modifierId = String(modifier?.modifier_id || "");
        const modifierName = String(modifier?.modifier_name || "");
        if (oldIds.has(modifierId) || normalizeName(modifierName) === normalizeName(canonical.name || "")) {
          if (modifierId !== canonical.id || modifier?.recipe?.target_id !== canonical.id) {
            oldModifierIds.add(modifierId);
            recipeChanged = true;
            return {
              ...modifier,
              modifier_id: canonical.id,
              recipe: modifier.recipe
                ? { ...modifier.recipe, target_id: canonical.id }
                : modifier.recipe,
            };
          }
        }
        return modifier;
      }),
    };
    if (recipeChanged) nextRecipeJson = JSON.stringify(nextRecipe);
  }

  if (!modifiersChanged && !recipeChanged) return null;
  if (!line.id) throw new Error(`Order_Lines_V2 row missing id for order ${line.order_id || ""}`);

  return {
    lineId: line.id,
    orderId: line.order_id || "",
    oldModifierIds: Array.from(oldModifierIds).filter(Boolean),
    modifiers_snapshot_json: nextModifiersJson,
    recipe_snapshot_json: nextRecipeJson,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, update } = await import("../lib/sheets_db");

  const [modifiers, lines] = await Promise.all([
    findAllNoCache("Modifiers") as Promise<ModifierRow[]>,
    findAllNoCache("Order_Lines_V2") as Promise<OrderLineRow[]>,
  ]);

  const targetName = "Dâu sấy";
  const targetKey = normalizeName(targetName);
  const candidates = modifiers
    .filter(modifier => normalizeName(modifier.name || "") === targetKey && modifier.id)
    .sort(compareCanonical);

  if (candidates.length === 0) {
    throw new Error(`No modifier found for ${targetName}`);
  }

  const canonical = candidates[0];
  const oldIds = new Set(candidates.map(modifier => modifier.id || "").filter(id => id && id !== canonical.id));
  const planned = lines
    .map(line => planLineUpdate(line, oldIds, canonical))
    .filter(Boolean) as PlannedUpdate[];

  console.log("=== DÂU SẤY MODIFIER SNAPSHOT CANONICALIZATION ===");
  console.log(`Canonical modifier: ${canonical.id} | ${canonical.name} | status=${canonical.status || ""} | created_at=${canonical.created_at || ""}`);
  console.log(`Old modifier ids:   ${Array.from(oldIds).join(", ") || "(none)"}`);
  console.log(`Lines to update:    ${planned.length}`);

  for (const row of planned.slice(0, 30)) {
    console.log(`${row.lineId} | order=${row.orderId} | old=${row.oldModifierIds.join(",") || "(name-only)"}`);
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write changes.");
    return;
  }

  for (const row of planned) {
    const patch: Record<string, string> = {};
    if (row.modifiers_snapshot_json) patch.modifiers_snapshot_json = row.modifiers_snapshot_json;
    if (row.recipe_snapshot_json) patch.recipe_snapshot_json = row.recipe_snapshot_json;
    await update("Order_Lines_V2", row.lineId, patch);
  }

  console.log(`\nApplied ${planned.length} Order_Lines_V2 updates.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
