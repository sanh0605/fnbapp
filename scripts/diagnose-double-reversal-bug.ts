import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * URGENT diagnostic (2026-07-20): the just-applied 102-order correction has
 * a bug for any order where two or more lines share the same
 * item_reference+source key (the same aggregation scenario fixed earlier in
 * lib/order-ledger-audit.ts and the investigate script). The apply script's
 * per-row loop looked up the ORDER-LEVEL aggregate recordedQty for each
 * individual row instead of that row's own per-line portion, so it wrote a
 * separate RECLASSIFICATION_REVERSAL using the FULL aggregate for EACH of
 * the N lines sharing that key -- an N-fold over-reversal, while
 * PRODUCTION_CONSUME (which uses row.quantity directly, per-line) was
 * written correctly.
 *
 * This script finds every order corrected in the RECLASSIFY_2026-07-20 run
 * whose RECLASSIFICATION_REVERSAL total for some item+source key does NOT
 * equal the recorded (original SALES_CONSUME) quantity for that key --
 * meaning it was over- or under-reversed -- and reports the exact excess so
 * a corrective entry can be computed. Read-only, writes nothing.
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [orders, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Stock_Ledger"),
  ]) as any[][];

  const correctedOrderIds = new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("RECLASSIFY_2026-07-20"))
      .map(r => r.reference_id),
  );

  console.log(`Orders touched by RECLASSIFY_2026-07-20: ${correctedOrderIds.size}`);

  let affectedOrders = 0;
  let totalExcessEntries = 0;
  const details: Array<{ orderNo: string; orderId: string; item: string; source: string; originalRecorded: number; totalReversed: number; excess: number }> = [];

  for (const orderId of correctedOrderIds) {
    const order = (orders as any[]).find(o => o.id === orderId);
    const orderRows = (ledger as any[]).filter(r => r.reference_id === orderId);

    // Original recorded SALES_CONSUME quantity per item+source (rows NOT
    // tagged with RECLASSIFY_2026-07-20, i.e. the pre-existing rows).
    const recordedByKey = new Map<string, number>();
    for (const r of orderRows) {
      if (r.transaction_type !== "SALES_CONSUME") continue;
      if ((r.source || "").includes("RECLASSIFY_2026-07-20")) continue;
      if (!(r.source || "").includes("BTP_SHORTFALL")) continue;
      const key = `${r.item_reference} ${r.source}`;
      recordedByKey.set(key, (recordedByKey.get(key) || 0) + Math.abs(Number(r.quantity_change)));
    }

    // Total RECLASSIFICATION_REVERSAL written per item+source-without-tag
    // (strip the :RECLASSIFY_2026-07-20 suffix to match the original key).
    const reversedByKey = new Map<string, number>();
    for (const r of orderRows) {
      if (r.transaction_type !== "RECLASSIFICATION_REVERSAL") continue;
      const originalSource = (r.source || "").replace(":RECLASSIFY_2026-07-20", "");
      const key = `${r.item_reference} ${originalSource}`;
      reversedByKey.set(key, (reversedByKey.get(key) || 0) + Math.abs(Number(r.quantity_change)));
    }

    let orderAffected = false;
    for (const [key, recorded] of recordedByKey) {
      const reversed = reversedByKey.get(key) || 0;
      const excess = reversed - recorded;
      if (Math.abs(excess) > 0.01) {
        orderAffected = true;
        totalExcessEntries++;
        const [item, ...sourceParts] = key.split(" ");
        details.push({
          orderNo: order?.order_no || orderId,
          orderId,
          item,
          source: sourceParts.join(" "),
          originalRecorded: recorded,
          totalReversed: reversed,
          excess,
        });
      }
    }
    if (orderAffected) affectedOrders++;
  }

  console.log(`Orders with an over/under-reversal: ${affectedOrders}`);
  console.log(`Total item+source keys affected: ${totalExcessEntries}`);
  console.log(`\nDetails:`);
  for (const d of details) {
    console.log(`  ${d.orderNo} item=${d.item} source=${d.source}: recorded=${d.originalRecorded} reversed=${d.totalReversed} excess=${d.excess}`);
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
