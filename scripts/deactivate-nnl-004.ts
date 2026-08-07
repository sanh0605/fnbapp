import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Plan D Task D1 (docs/superpowers/plans/2026-08-07-stocktake-and-issue-slips.md).
 * Marks NNL-004 ("Sữa yến mạch", Gap 4's orphan duplicate) INACTIVE.
 * Never deletes master data (CLAUDE.md section 2) -- ING-033 is the real,
 * purchased "Sữa yến mạch"; NNL-004 has 0 purchased items, 0 stock_ledger
 * rows, 0 inventory_balances rows, and 0 recipe references (all confirmed
 * live against production before writing this script).
 *
 * Deliberately does NOT reuse deleteBaseIngredientAction
 * (app/admin/inventory/base-ingredients/actions.ts) -- that function issues
 * a real DELETE on base_ingredients (lib/sheets_db.ts remove()), which is
 * itself a violation of the never-delete rule, found while investigating
 * this task. Reported separately; not touched here, out of scope for D1.
 *
 * Dry-run by default; --apply writes for real.
 */

const TARGET_ID = "NNL-004";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");

  const supabase = getSupabaseClient();

  const { data: row, error: readError } = await supabase
    .from("base_ingredients")
    .select("id, name, status")
    .eq("id", TARGET_ID)
    .maybeSingle();
  if (readError) throw new Error(`Read failed: ${readError.message}`);
  if (!row) throw new Error(`${TARGET_ID} not found.`);

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Target: ${row.id} "${row.name}", current status: ${row.status}`);

  // ingredients_json is jsonb -- PostgREST's ilike expects text, so filter
  // in JS instead of relying on an operator that silently mismatches a
  // jsonb column. 139 recipes total; fetching all and scanning is cheap and
  // avoids trusting an unverified query shape for a check this important.
  const [{ data: allRecipes, error: recipeError }, { count: purchasedItemCount }, { count: ledgerCount }, { data: balanceRow }] =
    await Promise.all([
      supabase.from("recipes").select("id, ingredients_json"),
      supabase.from("purchased_items").select("id", { count: "exact", head: true }).eq("base_ingredient_id", TARGET_ID),
      supabase.from("stock_ledger").select("id", { count: "exact", head: true }).eq("item_reference", TARGET_ID),
      supabase.from("inventory_balances").select("quantity").eq("item_reference", TARGET_ID).maybeSingle(),
    ]);
  if (recipeError) throw new Error(`Recipe read failed: ${recipeError.message}`);
  const recipeMatches = (allRecipes ?? []).filter(r => JSON.stringify(r.ingredients_json).includes(TARGET_ID)).length;

  console.log(`Recipe references (ingredients_json contains "${TARGET_ID}", scanned ${allRecipes?.length ?? 0} recipes): ${recipeMatches} (expected 0)`);
  console.log(`Purchased items: ${purchasedItemCount ?? "?"} (expected 0)`);
  console.log(`stock_ledger rows: ${ledgerCount ?? "?"} (expected 0)`);
  console.log(`inventory_balances row: ${balanceRow ? JSON.stringify(balanceRow) : "none"} (expected none)`);

  if ((recipeMatches ?? 0) > 0 || (purchasedItemCount ?? 0) > 0 || (ledgerCount ?? 0) > 0 || balanceRow) {
    console.log("\nSTOP -- a reference exists. Do not mark inactive; investigate first.");
    process.exitCode = 1;
    return;
  }

  if (row.status === "INACTIVE") {
    console.log("\nAlready INACTIVE. Nothing to do.");
    return;
  }

  if (!apply) {
    console.log(`\nWould set status: ${row.status} -> INACTIVE.`);
    console.log("Dry run only -- no data written. Re-run with --apply to write this change.");
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from("base_ingredients")
    .update({ status: "INACTIVE" })
    .eq("id", TARGET_ID)
    .select("id, name, status")
    .maybeSingle();
  if (updateError) throw new Error(`Update failed: ${updateError.message}`);
  console.log(`\nUpdated: ${JSON.stringify(updated)}`);

  const { data: verify, error: verifyError } = await supabase
    .from("base_ingredients")
    .select("id, name, status")
    .eq("id", TARGET_ID)
    .maybeSingle();
  if (verifyError) throw new Error(`Verify failed: ${verifyError.message}`);
  if (verify?.status !== "INACTIVE") {
    console.log(`TASK FAILED VERIFICATION -- do not treat as done. Read back status: ${verify?.status}`);
    process.exitCode = 1;
  } else {
    console.log(`Re-read confirms status: ${verify.status}. All post-write checks passed.`);
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
