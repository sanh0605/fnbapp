/**
 * PRE-MIGRATION RESET: delete ALL V2 rows.
 *
 * ONLY safe to run BEFORE WS-5 live migration. After migration runs,
 * V2 contains real data and this script would destroy it.
 *
 * Safety check: abort if any V2 order has pos_snapshot_json.v1_id set
 * (means migration already ran).
 *
 * Run: npx tsx scripts/reset-v2-sheets.ts --live
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache, remove, removeMany } = require("../lib/sheets_db");

async function main() {
  const isLive = process.argv.includes("--live");

  console.log(`\n=== PRE-MIGRATION RESET (${isLive ? "LIVE" : "DRY-RUN"}) ===\n`);

  const [orders, lines, events, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Order_Events"),
    findAllNoCache("Stock_Ledger"),
  ]);

  // Safety: detect if migration already ran
  const migratedOrders = orders.filter((o: any) => {
    try {
      const snap = JSON.parse(o.pos_snapshot_json || "{}");
      return snap.v1_id;
    } catch {
      return false;
    }
  });

  if (migratedOrders.length > 0) {
    console.error(`\nABORT: ${migratedOrders.length} V2 orders have v1_id (migration already ran).`);
    console.error(`Refusing to delete real migrated data. Restore backups and investigate manually.`);
    process.exit(1);
  }

  console.log(`Found ${orders.length} V2 orders (all are smoke test data)`);
  console.log(`  Order_Lines_V2: ${lines.length}`);
  console.log(`  Order_Events:   ${events.length}`);

  // Find ledger entries pointing to V2 orders (by reference_id or order_event_id)
  const v2OrderIds = new Set(orders.map((o: any) => o.id));
  const v2EventIds = new Set(events.map((e: any) => e.id));
  const v2Ledger = ledger.filter((l: any) =>
    v2OrderIds.has(l.reference_id) || v2EventIds.has(l.order_event_id),
  );
  console.log(`  Stock_Ledger (V2-related): ${v2Ledger.length}`);

  if (!isLive) {
    console.log(`\nDry-run complete. Use --live to delete.`);
    return;
  }

  // Delete in reverse dependency order
  if (v2Ledger.length > 0) {
    await removeMany("Stock_Ledger", v2Ledger.map((l: any) => l.id));
    console.log(`  Deleted ${v2Ledger.length} ledger rows`);
  }
  if (events.length > 0) {
    await removeMany("Order_Events", events.map((e: any) => e.id));
    console.log(`  Deleted ${events.length} event rows`);
  }
  if (lines.length > 0) {
    await removeMany("Order_Lines_V2", lines.map((l: any) => l.id));
    console.log(`  Deleted ${lines.length} line rows`);
  }
  if (orders.length > 0) {
    await removeMany("Orders_V2", orders.map((o: any) => o.id));
    console.log(`  Deleted ${orders.length} order rows`);
  }

  console.log(`\nV2 sheets reset complete. Ready for migration.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
