import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * One-time backfill (2026-07-20) for the 2 known semi-product recipe
 * versions that changed before the new detect_backdated_recipe_entry
 * trigger (migration 0027) existed to catch them: BTP-002 (effective
 * 2026-07-13T17:00:00Z) and BTP-009 (effective 2026-07-11T17:00:00Z). The
 * trigger only fires on future recipes inserts, so these 2 already-existing
 * rows need a manually-inserted backdated_recipe_events row (same shape the
 * trigger would have produced) before the normal recompute/apply pipeline
 * (lib/backdated-recipe-events/) can process them.
 *
 * This corrects the 6-7 orders found during tonight's BTP-shortfall
 * historical correction whose cost_at_sale used the stale recipe version
 * (the live system, at sale time, hadn't yet had the new recipe entered).
 *
 * Dry-run previews the recompute plan directly (findAffectedRecipeLines +
 * computeSaleTimeCogs) without inserting anything, since the real pipeline
 * needs an existing event row to plan against. --apply inserts the event
 * row(s) (visibility_timestamp = now, i.e. "detected" today) and
 * immediately runs recomputeRecipeEventApply for real. Idempotent: re-
 * running after a partial failure is safe -- insertion uses the same
 * unique (recipe_id) constraint the trigger relies on, and the RPC itself
 * detects an already-applied run.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { findAffectedRecipeLines } = await import("../lib/backdated-recipe-events/find-affected-lines");
  const { computeSaleTimeCogs } = await import("../lib/backdated-ledger/compute-sale-time-cogs");
  const { recomputeRecipeEventApply } = await import("../lib/backdated-recipe-events/recompute-event");

  const [recipes, orders, lines, ledger, semiProducts] = await Promise.all([
    findAllNoCache("Recipes"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Semi_Products"),
  ]) as any[][];

  const targets = [
    { targetId: "BTP-002", effectiveTimestamp: "2026-07-13T17:00:00+00:00" },
    { targetId: "BTP-009", effectiveTimestamp: "2026-07-11T17:00:00+00:00" },
  ];

  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();
  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);

  for (const target of targets) {
    const recipe = (recipes as any[]).find(r =>
      r.target_type === "SEMI_PRODUCT" &&
      r.target_id === target.targetId &&
      new Date(r.created_at).getTime() === new Date(target.effectiveTimestamp).getTime(),
    );
    if (!recipe) {
      console.log(`\n${target.targetId}: no matching recipe row found for effective_timestamp ${target.effectiveTimestamp} -- skipping`);
      continue;
    }

    console.log(`\n${target.targetId}: recipe_id=${recipe.id} effective=${recipe.created_at}`);

    const { data: existing } = await supabase
      .from("backdated_recipe_events")
      .select("id, status, visibility_timestamp")
      .eq("recipe_id", recipe.id)
      .maybeSingle();

    if (!apply) {
      const visibilityTimestamp = existing?.visibility_timestamp || nowIso;
      const affectedLines = findAffectedRecipeLines({
        event: {
          id: "preview",
          target_type: "SEMI_PRODUCT",
          target_id: target.targetId,
          effective_timestamp: recipe.created_at,
          visibility_timestamp: visibilityTimestamp,
        },
        orders: orders as any[],
        lines: lines as any[],
      });
      const orderById = new Map((orders as any[]).map(o => [o.id, o]));
      const lineById = new Map((lines as any[]).map(l => [l.id, l]));
      const changes = affectedLines
        .map(affectedLine => computeSaleTimeCogs({
          order: orderById.get(affectedLine.order_id),
          line: lineById.get(affectedLine.line_id),
          ledger: ledger as any[],
          recipes: recipes as any[],
          semiProducts: semiProducts as any[],
        }))
        .filter(change => change.old_cost_at_sale !== change.new_cost_at_sale);

      console.log(`  ${existing ? `Event already exists: ${existing.id} (status=${existing.status})` : "Would insert a new backdated_recipe_events row"}`);
      console.log(`  Affected lines: ${affectedLines.length}, cost changes: ${changes.length}`);
      for (const change of changes) {
        console.log(`    line=${change.line_id} order=${change.order_id} old=${change.old_cost_at_sale} new=${change.new_cost_at_sale}`);
      }
      continue;
    }

    let eventId: string;
    if (existing) {
      console.log(`  Event already exists: ${existing.id} (status=${existing.status})`);
      eventId = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("backdated_recipe_events")
        .insert({
          recipe_id: recipe.id,
          target_type: "SEMI_PRODUCT",
          target_id: target.targetId,
          effective_timestamp: recipe.created_at,
        })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);
      eventId = inserted.id;
      console.log(`  Inserted event ${eventId}`);
    }

    const result = await recomputeRecipeEventApply(eventId, "Claude");
    console.log(`  Affected lines: ${result.affected_lines.length}, cost changes: ${result.changes.length}`);
    for (const change of result.changes) {
      console.log(`    line=${change.line_id} order=${change.order_id} old=${change.old_cost_at_sale} new=${change.new_cost_at_sale}`);
    }
    console.log(`  Applied: ${JSON.stringify(result.apply_result)} / ${JSON.stringify(result.mark_result)}`);
  }

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
