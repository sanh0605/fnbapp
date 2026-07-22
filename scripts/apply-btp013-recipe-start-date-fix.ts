import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * One-time fix (2026-07-21), owner-directed: RC-029 (BTP-013 Trứng luộc's
 * only recipe, 1 Trứng gà/NNL-007 -> 1 Trứng luộc) was entered into the
 * system on 2026-06-26, but the owner confirmed the 1:1 ratio was true for
 * the entire history of selling Trứng luộc -- the earliest recorded sale is
 * 2026-06-01 (PHD000662). Rather than a one-off script bypassing the
 * standard recipe-effective-date mechanism, sets RC-029.start_date to one
 * day before the earliest sale (2026-05-31), so the existing, already-
 * tested buildSemiProductRecipeMaps/selectEffectiveRecipe machinery treats
 * this recipe as effective for all historical Trứng luộc orders -- then the
 * standard Round 3 correction script can process them like any other case.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, update } = await import("../lib/sheets_db");

  const recipes = await findAllNoCache("Recipes") as any[];
  const recipe = recipes.find(r => r.id === "RC-029");
  if (!recipe) throw new Error("RC-029 not found");

  const newStartDate = "2026-05-31T17:00:00+00:00";
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`RC-029 current: start_date=${recipe.start_date}, created_at=${recipe.created_at}`);
  console.log(`New start_date: ${newStartDate}`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write this change.");
    return;
  }

  await update("Recipes", recipe.id, { start_date: newStartDate });
  console.log("\nDone.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
