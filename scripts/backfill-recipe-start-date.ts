import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Task 1 (2026-07-31 recipe-start-date-backfill-and-not-null plan).
 *
 * Backfills recipes.start_date := created_at for rows where it is null.
 *
 * Behaviour-neutral by construction: lib/recipe-selection.ts's
 * selectEffectiveRecipe already reads `start_date || created_at`, so writing
 * created_at into start_date cannot change any selection result. This script
 * proves that per-row rather than asserting it -- it replays
 * selectEffectiveRecipe over every order line before and after the proposed
 * change and refuses to apply if any line's selected recipe id differs.
 *
 * Dry-run by default. --apply required to write.
 */

type Recipe = {
  id: string;
  target_type: string;
  target_id: string;
  status: string;
  ingredients_json: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, update } = await import("../lib/sheets_db");
  const { selectEffectiveRecipe } = await import("../lib/recipe-selection");

  const recipes = (await findAllNoCache("Recipes")) as Recipe[];
  const nulls = recipes.filter(r => !r.start_date);
  console.log(`Recipes total: ${recipes.length}`);
  console.log(`With null start_date: ${nulls.length}`);

  const missingCreatedAt = nulls.filter(r => !r.created_at);
  if (missingCreatedAt.length > 0) {
    console.error(`ABORT: ${missingCreatedAt.length} rows have neither start_date nor created_at:`);
    missingCreatedAt.forEach(r => console.error(`  ${r.id}`));
    process.exit(1);
  }

  const backfilled = recipes.map(r => (r.start_date ? r : { ...r, start_date: r.created_at }));

  const orders = (await findAllNoCache("Orders_V2")) as Array<{
    id: string; created_at: string; status: string; superseded_by: string | null;
  }>;
  const orderTime = new Map<string, string>();
  for (const o of orders) {
    if (o.status === "COMPLETED" && !o.superseded_by) orderTime.set(o.id, o.created_at);
  }

  const lines = (await findAllNoCache("Order_Lines_V2")) as Array<{
    id: string; order_id: string; recipe_snapshot_json: unknown;
  }>;

  // Every (target_type, target_id) that any order line touches, checked at
  // that line's own sale time. Covers variants and their semi-products.
  let checked = 0;
  const diffs: string[] = [];
  for (const line of lines) {
    const at = orderTime.get(line.order_id);
    if (!at) continue;
    // findAllNoCache stringifies jsonb columns for legacy-Sheets callers
    // (lib/sheets_db.ts serializeRow); parse before reading into it.
    let snap: { variant?: { target_id?: string; ingredients?: Array<{ ingredient_type?: string; ingredient_id?: string }> } } | null = null;
    if (typeof line.recipe_snapshot_json === "string" && line.recipe_snapshot_json) {
      try {
        snap = JSON.parse(line.recipe_snapshot_json);
      } catch {
        snap = null;
      }
    } else if (line.recipe_snapshot_json && typeof line.recipe_snapshot_json === "object") {
      snap = line.recipe_snapshot_json as unknown as typeof snap;
    }
    if (!snap?.variant?.target_id) continue;

    const targets: Array<[string, string]> = [["PRODUCT_VARIANT", snap.variant.target_id]];
    for (const ing of snap.variant.ingredients ?? []) {
      if (ing.ingredient_type === "SEMI_PRODUCT" && ing.ingredient_id) {
        targets.push(["SEMI_PRODUCT", ing.ingredient_id]);
      }
    }

    for (const [type, id] of targets) {
      checked += 1;
      const before = selectEffectiveRecipe(recipes, type, id, at);
      const after = selectEffectiveRecipe(backfilled, type, id, at);
      if ((before?.id ?? null) !== (after?.id ?? null)) {
        diffs.push(`${line.id} ${type}/${id} @${at}: ${before?.id ?? "none"} -> ${after?.id ?? "none"}`);
      }
    }
  }

  console.log(`\nEquivalence check: ${checked} (line, target) selections replayed`);
  console.log(`Differences: ${diffs.length}`);
  diffs.slice(0, 20).forEach(d => console.log(`  ${d}`));

  if (diffs.length > 0) {
    console.error("\nABORT: backfill is not behaviour-neutral. Nothing written.");
    process.exit(1);
  }

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Rows to update: ${nulls.length}`);
  nulls.slice(0, 10).forEach(r => console.log(`  ${r.id} ${r.target_type}/${r.target_id} start_date := ${r.created_at}`));
  if (nulls.length > 10) console.log(`  ... and ${nulls.length - 10} more`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write.");
    return;
  }

  let written = 0;
  for (const r of nulls) {
    await update("Recipes", r.id, { start_date: r.created_at });
    written += 1;
  }
  console.log(`\nUpdated ${written} rows.`);

  const after = (await findAllNoCache("Recipes")) as Recipe[];
  const remaining = after.filter(r => !r.start_date).length;
  console.log(`Rows still null after apply: ${remaining}`);
  if (remaining !== 0) {
    console.error("ABORT: nulls remain. Investigate before adding the NOT NULL constraint.");
    process.exit(1);
  }
}

main().catch(e => {
  console.error("FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
