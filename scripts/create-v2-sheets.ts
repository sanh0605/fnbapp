import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { getSheetsClient } = require("../lib/sheets_db");
const { execSync } = require("child_process");

const EXPECTED_SCHEMAS: Record<string, string[]> = {
  Orders_V2: [
    "id", "order_no", "brand_id", "status", "version", "parent_order_id", "superseded_by",
    "created_at", "created_by_id", "created_by_name", "completed_at", "voided_at", "voided_by_id",
    "void_reason", "currency", "gross_total", "promo_discount_total",
    "manual_item_discount_total", "manual_order_discount", "net_total",
    "applied_promotion_id", "applied_promotion_snapshot_json", "pos_snapshot_json",
    "payment_method", "payment_ref", "migration_notes"
  ],
  Order_Lines_V2: [
    "id", "order_id", "line_no", "product_id", "product_snapshot_json",
    "variant_id", "variant_snapshot_json", "qty", "unit_price",
    "modifiers_snapshot_json", "gross_line_total", "promo_discount",
    "manual_item_discount", "order_discount_allocation", "net_line_total",
    "cost_at_sale", "recipe_snapshot_json", "promo_discount_reason",
    "manual_discount_reason"
  ],
  Order_Events: [
    "id", "order_id", "event_type", "event_at", "actor_id", "actor_name",
    "from_version", "to_version", "previous_order_id", "delta_json", "reason"
  ]
};

async function main() {
  const isLive = process.argv.includes("--live");
  const prefix = isLive ? "" : "[DRY-RUN] ";
  
  if (!isLive) {
    console.log("Running in DRY-RUN mode. Use --live to execute changes.");
  }

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  // 1. Get existing sheets
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = meta.data.sheets?.map((s: any) => s.properties.title) || [];

  for (const [sheetName, expectedHeaders] of Object.entries(EXPECTED_SCHEMAS)) {
    // 2. Create sheet if missing
    if (!existingTitles.includes(sheetName)) {
      console.log(`${prefix}[CREATED] Sheet ${sheetName} did not exist.`);
      if (isLive) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: { properties: { title: sheetName } }
            }]
          }
        });
      }
    } else {
      console.log(`${prefix}[SKIP_EXISTS] Sheet ${sheetName} already exists.`);
    }

    // 3. Check and populate headers
    let currentHeaders: string[] = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
      });
      currentHeaders = res.data.values ? res.data.values[0] : [];
    } catch (err: any) {
      if (err.message && err.message.includes("Unable to parse range")) {
        // If the sheet was just created in dry-run, get values will fail on it,
        // so we treat it as empty.
        currentHeaders = [];
      } else {
        throw err;
      }
    }

    if (currentHeaders.length === 0) {
      console.log(`${prefix}[POPULATED] Headers for ${sheetName}.`);
      if (isLive) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`, // Starting at A1
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [expectedHeaders]
          }
        });
      }
    } else {
      console.log(`${prefix}[SKIP_HAS_DATA] ${sheetName} already has data in row 1.`);
    }
  }

  if (isLive) {
    console.log("\nRunning verify-v2-schema.ts to confirm correctness...");
    try {
      execSync("npx tsx scripts/verify-v2-schema.ts", { stdio: "inherit" });
      console.log("Verification passed.");
      process.exit(0);
    } catch (err) {
      console.error("Verification failed.");
      process.exit(1);
    }
  } else {
    console.log("\nDry-run complete. Run with --live to apply changes.");
    process.exit(0);
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
