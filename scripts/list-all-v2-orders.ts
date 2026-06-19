/**
 * List all V2 orders for inspection.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache } = require("../lib/sheets_db");

async function main() {
  const orders = await findAllNoCache("Orders_V2");
  console.log(`\n=== Orders_V2 (${orders.length} rows) ===\n`);
  for (const o of orders) {
    console.log({
      order_no: o.order_no,
      id: o.id,
      version: o.version,
      status: o.status,
      net_total: o.net_total,
      gross_total: o.gross_total,
      created_at: o.created_at,
      created_by_name: o.created_by_name,
      applied_promotion_id: o.applied_promotion_id,
      migration_notes: o.migration_notes,
    });
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
