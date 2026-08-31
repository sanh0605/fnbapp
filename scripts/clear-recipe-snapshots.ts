import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * docs/superpowers/plans/2026-08-31-remove-recipe-snapshots.md section 2,
 * change 1. Sets order_lines_v2.recipe_snapshot_json = '{}'::jsonb on every
 * row -- the column stays (NOT NULL, default '{}'::jsonb), only its
 * content is cleared. Recipes were already removed from the sale path
 * (Phase 2); this clears the last 3.444+ frozen no-op copies that path
 * left behind, and matches the column's own default going forward
 * (lib/order-cart.ts stopped writing real content 2026-09-01, same day).
 *
 * order_lines_v2 has no triggers and no updated_at column (checked live
 * before writing this) -- a blanket update touches nothing else.
 * Idempotent: rows already '{}' are just re-set to the same value.
 *
 * Dry run by default; --apply writes for real.
 */

const INVARIANT_SQL = `
  select
    count(*)::int as total_lines,
    count(distinct id)::int as distinct_ids,
    (select count(*)::int from (
      select order_id, id from public.order_lines_v2 group by order_id, id having count(*) > 1
    ) dupes) as duplicate_pairs,
    count(*) filter (where recipe_snapshot_json <> '{}'::jsonb)::int as has_content
  from public.order_lines_v2;
`;

type InvariantRow = {
  total_lines: number;
  distinct_ids: number;
  duplicate_pairs: number;
  has_content: number;
};

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}\n`);

  const before = await readInvariants(supabase);
  console.log("Before:");
  console.table([before]);

  if (before.has_content === 0) {
    console.log("\nNothing to write -- every row is already {}. Stop.");
    return;
  }

  console.log(`\nWould set recipe_snapshot_json = '{}' on all ${before.total_lines} rows (${before.has_content} currently carry real content).`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write this change.");
    return;
  }

  // Blanket update, all rows -- no filter needed (idempotent for rows
  // already {}), and PostgREST/Supabase requires at least one filter
  // clause on an update; id is never null, so this matches every row
  // without needing a jsonb <> comparison (which PostgREST does not
  // reliably support as a query-string filter).
  const { error, count } = await supabase
    .from("order_lines_v2")
    .update({ recipe_snapshot_json: {} }, { count: "exact" })
    .not("id", "is", null);
  if (error) throw new Error(`Update failed: ${error.message}`);
  console.log(`\nUpdated ${count} rows.`);

  console.log("\n=== Verification ===");
  const after = await readInvariants(supabase);
  console.log("After:");
  console.table([after]);

  const sameShape =
    after.total_lines === before.total_lines &&
    after.distinct_ids === before.distinct_ids &&
    after.duplicate_pairs === 0 &&
    before.duplicate_pairs === 0;
  console.log(`\nThe three invariant numbers (total lines, distinct ids, 0 duplicate pairs) held: ${sameShape ? "YES" : "NO -- MISMATCH, investigate"}`);
  if (!sameShape) {
    console.log("TASK FAILED VERIFICATION -- do not treat as done.");
    process.exitCode = 1;
    return;
  }

  console.log(`has_content is now: ${after.has_content} (expected 0)`);
  if (after.has_content !== 0) {
    console.log("TASK FAILED VERIFICATION -- some rows still carry content after the write.");
    process.exitCode = 1;
    return;
  }

  console.log("\nAll post-write checks passed. Re-run scripts/verify-revenue.ts separately to confirm the four closed months are still exact.");
}

async function readInvariants(supabase: ReturnType<Awaited<typeof import("../lib/supabase")>["getSupabaseClient"]>): Promise<InvariantRow> {
  // Uses the same read-only Management API path as the rest of this
  // session's investigation scripts -- direct SQL, not the JS client's
  // query builder, since duplicate_pairs needs a GROUP BY/HAVING the
  // builder cannot express.
  const { buildReadOnlyManagementUrl, normalizeManagementRows } = await import("./audit-gate3-database-security-core");
  const supabaseUrl = process.env.SUPABASE_URL;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!supabaseUrl || !token) throw new Error("Missing SUPABASE_URL or SUPABASE_ACCESS_TOKEN for the invariant read");
  const url = buildReadOnlyManagementUrl(supabaseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: INVARIANT_SQL }),
  });
  if (!res.ok) throw new Error(`Invariant read failed: ${res.status} ${await res.text()}`);
  const rows = normalizeManagementRows<InvariantRow>(await res.json());
  if (!rows[0]) throw new Error("Invariant read returned no rows");
  return rows[0];
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
