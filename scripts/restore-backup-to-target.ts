import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 3 restore drill (Task 4). Takes a fresh, read-only snapshot of production and inserts it
 * into an explicitly declared scratch target -- never production. The
 * safety check (assertSafeRestoreTarget) runs before any client, production
 * or target, is opened.
 */

async function main(): Promise<void> {
  const { assertSafeRestoreTarget, restoreBundleToTarget, JSONB_NULL_LITERAL_SENTINEL } = await import("../lib/historical/backup-restore");

  const productionUrl = process.env.SUPABASE_URL || "";
  const targetUrl = process.env.RESTORE_TARGET_SUPABASE_URL || "";
  const targetKey = process.env.RESTORE_TARGET_SERVICE_KEY || "";

  assertSafeRestoreTarget({ productionUrl, targetUrl });
  if (!targetKey) {
    throw new Error("RESTORE_TARGET_SERVICE_KEY is not set.");
  }

  const { BACKUP_TABLES, buildDatabaseSnapshot } = await import("../supabase/functions/backup-to-drive/core");
  const { createClient } = await import("@supabase/supabase-js");

  const productionKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  console.log("Building fresh snapshot from production (read-only)...");
  const bundle = await buildDatabaseSnapshot({
    SUPABASE_URL: productionUrl,
    SUPABASE_SERVICE_ROLE_KEY: productionKey,
  });
  console.log(`Snapshot captured: ${BACKUP_TABLES.length} tables, ${Object.values(bundle.tables).reduce((s, t) => s + t.count, 0)} rows total.`);

  console.log(`Restoring into target: ${new URL(targetUrl).host}`);
  const targetClient = createClient(targetUrl, targetKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const results = await restoreBundleToTarget(bundle, targetClient);

  let totalSkipped = 0;
  let totalSubstituted = 0;
  for (const r of results) {
    const parts: string[] = [];
    if (r.substituted > 0) parts.push(`${r.substituted} substituted (jsonb null literal)`);
    if (r.skipped.length > 0) parts.push(`${r.skipped.length} SKIPPED`);
    const suffix = parts.length > 0 ? `, ${parts.join(", ")}` : "";
    console.log(`  ${r.table}: ${r.inserted} rows inserted${suffix}`);
    totalSkipped += r.skipped.length;
    totalSubstituted += r.substituted;
  }
  if (totalSubstituted > 0) {
    console.log(`\n${totalSubstituted} row(s) had a NOT NULL jsonb column's null literal replaced with a documented sentinel (${JSON.stringify(JSONB_NULL_LITERAL_SENTINEL)}) -- see NOT_NULL_JSONB_NULL_LITERAL_COLUMNS in lib/backup-restore.ts.`);
  }

  if (totalSkipped > 0) {
    console.log(`\n*** ${totalSkipped} row(s) could not be restored -- printed below with their exact error. ***`);
    for (const r of results) {
      for (const s of r.skipped) {
        console.log(`  ${r.table} / ${JSON.stringify(s.row).slice(0, 200)}: ${s.error}`);
      }
    }
  }

  console.log("\nRestore complete. Production was only ever read from; all writes went to the target above.");
}

main().catch((error: unknown) => {
  console.error("FAILED:", error);
  process.exitCode = 1;
});
