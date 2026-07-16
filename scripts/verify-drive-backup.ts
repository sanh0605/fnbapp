import * as dotenv from "dotenv";
import {
  BACKUP_TABLES,
  buildBackupFileName,
  buildDatabaseSnapshot,
  validateBackupBundle,
} from "../supabase/functions/backup-to-drive/core";

dotenv.config({ path: ".env.local" });

async function main(): Promise<void> {
  if (process.argv.length > 2) throw new Error("This verifier is read-only and accepts no arguments");
  const bundle = await buildDatabaseSnapshot({
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SECRET_KEY
      || process.env.SUPABASE_SERVICE_ROLE_KEY
      || "",
  });
  const summary = validateBackupBundle(bundle);
  const bundleJson = JSON.stringify(bundle);
  const result = {
    success: true,
    mode: "LOCAL_SNAPSHOT_DRY_RUN",
    capturedAt: bundle.capturedAt,
    fileName: buildBackupFileName(bundle.capturedAt),
    tableCount: summary.tableCount,
    expectedTableCount: BACKUP_TABLES.length,
    totalRowCount: summary.totalRowCount,
    bundleBytes: new TextEncoder().encode(bundleJson).byteLength,
    tableCounts: Object.fromEntries(
      Object.entries(bundle.tables).map(([table, entry]) => [table, entry.count]),
    ),
    externalWrites: [],
  };
  console.log(JSON.stringify(result, null, 2));
  console.log("LOCAL SNAPSHOT PASS. No Drive or database rows were written.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
