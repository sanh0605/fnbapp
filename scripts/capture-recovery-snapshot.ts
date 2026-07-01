import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as dotenv from "dotenv";
import {
  buildRecoveryRunId,
  createSnapshotBundleFiles,
} from "../lib/recovery-snapshot";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const SOURCE_PAIRS = [
  ["Brands", "brands"],
  ["Product_Categories", "product_categories"],
  ["Item_Categories", "item_categories"],
  ["Units", "units"],
  ["Suppliers", "suppliers"],
  ["Purchase_Sources", "purchase_sources"],
  ["Users", "users"],
  ["Products", "products"],
  ["Product_Variants", "product_variants"],
  ["Modifiers", "modifiers"],
  ["Recipes", "recipes"],
  ["Promotions", "promotions"],
  ["Base_Ingredients", "base_ingredients"],
  ["Semi_Products", "semi_products"],
  ["Purchased_Items", "purchased_items"],
  ["UOM_Conversions", "uom_conversions"],
  ["Product_Price_History", "product_price_history"],
  ["Orders_V2", "orders_v2"],
  ["Order_Lines_V2", "order_lines_v2"],
  ["Order_Events", "order_events"],
  ["Stock_Ledger", "stock_ledger"],
  ["Purchase_Orders", "purchase_orders"],
  ["Purchase_Order_Lines", "purchase_order_lines"],
  ["Stock_Adjustments", "stock_adjustments"],
  ["Production_Orders", "production_orders"],
  ["Production_Items", "production_items"],
  ["POS_Drafts", "pos_drafts"],
] as const;

async function readSupabaseTable(
  tableName: string,
): Promise<Array<Record<string, unknown>>> {
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();
  const rows: Array<Record<string, unknown>> = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .order("id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) {
      throw new Error(`Snapshot read ${tableName}: ${error.message}`);
    }
    const pageRows = (data || []) as Array<Record<string, unknown>>;
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
    page += 1;
  }
  return rows;
}

async function capture(): Promise<void> {
  const capturedAt = new Date();
  const runId = buildRecoveryRunId(capturedAt);
  const sheets: Record<string, { values: unknown[][] }> = {};
  const supabase: Record<string, Array<Record<string, unknown>>> = {};
  const { readRawSheetSnapshots } = await import("../lib/sheets-source");
  const sheetNames = SOURCE_PAIRS.map(([sheetName]) => sheetName);

  console.log(`Reading ${sheetNames.length} Google Sheets tabs in batch...`);
  const sheetSnapshots = await readRawSheetSnapshots(sheetNames);
  for (const [sheetName, tableName] of SOURCE_PAIRS) {
    console.log(`Reading Supabase table ${tableName}...`);
    sheets[sheetName] = sheetSnapshots[sheetName];
    supabase[tableName] = await readSupabaseTable(tableName);
  }

  const files = createSnapshotBundleFiles({
    runId,
    capturedAt: capturedAt.toISOString(),
    sheets,
    supabase,
  });
  const outputRoot = resolve(process.cwd(), "recovery-snapshots");
  const partialDirectory = join(outputRoot, `.partial-${runId}`);
  const finalDirectory = join(outputRoot, runId);
  mkdirSync(outputRoot, { recursive: true });
  mkdirSync(partialDirectory, { recursive: false });

  for (const [relativePath, content] of Object.entries(files)) {
    const outputPath = join(partialDirectory, relativePath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, { encoding: "utf8", flag: "wx" });
  }
  renameSync(partialDirectory, finalDirectory);

  const manifest = JSON.parse(files["manifest.json"]);
  const sheetRows = Object.values(manifest.sources.googleSheets)
    .reduce((sum: number, source: any) => sum + source.rowCount, 0);
  const supabaseRows = Object.values(manifest.sources.supabase)
    .reduce((sum: number, source: any) => sum + source.rowCount, 0);
  console.log(`Snapshot run: ${runId}`);
  console.log(`Google Sheets rows: ${sheetRows}`);
  console.log(`Supabase rows: ${supabaseRows}`);
  console.log(`Files: ${Object.keys(files).length}`);
  console.log(`Output: ${finalDirectory}`);
  console.log("No operational data was written.");
}

async function main(): Promise<void> {
  if (!process.argv.includes("--capture")) {
    console.log("=== IMMUTABLE RECOVERY SNAPSHOT (DRY RUN) ===");
    console.log(`Source pairs: ${SOURCE_PAIRS.length}`);
    console.log("No sources were read and no files were written.");
    console.log("Pass --capture to create a new append-only local bundle.");
  } else {
    await capture();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
