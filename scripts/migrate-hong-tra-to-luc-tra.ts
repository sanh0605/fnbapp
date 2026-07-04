/**
 * Read-only dry-run for Hồng trà chanh -> Lục trà chanh recovery.
 *
 * This phase intentionally has no apply path. A later, separately reviewed
 * phase will add the atomic PostgreSQL RPC and --apply integration.
 *
 * Usage:
 *   vite-node scripts/migrate-hong-tra-to-luc-tra.ts
 *   vite-node scripts/migrate-hong-tra-to-luc-tra.ts --snapshot-id <id>
 */
import * as dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildHongToLucMigrationPlan,
  buildSnapshotMetadata,
  parseHongToLucMigrationArgs,
  renderHongToLucDryRun,
  type RecoverySnapshotMetadata,
} from "../lib/hong-luc-migration";
import { verifySnapshotBundleFiles } from "../lib/recovery-snapshot";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const MIGRATION_KEY = "HONG_TO_LUC_2026-06-29_V1";
const CUTOFF = "2026-06-29T00:00:00+07:00";
const SOURCE_PRODUCT_ID = "PROD-011";
const TARGET_PRODUCT_ID = "PROD-042";
const CORRUPT_RECIPE_ID = "REC-068";
const EXPECTED_TARGET_RECIPE_ID = "REC-098";
const EXPECTED_ORDER_NUMBERS = [
  "UCK000364",
  "UCK000369",
  "UCK000384",
  "UCK000391",
];

async function main(): Promise<void> {
  const args = parseHongToLucMigrationArgs(process.argv.slice(2));
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [
    products,
    variants,
    recipes,
    semiProducts,
    baseIngredients,
    orders,
    orderLines,
    stockLedger,
  ] = await Promise.all([
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const plan = buildHongToLucMigrationPlan({
    cutoff: CUTOFF,
    migrationKey: MIGRATION_KEY,
    sourceProductId: SOURCE_PRODUCT_ID,
    targetProductId: TARGET_PRODUCT_ID,
    corruptRecipeId: CORRUPT_RECIPE_ID,
    expectedTargetRecipeId: EXPECTED_TARGET_RECIPE_ID,
    expectedOrderNumbers: EXPECTED_ORDER_NUMBERS,
    products: products as any[],
    variants: variants as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
    baseIngredients: baseIngredients as any[],
    orders: orders as any[],
    orderLines: orderLines as any[],
    stockLedger: stockLedger as any[],
  });
  const expected = {
    affectedOrders: 4,
    affectedLines: 4,
    affectedUnits: 5,
    mappedUnits: 5,
    sourceLedgerRows: 29,
    sourceReplayMismatchItems: 0,
    storedCogs: 20_923,
    projectedCogs: 11_370,
    cogsDelta: -9_553,
    unchangedCommercialLines: 4,
  };
  if (JSON.stringify(plan.summary) !== JSON.stringify(expected)) {
    throw new Error(
      "Live result no longer matches the approved audit summary.\n" +
      `Expected: ${JSON.stringify(expected)}\n` +
      `Actual:   ${JSON.stringify(plan.summary)}`,
    );
  }

  let snapshot: RecoverySnapshotMetadata | null = null;
  if (args.snapshotId) {
    const snapshotRoot = resolve(
      process.cwd(),
      "recovery-snapshots",
      args.snapshotId,
    );
    const manifestPath = join(snapshotRoot, "manifest.json");
    const manifestContent = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(manifestContent) as {
      files?: Record<string, unknown>;
    };
    const files = Object.fromEntries([
      ["manifest.json", manifestContent],
      ...Object.keys(manifest.files || {}).map(relativePath => [
        relativePath,
        readFileSync(join(snapshotRoot, relativePath), "utf8"),
      ]),
    ]);
    const verification = verifySnapshotBundleFiles(files);
    if (!verification.valid) {
      throw new Error(
        `Snapshot ${args.snapshotId} failed verification: ` +
        verification.errors.join("; "),
      );
    }
    snapshot = buildSnapshotMetadata(
      args.snapshotId,
      manifestContent,
      true,
      plan.sourceHash,
    );
  }

  process.stdout.write(renderHongToLucDryRun(plan, snapshot));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
