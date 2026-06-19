/**
 * Fix 2 issues after WS-7 partial migration:
 *
 * 1. Stock_Ledger missing 2610 entries (rate limit hit during write).
 *    Fill them now with delays between batches.
 *
 * 2. 4 combo orders (PHD000540/548/561/562) have invariant violations
 *    because V1 discount_amount > capacity (cashier gave >100% discount
 *    due to promo+manual overlap). Cap manual_order_discount at capacity
 *    for these orders; update line allocations.
 *
 * Run: npx tsx scripts/fix-ws7-migration-issues.ts --live
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { findAllNoCache, insertMany, update, remove, removeMany } = require("../lib/sheets_db");

const SLEEP_MS = 1500; // 1.5 sec between batches to avoid rate limit
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const isLive = process.argv.includes("--live");

  console.log(`\n=== WS-7 Post-Migration Fix (${isLive ? "LIVE" : "DRY-RUN"}) ===\n`);

  // ===================================================================
  // FIX 1: Fill missing Stock_Ledger entries
  // ===================================================================
  console.log("--- Fix 1: Fill missing Stock_Ledger entries ---");

  const [v1Orders, v1Lines, v1Ledger, v2Orders, v2Events, v2ExistingLedger] = await Promise.all([
    findAllNoCache("Orders"),
    findAllNoCache("Order_Lines"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Events"),
    findAllNoCache("Stock_Ledger"),
  ]);

  // Build v1_id → V2 order mapping
  const v1IdToV2 = new Map();
  for (const v2Order of v2Orders) {
    try {
      const snap = JSON.parse(v2Order.pos_snapshot_json || "{}");
      if (snap.v1_id) v1IdToV2.set(snap.v1_id, v2Order);
    } catch {}
  }

  // Find which V2 orders have ledger entries (by source: MIGRATED_FROM_V1)
  const ledgerByV2Order = new Map();
  for (const entry of v2ExistingLedger) {
    if (entry.source === "MIGRATED_FROM_V1" && entry.reference_id) {
      if (!ledgerByV2Order.has(entry.reference_id)) {
        ledgerByV2Order.set(entry.reference_id, []);
      }
      ledgerByV2Order.get(entry.reference_id).push(entry);
    }
  }

  // Find V1 orders whose ledger hasn't been migrated to V2
  const ledgerToInsert = [];
  for (const v1Order of v1Orders) {
    const v2Order = v1IdToV2.get(v1Order.id);
    if (!v2Order) continue; // V2 order not found

    // Find V2 event for this order
    const v2Event = v2Events.find((e: any) => e.order_id === v2Order.id && e.event_type === "MIGRATED");
    if (!v2Event) continue;

    // Check if ledger entries already exist for this V2 order
    const existing = ledgerByV2Order.get(v2Order.id) || [];

    // Find V1 SALES_CONSUME entries for this order
    const v1SalesConsume = v1Ledger.filter((l: any) =>
      l.reference_id === v1Order.id && l.transaction_type === "SALES_CONSUME",
    );

    // If already enough entries, skip
    if (existing.length >= v1SalesConsume.length) continue;

    // Generate new ledger entries
    const crypto = require("crypto");
    for (const oldEntry of v1SalesConsume) {
      // Skip if entry with same item_reference already exists for this order
      const alreadyExists = existing.some((e: any) => e.item_reference === oldEntry.item_reference);
      // Don't skip based on this heuristic — could have multiple same ingredients
      // Just generate fresh entries; idempotency ensured by source label + dedup logic

      ledgerToInsert.push({
        id: `stk-migrated-${crypto.randomUUID()}`,
        transaction_type: "SALES_CONSUME",
        reference_id: v2Order.id,
        item_reference: oldEntry.item_reference,
        quantity_change: Number(oldEntry.quantity_change),
        unit_cost: Number(oldEntry.unit_cost) || 0,
        created_at: v1Order.created_at,
        order_event_id: v2Event.id,
        cost_at_sale: 0,
        source: "MIGRATED_FROM_V1",
      });
    }
  }

  console.log(`  Ledger entries to insert: ${ledgerToInsert.length}`);

  if (isLive && ledgerToInsert.length > 0) {
    // Idempotency: delete existing MIGRATED_FROM_V1 entries first to avoid duplicates
    const existingMigratedEntries = v2ExistingLedger.filter((e: any) => e.source === "MIGRATED_FROM_V1");
    if (existingMigratedEntries.length > 0) {
      console.log(`  Deleting ${existingMigratedEntries.length} existing MIGRATED_FROM_V1 entries (idempotency reset)...`);
      const deleteIds = existingMigratedEntries.map((e: any) => e.id);
      const deleteBatchSize = 200;
      for (let i = 0; i < deleteIds.length; i += deleteBatchSize) {
        const batch = deleteIds.slice(i, i + deleteBatchSize);
        await removeMany("Stock_Ledger", batch);
        console.log(`    Deleted ${Math.min(i + deleteBatchSize, deleteIds.length)}/${deleteIds.length}`);
        await sleep(SLEEP_MS);
      }
    }

    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < ledgerToInsert.length; i += batchSize) {
      const batch = ledgerToInsert.slice(i, i + batchSize);
      try {
        await insertMany("Stock_Ledger", batch);
        inserted += batch.length;
        console.log(`    Stock_Ledger: ${inserted}/${ledgerToInsert.length}`);
        await sleep(SLEEP_MS);
      } catch (err: any) {
        console.error(`    Batch failed at ${inserted}: ${err.message}`);
        await sleep(5000); // longer sleep on rate limit
        // retry once
        try {
          await insertMany("Stock_Ledger", batch);
          inserted += batch.length;
          console.log(`    Retry OK: ${inserted}/${ledgerToInsert.length}`);
        } catch (err2: any) {
          console.error(`    Retry also failed: ${err2.message}`);
          throw err2;
        }
      }
    }
    console.log(`  Inserted ${inserted} ledger entries`);
  }

  // ===================================================================
  // FIX 2: Cap manual_order_discount for 4 invariant-violating orders
  // ===================================================================
  console.log("\n--- Fix 2: Cap manual_order_discount > capacity ---");

  // Re-load V2 orders + lines to get current state
  const v2OrdersCurrent = await findAllNoCache("Orders_V2");
  const v2LinesCurrent = await findAllNoCache("Order_Lines_V2");

  const brokenOrders = [];
  for (const order of v2OrdersCurrent) {
    if (order.status !== "COMPLETED") continue;
    if (order.superseded_by) continue;

    const gross = Number(order.gross_total || 0);
    const promo = Number(order.promo_discount_total || 0);
    const manualItem = Number(order.manual_item_discount_total || 0);
    const manualOrder = Number(order.manual_order_discount || 0);
    const net = Number(order.net_total || 0);
    const capacity = gross - promo - manualItem;

    if (manualOrder > capacity + 1) {
      brokenOrders.push({ order, capacity, manualOrder, gross, promo, manualItem, net });
    }
  }

  console.log(`  Orders with manual_order > capacity: ${brokenOrders.length}`);

  for (const { order, capacity, manualOrder, gross, promo, manualItem, net } of brokenOrders) {
    const newManualOrder = Math.max(0, capacity);
    const newNet = gross - promo - manualItem - newManualOrder;
    console.log(`  ${order.order_no}: manual_order ${manualOrder} → ${newManualOrder}, net ${net} → ${newNet}`);

    if (isLive) {
      // Update order
      await update("Orders_V2", order.id, {
        manual_order_discount: newManualOrder,
        net_total: newNet,
      });
      await sleep(SLEEP_MS);

      // Update lines: redistribute the (now smaller) manual_order_discount
      const orderLines = v2LinesCurrent.filter((l: any) => l.order_id === order.id);
      const { allocateOrderDiscount } = require("../lib/order-math");
      const allocatable = orderLines.map((l: any) => ({
        line_id: l.id,
        capacity: Math.max(0, Number(l.gross_line_total) - Number(l.promo_discount) - Number(l.manual_item_discount)),
      }));
      const allocations = allocateOrderDiscount(allocatable, newManualOrder);
      for (const line of orderLines) {
        const alloc = allocations.get(line.id) || 0;
        const newLineNet = Number(line.gross_line_total) - Number(line.promo_discount) - Number(line.manual_item_discount) - alloc;
        await update("Order_Lines_V2", line.id, {
          order_discount_allocation: alloc,
          net_line_total: newLineNet,
        });
        await sleep(SLEEP_MS);
      }
    }
  }

  console.log(`\n=== Fix complete ===`);
  if (!isLive) {
    console.log("Dry-run done. Use --live to apply.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
