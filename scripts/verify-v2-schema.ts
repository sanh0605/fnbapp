import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { getSheetsClient } = require("../lib/sheets_db");

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
  let hasErrors = false;
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  for (const [sheetName, expectedHeaders] of Object.entries(EXPECTED_SCHEMAS)) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:Z1`,
      });
      const actualHeaders = res.data.values ? res.data.values[0] : [];

      if (!actualHeaders || actualHeaders.length === 0) {
        console.log(`[EMPTY] ${sheetName} has no header row`);
        hasErrors = true;
        continue;
      }

      const missing = expectedHeaders.filter(h => !actualHeaders.includes(h));
      const extra = actualHeaders.filter((h: string) => !expectedHeaders.includes(h) && h.trim() !== "");

      if (missing.length === 0 && extra.length === 0) {
        console.log(`[OK] ${sheetName} — ${expectedHeaders.length} headers match`);
      } else {
        console.log(`[MISMATCH] ${sheetName} — missing: ${missing.length > 0 ? missing.join(", ") : "none"} | extra: ${extra.length > 0 ? extra.join(", ") : "none"}`);
        hasErrors = true;
      }
    } catch (err: any) {
      if (err.message && (err.message.includes("Unable to parse range") || err.message.includes("not found"))) {
        console.log(`[MISSING] ${sheetName} does not exist`);
      } else {
        console.log(`[ERROR] ${sheetName} — ${err.message}`);
      }
      hasErrors = true;
    }
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
