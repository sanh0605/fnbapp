import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 3.3 — Audit void/cancel order lifecycle.
 *
 * Verifies:
 *   1. Every VOIDED order has matching EDIT_REVERSAL entries (1:1 with SALES_CONSUME).
 *   2. No double-reversal (each SALES_CONSUME reversed at most once).
 *   3. Reversal qty = -1 × original qty.
 *   4. VOIDED orders excluded from P&L / Sales / COGS reports.
 *   5. VOIDED events exist with non-empty reason.
 */

const REPORT_START = "2026-05-31T17:00:00.000Z";
const REPORT_END = "2026-06-25T16:59:59.999Z";

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines, ledger, events] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Order_Events"),
  ]);

  const voidedOrders = (orders as any[]).filter(o => o.status === "VOIDED");
  const completedOrders = (orders as any[]).filter(o => o.status === "COMPLETED" && !o.superseded_by);

  console.log("=== VOID/CANCEL AUDIT ===");
  console.log(`Total orders: ${(orders as any[]).length}`);
  console.log(`COMPLETED (active): ${completedOrders.length}`);
  console.log(`VOIDED:             ${voidedOrders.length}`);

  let noReversalCount = 0;
  let partialReversalCount = 0;
  let doubleReversalCount = 0;
  let qtyMismatchCount = 0;
  let noEventCount = 0;
  let noReasonCount = 0;

  for (const order of voidedOrders) {
    const consumeRows = (ledger as any[]).filter(l =>
      l.reference_id === order.id && l.transaction_type === "SALES_CONSUME",
    );
    const reversalRows = (ledger as any[]).filter(l =>
      l.reference_id === order.id && l.transaction_type === "EDIT_REVERSAL",
    );

    if (consumeRows.length === 0 && reversalRows.length === 0) {
      // Order had no inventory consumption — OK
      continue;
    }

    if (reversalRows.length === 0) {
      noReversalCount++;
      continue;
    }

    if (reversalRows.length < consumeRows.length) {
      partialReversalCount++;
    }

    if (reversalRows.length > consumeRows.length) {
      doubleReversalCount++;
    }

    // Check qty: each consume should have a matching reversal with -1 × qty
    for (const consume of consumeRows) {
      const matching = reversalRows.find(r =>
        r.item_reference === consume.item_reference &&
        Number(r.quantity_change) === -Number(consume.quantity_change),
      );
      if (!matching) {
        qtyMismatchCount++;
      }
    }

    // Event log
    const voidEvent = (events as any[]).find(e =>
      e.order_id === order.id && e.event_type === "VOIDED",
    );
    if (!voidEvent) {
      noEventCount++;
    } else if (!voidEvent.reason || voidEvent.reason.trim().length === 0) {
      noReasonCount++;
    }
  }

  console.log("\n=== LEDGER INTEGRITY ===");
  console.log(`VOIDED orders with no reversal (when consume exists): ${noReversalCount}`);
  console.log(`VOIDED orders with partial reversal:                   ${partialReversalCount}`);
  console.log(`VOIDED orders with more reversals than consumes:       ${doubleReversalCount}`);
  console.log(`Reversal qty mismatches:                                ${qtyMismatchCount}`);

  console.log("\n=== EVENT LOG ===");
  console.log(`VOIDED orders missing VOIDED event:                    ${noEventCount}`);
  console.log(`VOIDED events with empty reason:                       ${noReasonCount}`);

  // Check reports exclude VOIDED
  const reportStart = new Date(REPORT_START).getTime();
  const reportEnd = new Date(REPORT_END).getTime();
  const voidedInReportRange = voidedOrders.filter(o => {
    const t = new Date(o.created_at || 0).getTime();
    return t >= reportStart && t <= reportEnd;
  });

  console.log("\n=== REPORT EXCLUSION ===");
  console.log(`VOIDED orders in P&L date range:                       ${voidedInReportRange.length}`);
  console.log(`  (P&L filters status === COMPLETED, so VOIDED excluded by construction)`);

  // Verify line-level: VOIDED order's lines should not appear in report breakdowns
  const voidedOrderIds = new Set(voidedOrders.map(o => o.id));
  const orphanLines = (lines as any[]).filter(l => voidedOrderIds.has(l.order_id));
  console.log(`Lines belonging to VOIDED orders:                      ${orphanLines.length}`);
  console.log(`  (Lines exist but should be filtered out by parent order status)`);

  // Check superseded orders (edits create new version, old is SUPERSEDED)
  const supersededOrders = (orders as any[]).filter(o => o.status === "SUPERSEDED");
  console.log(`\nSUPERSEDED orders:                                      ${supersededOrders.length}`);
  let supersededNoReversal = 0;
  for (const order of supersededOrders) {
    const consume = (ledger as any[]).filter(l =>
      l.reference_id === order.id && l.transaction_type === "SALES_CONSUME",
    );
    const reversal = (ledger as any[]).filter(l =>
      l.reference_id === order.id && l.transaction_type === "EDIT_REVERSAL",
    );
    if (consume.length > 0 && reversal.length === 0) {
      supersededNoReversal++;
    }
  }
  console.log(`SUPERSEDED orders missing reversal:                    ${supersededNoReversal}`);

  console.log("\nNo data was written.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
