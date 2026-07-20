import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only inspection of every stock_ledger row for a single order, to
 * confirm the hypothesis that the 2026-07-20 historical correction
 * double-reversed the original consumption for orders that were already
 * SUPERSEDED/VOIDED before the correction ran (the original EDIT_REVERSAL
 * already reversed the mis-classified row; the correction's own
 * RECLASSIFICATION_REVERSAL reversed it a second time).
 */

async function main() {
  const orderNo = process.argv[2];
  if (!orderNo) {
    console.error("Usage: npx tsx scripts/inspect-one-corrected-voided-order.ts <order_no>");
    process.exit(1);
  }

  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Stock_Ledger"),
  ]) as any[][];

  const order = (orders as any[]).find(o => o.order_no === orderNo);
  if (!order) {
    console.error(`Order ${orderNo} not found`);
    process.exit(1);
  }

  console.log(`Order ${orderNo}: id=${order.id} status=${order.status} created_at=${order.created_at}`);

  const rows = (ledger as any[])
    .filter(r => r.reference_id === order.id)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  for (const r of rows) {
    console.log([
      r.created_at,
      r.transaction_type,
      r.item_reference,
      `qty=${r.quantity_change}`,
      `source=${r.source}`,
    ].join(" | "));
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
