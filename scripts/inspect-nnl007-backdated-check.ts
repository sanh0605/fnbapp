import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only check: does the recorded cost_at_sale vs recompute discrepancy
 * for PHD000959's NNL-007 line trace to a backdated_ledger_events entry
 * (same hindsight-bias phenomenon already diagnosed earlier this session for
 * the original "301 known replay mismatches")? If a PO_RECEIPT for NNL-007
 * has an effective_timestamp before this order's created_at but a
 * visibility_timestamp (real insertion time) after it, the live sale-time
 * cost computation could not have seen it, while any recompute using a
 * simple created_at cutoff would incorrectly include it.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, ledger, backdated] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("backdated_ledger_events").catch(() => []),
  ]) as any[][];

  const order = (orders as any[]).find(o => o.order_no === "PHD000959");
  if (!order) {
    console.error("Order not found");
    process.exit(1);
  }
  console.log(`Order PHD000959 created_at=${order.created_at}`);

  const nnl007Rows = (ledger as any[])
    .filter(r => r.item_reference === "NNL-007")
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  console.log(`\nAll NNL-007 ledger rows (created_at order):`);
  for (const r of nnl007Rows) {
    console.log([r.id, r.created_at, r.transaction_type, `qty=${r.quantity_change}`, `unit_cost=${r.unit_cost}`].join(" | "));
  }

  console.log(`\nbackdated_ledger_events rows referencing any NNL-007 ledger row id:`);
  const nnl007Ids = new Set(nnl007Rows.map(r => r.id));
  const matches = (backdated as any[]).filter(b => nnl007Ids.has(b.stock_ledger_id) || nnl007Ids.has(b.ledger_id) || nnl007Ids.has(b.id));
  if (matches.length === 0) {
    console.log("  (none found by direct id match -- dumping all backdated events near the order date for manual inspection)");
    console.log(`  Total backdated_ledger_events rows in table: ${(backdated as any[]).length}`);
    const nearby = (backdated as any[]).filter(b => {
      const t = new Date(b.effective_timestamp || b.visibility_timestamp || 0).getTime();
      return Math.abs(t - new Date(order.created_at).getTime()) < 1000 * 60 * 60 * 24 * 60;
    });
    for (const b of nearby.slice(0, 20)) {
      console.log(`    ${JSON.stringify(b)}`);
    }
  } else {
    for (const b of matches) {
      console.log(`  ${JSON.stringify(b)}`);
    }
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
