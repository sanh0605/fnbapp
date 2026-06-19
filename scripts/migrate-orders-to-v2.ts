/**
 * V1 → V2 migration script.
 *
 * Reads: Orders, Order_Lines, Stock_Ledger (V1) + reference data
 * Writes: Orders_V2, Order_Lines_V2, Order_Events, Stock_Ledger (V2 entries)
 *
 * Usage:
 *   npx tsx scripts/migrate-orders-to-v2.ts --dry-run    # default, no writes
 *   npx tsx scripts/migrate-orders-to-v2.ts --live        # writes to V2 sheets
 *   npx tsx scripts/migrate-orders-to-v2.ts --live --order-id=ORD-xxx  # single order
 *
 * ALWAYS run dry-run first. Review migration-report.json before --live.
 *
 * Pre-conditions (operator manual):
 *   1. Backup V1 sheets (right-click → Duplicate, suffix _BACKUP_PRE_WS5_<date>)
 *   2. Run scripts/cleanup-all-v2-test-orders.ts --live to clear smoke test rows
 *   3. Stop POS / admin traffic during migration
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const { findAllNoCache, insert, insertMany } = require("../lib/sheets_db");
const { reconstructOrderV2 } = require("../lib/migrate-v1-to-v2");
const { InvariantError } = require("../lib/order-types");
const { computeLineCostAtSale } = require("../lib/order-cogs");
const { parseLineRecipeSnapshot } = require("../lib/order-types");

interface MigrationReport {
  generatedAt: string;
  mode: "DRY-RUN" | "LIVE";
  summary: {
    totalV1Orders: number;
    skippedAlreadyMigrated: number;
    skippedNoLines: number;
    migrated: number;
    invariantFailed: number;
  };
  orders: Array<{
    v1_id: string;
    order_no: string;
    new_id: string;
    gross_total: number;
    net_total: number;
    residual: number;
    invariantPassed: boolean;
    invariantError?: string;
    heuristic_notes: string[];
  }>;
  errors: Array<{ v1_id: string; error: string }>;
}

async function main() {
  const isLive = process.argv.includes("--live");
  const singleOrderId = process.argv.find(a => a.startsWith("--order-id="))?.split("=")[1];
  const report: MigrationReport = {
    generatedAt: new Date().toISOString(),
    mode: isLive ? "LIVE" : "DRY-RUN",
    summary: {
      totalV1Orders: 0, skippedAlreadyMigrated: 0, skippedNoLines: 0,
      migrated: 0, invariantFailed: 0,
    },
    orders: [],
    errors: [],
  };

  console.log(`\n=== V1 → V2 Migration (${report.mode}) ===\n`);

  // 1. Load all data
  console.log("Loading V1 data + reference data...");
  const [v1Orders, v1Lines, v1Ledger, v2OrdersExisting, products, variants, categories, modifiers, promotions, recipes] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Product_Categories"),
    findAllNoCache("Modifiers"),
    findAllNoCache("Promotions"),
    findAllNoCache("Recipes"),
  ]);

  // Build "already migrated" set by v1_id (from V2 orders' pos_snapshot_json)
  const alreadyMigratedV1Ids = new Set<string>();
  for (const o of v2OrdersExisting) {
    try {
      const snap = JSON.parse(o.pos_snapshot_json || "{}");
      if (snap.v1_id) alreadyMigratedV1Ids.add(snap.v1_id);
    } catch {}
  }

  report.summary.totalV1Orders = v1Orders.length;
  console.log(`  V1 orders: ${v1Orders.length}`);
  console.log(`  V2 already-migrated entries: ${alreadyMigratedV1Ids.size}`);

  // 2. Filter V1 orders
  let toMigrate = v1Orders.filter((o: any) => !alreadyMigratedV1Ids.has(o.id));
  if (singleOrderId) {
    toMigrate = toMigrate.filter((o: any) => o.id === singleOrderId);
  }

  console.log(`  To migrate: ${toMigrate.length}\n`);

  // 3. Process each order
  const ref = { products, variants, categories, modifiers, promotions, recipes };
  const ordersToInsert: any[] = [];
  const linesToInsert: any[] = [];
  const eventsToInsert: any[] = [];
  const ledgerToInsert: any[] = [];

  for (const v1Order of toMigrate) {
    const orderV1Lines = v1Lines.filter((l: any) => l.order_id === v1Order.id);

    if (orderV1Lines.length === 0) {
      report.summary.skippedNoLines++;
      report.errors.push({ v1_id: v1Order.id, error: "No Order_Lines found" });
      continue;
    }

    try {
      const result = reconstructOrderV2(v1Order, orderV1Lines, v1Ledger, ref);

      // WS-7 fix: recompute cost_at_sale via MAC from PO_RECEIPT history.
      // V1 Stock_Ledger had unit_cost = 0 for many entries (data quality issue),
      // so we cannot trust V1's stored unit_cost. Instead, recompute MAC for each
      // line using its recipe snapshot and historical PO_RECEIPT entries.
      for (const line of result.lines) {
        const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
        line.cost_at_sale = computeLineCostAtSale(lineRecipe, v1Ledger, Number(line.qty), v1Order.created_at);
      }

      const orderLedger = v1Ledger.filter((l: any) =>
        l.reference_id === v1Order.id && l.transaction_type === "SALES_CONSUME",
      );

      // Build V2 ledger entries (re-create from V1 ledger, link to new order + event)
      for (const oldEntry of orderLedger) {
        ledgerToInsert.push({
          id: `stk-migrated-${require("crypto").randomUUID()}`,
          transaction_type: "SALES_CONSUME",
          reference_id: result.order.id,
          item_reference: oldEntry.item_reference,
          quantity_change: Number(oldEntry.quantity_change),
          unit_cost: Number(oldEntry.unit_cost) || 0,
          created_at: v1Order.created_at,
          order_event_id: result.event.id,
          cost_at_sale: 0, // already accounted in line.cost_at_sale
          source: "MIGRATED_FROM_V1",
        });
      }

      if (!result.invariantPassed) {
        report.summary.invariantFailed++;
        // Still migrate — User can review in report and fix manually if needed
      }

      ordersToInsert.push(result.order);
      linesToInsert.push(...result.lines);
      eventsToInsert.push(result.event);

      report.summary.migrated++;
      report.orders.push({
        v1_id: v1Order.id,
        order_no: v1Order.order_no,
        new_id: result.order.id,
        gross_total: result.classification.gross_total,
        net_total: result.classification.net_total,
        residual: result.classification.residual,
        invariantPassed: result.invariantPassed,
        invariantError: result.invariantError,
        heuristic_notes: result.classification.heuristic_notes,
      });

      if (report.orders.length % 50 === 0) {
        console.log(`  Processed ${report.orders.length}/${toMigrate.length}...`);
      }
    } catch (err: any) {
      report.errors.push({ v1_id: v1Order.id, error: err?.message || String(err) });
    }
  }

  // 4. Write report
  const fs = require("fs");
  const reportPath = "migration-report.json";
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);
  console.log(`\n=== Summary ===`);
  console.log(`  Total V1 orders:     ${report.summary.totalV1Orders}`);
  console.log(`  Already migrated:    ${report.summary.skippedAlreadyMigrated}`);
  console.log(`  Skipped (no lines):  ${report.summary.skippedNoLines}`);
  console.log(`  Migrated:            ${report.summary.migrated}`);
  console.log(`  Invariant failed:    ${report.summary.invariantFailed}`);
  console.log(`  Errors:              ${report.errors.length}`);

  // 5. Live write
  if (isLive) {
    console.log(`\n=== Writing to V2 sheets ===`);
    if (ordersToInsert.length > 0) {
      // Insert in batches of 50 to avoid API rate limits
      const batchSize = 50;
      for (let i = 0; i < ordersToInsert.length; i += batchSize) {
        const batch = ordersToInsert.slice(i, i + batchSize);
        await insertMany("Orders_V2", batch);
        console.log(`  Orders_V2: ${Math.min(i + batchSize, ordersToInsert.length)}/${ordersToInsert.length}`);
      }
    }
    if (linesToInsert.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < linesToInsert.length; i += batchSize) {
        const batch = linesToInsert.slice(i, i + batchSize);
        await insertMany("Order_Lines_V2", batch);
        console.log(`  Order_Lines_V2: ${Math.min(i + batchSize, linesToInsert.length)}/${linesToInsert.length}`);
      }
    }
    if (eventsToInsert.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < eventsToInsert.length; i += batchSize) {
        const batch = eventsToInsert.slice(i, i + batchSize);
        await insertMany("Order_Events", batch);
        console.log(`  Order_Events: ${Math.min(i + batchSize, eventsToInsert.length)}/${eventsToInsert.length}`);
      }
    }
    if (ledgerToInsert.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < ledgerToInsert.length; i += batchSize) {
        const batch = ledgerToInsert.slice(i, i + batchSize);
        await insertMany("Stock_Ledger", batch);
        console.log(`  Stock_Ledger: ${Math.min(i + batchSize, ledgerToInsert.length)}/${ledgerToInsert.length}`);
      }
    }
    console.log(`\nLIVE migration complete.`);
  } else {
    console.log(`\nDry-run complete. Run with --live to write to V2 sheets.`);
    console.log(`Review ${reportPath} before going live.`);
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
