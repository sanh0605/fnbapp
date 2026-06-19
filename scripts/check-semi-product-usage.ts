import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";
const { findAllNoCache } = require("../lib/sheets_db");
const { parseLineRecipeSnapshot } = require("../lib/order-types");

(async () => {
  const lines = await findAllNoCache("Order_Lines_V2");
  let variantSemiCount = 0, variantBaseCount = 0;
  let modSemiCount = 0, modBaseCount = 0;
  const uniqueSemiProducts = new Set();
  for (const l of lines) {
    const recipe = parseLineRecipeSnapshot(l.recipe_snapshot_json);
    for (const ing of recipe.variant.ingredients) {
      if (ing.ingredient_type === "SEMI_PRODUCT") { variantSemiCount++; uniqueSemiProducts.add(ing.ingredient_id); }
      else variantBaseCount++;
    }
    for (const m of recipe.modifiers) {
      for (const ing of m.recipe.ingredients) {
        if (ing.ingredient_type === "SEMI_PRODUCT") { modSemiCount++; uniqueSemiProducts.add(ing.ingredient_id); }
        else modBaseCount++;
      }
    }
  }
  console.log("Variant ingredients: BASE=" + variantBaseCount + ", SEMI=" + variantSemiCount);
  console.log("Modifier ingredients: BASE=" + modBaseCount + ", SEMI=" + modSemiCount);
  console.log("Unique SEMI_PRODUCTs used:", Array.from(uniqueSemiProducts));

  const semiProducts = await findAllNoCache("Semi_Products");
  const spRecipes = await findAllNoCache("Recipes").then((rs: any[]) => rs.filter((r: any) => r.target_type === "SEMI_PRODUCT"));
  console.log("\nSEMI_PRODUCTs in catalog:", semiProducts.length);
  console.log("SEMI_PRODUCT recipes:", spRecipes.length);
  for (const sp of semiProducts.slice(0, 10)) {
    const r = spRecipes.find((x: any) => x.target_id === sp.id);
    console.log("  " + sp.id + " " + sp.name + " | recipe:", r ? (r.ingredients_json || "").substring(0, 200) : "NONE");
  }
})();
