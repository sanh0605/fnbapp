import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 6 recipe snapshot repair
 * (docs/superpowers/plans/2026-07-30-phase6-recipe-snapshot-repair.md, Task 3).
 * Finds every order line whose recorded recipe_snapshot_json disagrees with
 * the recipe actually in force at its own sale time (variant AND modifier
 * recipes, checked independently), then -- only with --apply -- rewrites
 * exactly that field. Never touches stock, cost, or the order header.
 *
 * Dry run by default.
 */

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, update } = await import("../lib/sheets_db");
  const { findSnapshotMismatches } = await import("../lib/recipe-snapshot-repair");
  const { parseLineRecipeSnapshot } = await import("../lib/order-types");
  const { toSaigonIsoString } = await import("../lib/datetime");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log("Loading data...");
  const [orders, lines, recipes, products, variants] = await Promise.all([
    findAllNoCache("Orders_V2"), findAllNoCache("Order_Lines_V2"), findAllNoCache("Recipes"),
    findAllNoCache("Products"), findAllNoCache("Product_Variants"),
  ]) as any[][];

  const productNameById = new Map((products as any[]).map(p => [p.id, p.name]));
  const variantById = new Map((variants as any[]).map(v => [v.id, v]));

  const targetOrders = (orders as any[]).filter(o => o.status === "COMPLETED" && !o.superseded_by);
  const orderById = new Map(targetOrders.map(o => [o.id, o]));

  const checkLines = (lines as any[])
    .filter(l => l.variant_id && orderById.has(l.order_id))
    .map(l => ({
      id: l.id,
      order_no: orderById.get(l.order_id)?.order_no || l.order_id,
      variant_id: l.variant_id,
      sale_time: orderById.get(l.order_id)?.created_at,
      recipe_snapshot_json: l.recipe_snapshot_json,
    }));
  console.log(`Lines checked: ${checkLines.length}`);

  const findings = findSnapshotMismatches({ lines: checkLines, recipes });
  const variantFindings = findings.filter(f => f.target === "VARIANT");
  const modifierFindings = findings.filter(f => f.target === "MODIFIER");
  const repairable = findings.filter(f => f.repairable);
  const notRepairable = findings.filter(f => !f.repairable);

  const affectedLineIds = new Set(findings.map(f => f.line_id));
  const linesWithVariantMismatch = new Set(variantFindings.map(f => f.line_id));
  const linesWithModifierMismatch = new Set(modifierFindings.map(f => f.line_id));

  console.log(`\n=== WORKED-EXAMPLE CHECK: Cà phê đá 500ml (VAR-001) ===`);
  const var001Findings = variantFindings.filter(f => f.target_id === "VAR-001");
  const var001Expected = 18;
  const var001Pass = var001Findings.length === var001Expected;
  console.log(`VAR-001 variant mismatches found: ${var001Findings.length} (expected exactly ${var001Expected})`);
  console.log(var001Pass ? "PASS" : "*** FAIL -- STOP, do not proceed past Task 3 Step 5 ***");
  const var001SaysBTP004 = var001Findings.every(f => (f.expected_ingredient_ids || []).includes("BTP-004"));
  console.log(`All flagged VAR-001 lines expect BTP-004: ${var001SaysBTP004}`);
  const var001NoneCurrentlyBTP004 = var001Findings.every(f => !f.current_ingredient_ids.includes("BTP-004"));
  console.log(`None of the flagged VAR-001 lines currently say BTP-004 (all say ING-022): ${var001NoneCurrentlyBTP004}`);

  console.log(`\n=== TOTALS ===`);
  console.log(`Total findings: ${findings.length} (variant: ${variantFindings.length}, modifier/topping: ${modifierFindings.length})`);
  console.log(`Distinct lines affected: ${affectedLineIds.size} (variant-only measurement in the prior investigation was 238)`);
  const totalCheck = variantFindings.length >= 238 ? "OK (>= 238)" : "*** FAIL: variant count dropped below 238 -- something was lost, stop and report ***";
  console.log(`Variant-mismatch count vs prior baseline (238): ${variantFindings.length} -- ${totalCheck}`);
  console.log(`Not repairable (NO_EFFECTIVE_RECIPE): ${notRepairable.length}`);
  for (const f of notRepairable) {
    const productId = variantById.get(f.target === "VARIANT" ? f.target_id : checkLines.find(l => l.id === f.line_id)?.variant_id)?.product_id;
    console.log(`  ${f.order_no} / line ${f.line_id} / target ${f.target}:${f.target_id} (${productNameById.get(productId) || productId || f.target_id})`);
  }

  // ---- By month ----
  const byMonth = new Map<string, { variant: number; modifier: number }>();
  for (const f of findings) {
    const month = toSaigonIsoString(new Date(f.sale_time)).slice(0, 7);
    const e = byMonth.get(month) || { variant: 0, modifier: 0 };
    if (f.target === "VARIANT") e.variant++; else e.modifier++;
    byMonth.set(month, e);
  }
  console.log(`\nBy month (variant | topping):`);
  for (const [month, e] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${month}: ${e.variant} variant, ${e.modifier} topping`);
  }

  // ---- By product name (variant-level findings; product owns the variant) ----
  const byProduct = new Map<string, { name: string; variant_lines: number; modifier_lines: number }>();
  for (const f of findings) {
    const line = checkLines.find(l => l.id === f.line_id);
    const productId = variantById.get(line?.variant_id || "")?.product_id;
    const name = productNameById.get(productId) || productId || line?.variant_id || "(unknown)";
    const e = byProduct.get(name) || { name, variant_lines: 0, modifier_lines: 0 };
    if (f.target === "VARIANT") e.variant_lines++; else e.modifier_lines++;
    byProduct.set(name, e);
  }
  console.log(`\nBy product (variant lines | topping lines):`);
  for (const e of [...byProduct.values()].sort((a, b) => (b.variant_lines + b.modifier_lines) - (a.variant_lines + a.modifier_lines))) {
    console.log(`  ${e.name}: ${e.variant_lines} variant, ${e.modifier_lines} topping`);
  }

  // ---- Apply (only ever writes recipe_snapshot_json) ----
  let appliedCount = 0;
  const applyErrors: string[] = [];
  if (apply) {
    console.log(`\nApplying ${repairable.length} repairable finding(s)...`);
    const findingsByLine = new Map<string, typeof repairable>();
    for (const f of repairable) {
      const arr = findingsByLine.get(f.line_id) || [];
      arr.push(f);
      findingsByLine.set(f.line_id, arr);
    }
    for (const [lineId, lineFindings] of findingsByLine) {
      const line = (lines as any[]).find(l => l.id === lineId);
      if (!line) { applyErrors.push(`${lineId}: line not found`); continue; }
      const snapshot = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
      // Rebuild the corrected snapshot directly from recipes, matching
      // exactly what findSnapshotMismatches compared against.
      const { selectEffectiveRecipe } = await import("../lib/recipe-selection");
      const { buildRecipeSnapshot } = await import("../lib/order-snapshot");
      const saleTime = orderById.get(line.order_id)?.created_at;
      const correctedVariant = lineFindings.some(f => f.target === "VARIANT")
        ? (() => {
            const eff = selectEffectiveRecipe(recipes, "PRODUCT_VARIANT", line.variant_id, saleTime);
            return eff ? buildRecipeSnapshot(eff) : snapshot.variant;
          })()
        : snapshot.variant;
      const correctedModifiers = snapshot.modifiers.map(modEntry => {
        const finding = lineFindings.find(f => f.target === "MODIFIER" && f.target_id === modEntry.modifier_id);
        if (!finding) return modEntry;
        const eff = selectEffectiveRecipe(recipes, "MODIFIER", modEntry.modifier_id, saleTime);
        return eff ? { ...modEntry, recipe: buildRecipeSnapshot(eff) } : modEntry;
      });
      try {
        await update("Order_Lines_V2", lineId, {
          recipe_snapshot_json: JSON.stringify({ variant: correctedVariant, modifiers: correctedModifiers }),
        });
        appliedCount++;
      } catch (err) {
        applyErrors.push(`${lineId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log(`Applied: ${appliedCount} / ${repairable.length}`);
    if (applyErrors.length > 0) {
      console.log(`Errors: ${applyErrors.length}`);
      applyErrors.forEach(e => console.log(`  ${e}`));
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: apply ? "APPLY" : "DRY_RUN",
    lines_checked: checkLines.length,
    total_findings: findings.length,
    variant_findings: variantFindings.length,
    modifier_findings: modifierFindings.length,
    distinct_lines_affected: affectedLineIds.size,
    lines_with_variant_mismatch: linesWithVariantMismatch.size,
    lines_with_modifier_mismatch: linesWithModifierMismatch.size,
    not_repairable_count: notRepairable.length,
    not_repairable: notRepairable,
    worked_example_check: {
      variant_id: "VAR-001", product_name: "Cà phê đá", expected: var001Expected,
      actual: var001Findings.length, pass: var001Pass,
    },
    baseline_check: { prior_variant_only_baseline: 238, current_variant_findings: variantFindings.length, pass: variantFindings.length >= 238 },
    by_month: Object.fromEntries(byMonth),
    by_product: Object.fromEntries([...byProduct.entries()].map(([k, v]) => [k, v])),
    findings,
    applied_count: apply ? appliedCount : null,
    apply_errors: apply ? applyErrors : null,
  };
  const outPath = path.resolve(
    process.cwd(),
    apply ? "docs/audits/2026-07-30-recipe-snapshot-repair-apply.json" : "docs/audits/2026-07-30-recipe-snapshot-repair-dryrun.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to ${outPath}`);
  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply only after the owner approves this summary.");
  }
}
main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
