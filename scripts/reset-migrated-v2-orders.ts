/**
 * Selective V2 reset: delete only orders migrated from V1 (those with
 * pos_snapshot_json.v1_id set). Keep live V2 orders placed after WS-5.
 *
 * Run: npx tsx scripts/reset-migrated-v2-orders.ts --live
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache, removeMany } = require("../lib/sheets_db");

async function main() {
  const isLive = process.argv.includes("--live");

  console.log(`\n=== Selective V2 Reset (${isLive ? "LIVE" : "DRY-RUN"}) ===\n`);

  const [orders, lines, events, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Order_Events"),
    findAllNoCache("Stock_Ledger"),
  ]);

  // Find migrated orders (have v1_id in pos_snapshot_json)
  const migratedOrders = (orders as any[]).filter(o => {
    try {
      const snap = JSON.parse(o.pos_snapshot_json || "{}");
      return !!snap.v1_id;
    } catch { return false; }
  });

  const liveOrders = (orders as any[]).filter(o => !migratedOrders.includes(o));
  console.log(`Total V2 orders: ${orders.length}`);
  console.log(`  Migrated (will delete): ${migratedOrders.length}`);
  console.log(`  Live (will keep):       ${liveOrders.length}`);

  if (migratedOrders.length === 0) {
    console.log("\nNothing to reset.");
    return;
  }

  const migratedOrderIds = new Set(migratedOrders.map(o => o.id));
  const migratedLines = (lines as any[]).filter(l => migratedOrderIds.has(l.order_id));
  const migratedEvents = (events as any[]).filter(e => migratedOrderIds.has(e.order_id));
  const migratedEventIds = new Set(migratedEvents.map(e => e.id));
  const migratedLedger = (ledger as any[]).filter(l =>
    migratedOrderIds.has(l.reference_id) || migratedEventIds.has(l.order_event_id),
  );

  console.log(`\nRows to delete:`);
  console.log(`  Orders_V2:     ${migratedOrders.length}`);
  console.log(`  Order_Lines_V2: ${migratedLines.length}`);
  console.log(`  Order_Events:   ${migratedEvents.length}`);
  console.log(`  Stock_Ledger:   ${migratedLedger.length}`);

  if (!isLive) {
    console.log("\nDry-run complete. Use --live to delete.");
    return;
  }

  if (migratedLedger.length > 0) {
    await removeMany("Stock_Ledger", migratedLedger.map(l => l.id));
    console.log(`  Deleted ${migratedLedger.length} ledger rows`);
  }
  if (migratedEvents.length > 0) {
    await removeMany("Order_Events", migratedEvents.map(e => e.id));
    console.log(`  Deleted ${migratedEvents.length} event rows`);
  }
  if (migratedLines.length > 0) {
    await removeMany("Order_Lines_V2", migratedLines.map(l => l.id));
    console.log(`  Deleted ${migratedLines.length} line rows`);
  }
  await removeMany("Orders_V2", migratedOrders.map(o => o.id));
  console.log(`  Deleted ${migratedOrders.length} order rows`);

  console.log(`\nReset complete. Live V2 orders preserved.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
