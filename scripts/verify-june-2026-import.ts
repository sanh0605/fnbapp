/**
 * Verify June 2026 import integrity.
 *
 * For each Orders_V2 row with migration_notes starting "june-2026-import::",
 * check that the corresponding Order_Lines_V2, Order_Events, and Stock_Ledger
 * rows are all present and complete.
 *
 * Usage: vite-node scripts/verify-june-2026-import.ts
 */

if (typeof window === "undefined") {
  process.env.TZ = "Asia/Ho_Chi_Minh";
}
process.env.CLI_MODE = "true";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const IDEMPOTENCY_PREFIX = "june-2026-import::";

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines, events, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Order_Events"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const importedOrders = (orders as any[]).filter(
    (o) => typeof o.migration_notes === "string" && o.migration_notes.startsWith(IDEMPOTENCY_PREFIX),
  );
  console.log(`=== June 2026 Import Verification ===`);
  console.log(`Orders with tag: ${importedOrders.length}`);
  console.log(`Expected:        77`);
  console.log();

  if (importedOrders.length !== 77) {
    console.log(`WARN: Expected 77 imported orders, got ${importedOrders.length}.`);
  }

  // Build lookup maps
  const linesByOrder = new Map<string, any[]>();
  for (const l of lines as any[]) {
    const arr = linesByOrder.get(l.order_id) || [];
    arr.push(l);
    linesByOrder.set(l.order_id, arr);
  }

  const eventsByOrder = new Map<string, any[]>();
  for (const e of events as any[]) {
    const arr = eventsByOrder.get(e.order_id) || [];
    arr.push(e);
    eventsByOrder.set(e.order_id, arr);
  }

  const ledgerByOrder = new Map<string, any[]>();
  for (const r of ledger as any[]) {
    if (r.transaction_type !== "SALES_CONSUME") continue;
    const arr = ledgerByOrder.get(r.reference_id) || [];
    arr.push(r);
    ledgerByOrder.set(r.reference_id, arr);
  }

  let ok = 0;
  const issues: string[] = [];
  let totalLines = 0;
  let totalEvents = 0;
  let totalLedger = 0;
  let totalGross = 0;
  let totalNet = 0;
  let totalCogs = 0;

  for (const o of importedOrders) {
    const orderId = String(o.id);
    const orderLines = linesByOrder.get(orderId) || [];
    const orderEvents = eventsByOrder.get(orderId) || [];
    const orderLedger = ledgerByOrder.get(orderId) || [];
    const createdEvent = orderEvents.find((e) => e.event_type === "CREATED");

    const orderIssues: string[] = [];
    if (orderLines.length === 0) orderIssues.push(`missing lines`);
    if (!createdEvent) orderIssues.push(`missing CREATED event`);
    // Ledger entries only required for orders containing VAR-037 (which has recipe)
    const hasVar037 = orderLines.some(
      (l) => String(l.variant_id) === "VAR-037",
    );
    if (hasVar037 && orderLedger.length === 0) {
      orderIssues.push(`missing SALES_CONSUME ledger entries (VAR-037 present)`);
    }

    if (orderIssues.length === 0) {
      ok++;
    } else {
      issues.push(
        `${o.order_no} (don tag=${o.migration_notes}): ${orderIssues.join(", ")}`,
      );
    }

    totalLines += orderLines.length;
    totalEvents += orderEvents.length;
    totalLedger += orderLedger.length;
    totalGross += Number(o.gross_total) || 0;
    totalNet += Number(o.net_total) || 0;
    for (const l of orderLines) totalCogs += Number(l.cost_at_sale) || 0;
  }

  console.log(`=== Totals ===`);
  console.log(`Total gross:    ${totalGross.toLocaleString()} VND (expected 1.045.000)`);
  console.log(`Total net:      ${totalNet.toLocaleString()} VND (expected 1.045.000)`);
  console.log(`Total COGS:     ${totalCogs.toLocaleString()} VND (expected 268.875)`);
  console.log(`Total lines:    ${totalLines} (expected 110)`);
  console.log(`Total events:   ${totalEvents} (expected >= 77 CREATED)`);
  console.log(`Total ledger:   ${totalLedger} (expected 61 SALES_CONSUME)`);
  console.log();

  console.log(`=== Integrity ===`);
  console.log(`Orders complete: ${ok}/${importedOrders.length}`);
  if (issues.length > 0) {
    console.log(`Issues found (${issues.length}):`);
    for (const s of issues) console.log(`  - ${s}`);
  } else {
    console.log(`All orders have complete lines + events + ledger entries.`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
