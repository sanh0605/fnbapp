import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";
const { findAllNoCache } = require("../lib/sheets_db");
const { parseLineRecipeSnapshot } = require("../lib/order-types");

(async () => {
  const lines = await findAllNoCache("Order_Lines_V2");
  const targetMods = ["MOD-001", "MOD-003", "MOD-004"];
  const sampleByMod = new Map();
  for (const l of lines) {
    const recipe = parseLineRecipeSnapshot(l.recipe_snapshot_json);
    for (const m of recipe.modifiers) {
      if (targetMods.includes(m.modifier_id) && !sampleByMod.has(m.modifier_id)) {
        sampleByMod.set(m.modifier_id, { name: m.modifier_name, recipe: m.recipe });
      }
    }
  }
  console.log("Recipe snapshots in V2 lines:");
  for (const [id, info] of sampleByMod) {
    console.log(id, info.name);
    console.log("  ingredients:", JSON.stringify(info.recipe.ingredients));
  }

  const recipes = await findAllNoCache("Recipes");
  const modRecipes = recipes.filter((r: any) => r.target_type === "MODIFIER");
  console.log("\nLive MODIFIER recipes:");
  for (const r of modRecipes) {
    console.log("  ", r.target_id, "|", (r.ingredients_json || "").substring(0, 200));
  }
})();
