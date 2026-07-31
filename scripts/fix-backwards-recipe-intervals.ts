import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Task 6 Step 6 (2026-07-31 recipe-start-date-backfill-and-not-null plan).
 *
 * Deactivates recipes rows whose interval is impossible (end_date before
 * start_date) -- evidence of the defect Task 6 fixes going forward: an
 * effective date typed earlier than the recipe it superseded. Sets
 * status = 'INACTIVE' only; dates are never rewritten
 * (docs/COLLABORATION.md forbids deleting master data, and an impossible
 * interval is the evidence, not noise to clean up).
 *
 * Does NOT touch recipes belonging to deleted semi-products as a general
 * rule -- an orphaned ACTIVE recipe on a DELETED semi-product is what keeps
 * inventory consumption correct for that semi-product (see the plan's "The
 * deleted-semi-product trap"). Only rows that actually violate
 * end_date < start_date are touched, regardless of which semi-product they
 * belong to.
 *
 * Dry-run by default. --apply required to write.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, update } = await import("../lib/sheets_db");

  type Recipe = {
    id: string;
    target_type: string;
    target_id: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
  };

  const recipes = (await findAllNoCache("Recipes")) as Recipe[];

  const backwards = recipes.filter(r =>
    r.end_date && r.start_date && new Date(r.end_date).getTime() < new Date(r.start_date).getTime(),
  );

  console.log(`Recipes total: ${recipes.length}`);
  console.log(`Backwards intervals (end_date < start_date): ${backwards.length}`);
  backwards.forEach(r => console.log(`  ${r.id} ${r.target_type}/${r.target_id} status=${r.status} start=${r.start_date} end=${r.end_date}`));

  const expectedIds = ["RC-033", "RC-036"];
  const actualIds = backwards.map(r => r.id).sort();
  const expectedSorted = [...expectedIds].sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedSorted)) {
    console.error(`\nABORT: expected exactly ${expectedSorted.join(", ")}, found ${actualIds.join(", ") || "(none)"}.`);
    console.error("Data has moved since the plan was written -- investigate before writing anything.");
    process.exit(1);
  }

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Rows to deactivate: ${backwards.length}`);

  if (!apply) {
    backwards.forEach(r => console.log(`  ${r.id}: status ${r.status} -> INACTIVE`));
    console.log("\nDry run only -- no data written. Re-run with --apply to write.");
    return;
  }

  for (const r of backwards) {
    const before = r.status;
    await update("Recipes", r.id, { status: "INACTIVE" });
    console.log(`  ${r.id}: status ${before} -> INACTIVE`);
  }

  const after = (await findAllNoCache("Recipes")) as Recipe[];
  const stillActive = backwards.filter(r => {
    const fresh = after.find(a => a.id === r.id);
    return fresh?.status !== "INACTIVE";
  });
  if (stillActive.length > 0) {
    console.error(`\nABORT: ${stillActive.length} row(s) did not update. Investigate before adding the recipes_end_after_start constraint.`);
    stillActive.forEach(r => console.error(`  ${r.id}`));
    process.exit(1);
  }

  console.log(`\nDeactivated ${backwards.length} row(s).`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
