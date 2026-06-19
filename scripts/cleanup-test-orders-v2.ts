/**
 * Cleanup WS-2/3/4 test orders from V2 sheets.
 *
 * Finds orders where order_no starts with "TEST" or other smoke test artifacts, and removes them from:
 *   - Orders_V2
 *   - Order_Lines_V2
 *   - Order_Events
 *   - Stock_Ledger (by order_event_id or reference_id matching)
 *
 * Run: npx tsx scripts/cleanup-test-orders-v2.ts --live
 * (default is dry-run)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache, remove, removeMany } = require("../lib/sheets_db");

async function main() {
  const isLive = process.argv.includes("--live");
  const prefix = isLive ? "" : "[DRY-RUN] ";

  if (!isLive) {
    console.log("DRY-RUN mode. Use --live to actually delete.");
  }

  const [orders, lines, events, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Order_Events"),
    findAllNoCache("Stock_Ledger"),
  ]);

  // Identify test orders: TEST* prefix, Smoke Test Script actor, or UCK000001 (browser smoke)
  // Adjust this filter as needed; user confirms before --live run via dry-run output.
  const testOrders = (orders as any[]).filter(o => {
    const orderNo = (o.order_no || "").toUpperCase();
    const actor = (o.created_by_name || "").toLowerCase();

    // TEST* prefix (CLI smoke)
    if (orderNo.startsWith("TEST")) return true;

    // Smoke Test actor
    if (actor.includes("smoke test")) return true;

    // PnL smoke test actor
    if (actor.includes("pnl smoke")) return true;

    // Orders created by migration script BEFORE actual V1 migration
    // (these would have migration_notes containing "smoke" or be from system-migration with v1_id pattern)
    if ((o.migration_notes || "").toLowerCase().includes("smoke")) return true;

    // Heuristic: V2 orders placed between WS-2 cutover (2026-06-19) and WS-5 start
    // with very few lines (1-2) and known smoke-test actors
    const isRecent = o.created_at && new Date(o.created_at) > new Date("2026-06-19T00:00:00Z");
    const hasFewLines = false; // would need to count lines per order; skipped for simplicity
    if (isRecent && (actor.includes("test") || actor.includes("admin")) && orderNo.match(/^(PHD|UCK)\d+$/)) {
      // Manually verify in dry-run output before --live
      return false; // Don't auto-delete; flag for manual review
    }

    return false;
  });

  console.log(`\nFound ${testOrders.length} test order(s):`);
  for (const o of testOrders) {
    console.log(`  ${o.order_no} | id=${o.id} | net_total=${o.net_total}`);
  }

  if (testOrders.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  const testOrderIds = new Set(testOrders.map(o => o.id));

  // Find related rows
  const testLines = (lines as any[]).filter(l => testOrderIds.has(l.order_id));
  const testEvents = (events as any[]).filter(e => testOrderIds.has(e.order_id));
  const testEventIds = new Set(testEvents.map(e => e.id));
  const testLedger = (ledger as any[]).filter(l =>
    testOrderIds.has(l.reference_id) || testEventIds.has(l.order_event_id),
  );

  console.log(`\nRelated rows to delete:`);
  console.log(`  Order_Lines_V2: ${testLines.length}`);
  console.log(`  Order_Events:   ${testEvents.length}`);
  console.log(`  Stock_Ledger:   ${testLedger.length}`);

  if (!isLive) {
    console.log("\nDry-run complete. No changes made.");
    return;
  }

  // Delete in reverse dependency order
  if (testLedger.length > 0) {
    await removeMany("Stock_Ledger", testLedger.map((l: any) => l.id));
    console.log(`  Deleted ${testLedger.length} ledger rows`);
  }
  if (testEvents.length > 0) {
    await removeMany("Order_Events", testEvents.map((e: any) => e.id));
    console.log(`  Deleted ${testEvents.length} event rows`);
  }
  if (testLines.length > 0) {
    await removeMany("Order_Lines_V2", testLines.map((l: any) => l.id));
    console.log(`  Deleted ${testLines.length} line rows`);
  }
  for (const o of testOrders) {
    await remove("Orders_V2", o.id);
  }
  console.log(`  Deleted ${testOrders.length} order rows`);

  console.log("\nCleanup complete.");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
