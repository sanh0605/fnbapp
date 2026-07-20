import * as dotenv from "dotenv";
import crypto from "node:crypto";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * URGENT bugfix (2026-07-20, same day as the bug it fixes). The
 * apply-btp-shortfall-historical-correction.ts run that just completed
 * (102 orders, 1126 entries) had a bug: for any order where 2+ lines shared
 * the same item_reference+source key (the multi-line aggregation scenario),
 * the script looked up the ORDER-LEVEL aggregate recorded quantity for EACH
 * line's row instead of that row's own per-line portion, writing a
 * RECLASSIFICATION_REVERSAL using the full aggregate once per line sharing
 * the key -- an N-fold over-reversal (confirmed as exactly 2x in every
 * affected case via scripts/diagnose-double-reversal-bug.ts: 20 orders,
 * 54 item+source keys, each reversed = 2x recorded exactly).
 *
 * This inserts ONE corrective entry per affected key: a NEGATIVE
 * RECLASSIFICATION_REVERSAL of exactly the excess amount, which exactly
 * cancels the over-reversal (buildInventoryBalances sums quantity_change
 * regardless of transaction_type, so this nets correctly). Insert-only,
 * same Method-1 principle: never overwrite or delete an existing row.
 *
 * Idempotent: an item+source key already carrying a
 * "BUGFIX_DOUBLE_REVERSAL_2026-07-20" tag is skipped.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, insertMany } = await import("../lib/sheets_db");

  const [orders, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Stock_Ledger"),
  ]) as any[][];

  const correctedOrderIds = new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("RECLASSIFY_2026-07-20"))
      .map(r => r.reference_id),
  );

  const alreadyBugfixed = new Set(
    (ledger as any[])
      .filter(r => (r.source || "").includes("BUGFIX_DOUBLE_REVERSAL_2026-07-20"))
      .map(r => `${r.reference_id}|${(r.source || "").split(":BUGFIX_DOUBLE_REVERSAL_2026-07-20")[0]}|${r.item_reference}`),
  );

  const newEntries: any[] = [];
  let affectedKeys = 0;
  const details: string[] = [];

  for (const orderId of correctedOrderIds) {
    const order = (orders as any[]).find(o => o.id === orderId);
    const orderRows = (ledger as any[]).filter(r => r.reference_id === orderId);

    const recordedByKey = new Map<string, number>();
    for (const r of orderRows) {
      if (r.transaction_type !== "SALES_CONSUME") continue;
      if ((r.source || "").includes("RECLASSIFY_2026-07-20")) continue;
      if (!(r.source || "").includes("BTP_SHORTFALL")) continue;
      const key = `${r.item_reference} ${r.source}`;
      recordedByKey.set(key, (recordedByKey.get(key) || 0) + Math.abs(Number(r.quantity_change)));
    }

    const reversedByKey = new Map<string, number>();
    const reversalSourceByKey = new Map<string, string>();
    for (const r of orderRows) {
      if (r.transaction_type !== "RECLASSIFICATION_REVERSAL") continue;
      if ((r.source || "").includes("BUGFIX_DOUBLE_REVERSAL_2026-07-20")) continue;
      const originalSource = (r.source || "").replace(":RECLASSIFY_2026-07-20", "");
      const key = `${r.item_reference} ${originalSource}`;
      reversedByKey.set(key, (reversedByKey.get(key) || 0) + Math.abs(Number(r.quantity_change)));
      reversalSourceByKey.set(key, r.source);
    }

    for (const [key, recorded] of recordedByKey) {
      const reversed = reversedByKey.get(key) || 0;
      const excess = reversed - recorded;
      if (Math.abs(excess) <= 0.01) continue;

      const idempotencyKey = `${orderId}|${key.split(" ")[1]}|${key.split(" ")[0]}`;
      if (alreadyBugfixed.has(idempotencyKey)) continue;

      affectedKeys++;
      const [item] = key.split(" ");
      const originalSource = key.slice(item.length + 1);
      details.push(`${order?.order_no || orderId} item=${item} source=${originalSource}: excess=${excess}`);

      newEntries.push({
        id: `stk-${crypto.randomUUID()}`,
        item_reference: item,
        transaction_type: "RECLASSIFICATION_REVERSAL",
        quantity_change: -excess,
        unit_cost: 0,
        reference_id: orderId,
        source: `${originalSource}:RECLASSIFY_2026-07-20:BUGFIX_DOUBLE_REVERSAL_2026-07-20`,
        notes: "Corrects an over-reversal from the 2026-07-20 historical correction script bug (order had 2+ lines sharing one item+source key; the aggregate recorded quantity was used once per line instead of split per line)",
        created_at: new Date().toISOString(),
      });
    }
  }

  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Affected item+source keys needing a corrective entry: ${affectedKeys}`);
  console.log(`\nDetails:`);
  for (const d of details) console.log(`  ${d}`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these entries.");
    return;
  }

  if (newEntries.length > 0) {
    await insertMany("Stock_Ledger", newEntries);
  }
  console.log(`\nDone. Inserted ${newEntries.length} corrective entries.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
