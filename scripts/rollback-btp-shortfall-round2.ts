import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Emergency rollback (2026-07-21) for
 * scripts/apply-btp-shortfall-historical-correction-round2.ts.
 *
 * Round 2 assumed every order with a recomputed "implicit yield" was using
 * the old bug pattern (raw ingredient directly debited via SALES_CONSUME,
 * semi-product itself never touched) -- the same pattern verified for the
 * egg (Trứng gà) case and Round 1's 479 orders. But some orders (e.g.
 * PHD000194) already had the semi-product itself (Cốt cà phê / BTP-001)
 * correctly recorded as the consumed item (from an earlier, unrelated
 * correction pass), with the raw ingredients already accounted for
 * elsewhere. Round 2 blindly inserted a FRESH PRODUCTION_CONSUME debit of
 * the raw ingredients for these orders too, double-counting consumption
 * that was never actually missing. This made the order-ledger audit's
 * mismatch count go UP (209 -> 2853), not down.
 *
 * This deletes exactly the rows Round 2 inserted (identified by the
 * RECLASSIFY_2026-07-20 source tag AND created_at falling on 2026-07-21,
 * the day Round 2 ran -- Round 1 ran and inserted its rows the day before,
 * 2026-07-20, using the same tag but a different created_at date, and must
 * NOT be touched). Prints a date breakdown first so the boundary can be
 * visually confirmed before any delete happens; only deletes with --apply.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, removeMany } = await import("../lib/sheets_db");

  const ledger = await findAllNoCache("Stock_Ledger") as any[];
  const tagged = ledger.filter(r => (r.source || "").includes("RECLASSIFY_2026-07-20"));

  const byDate = new Map<string, number>();
  for (const row of tagged) {
    const date = String(row.created_at || "").slice(0, 10);
    byDate.set(date, (byDate.get(date) || 0) + 1);
  }
  console.log(`Total RECLASSIFY_2026-07-20-tagged rows: ${tagged.length}`);
  console.log(`By date:`);
  for (const [date, count] of [...byDate.entries()].sort()) {
    console.log(`  ${date}: ${count}`);
  }

  const toDelete = tagged.filter(r => String(r.created_at || "").startsWith("2026-07-21"));
  const toKeep = tagged.filter(r => !String(r.created_at || "").startsWith("2026-07-21"));

  console.log(`\nRows to delete (Round 2, 2026-07-21): ${toDelete.length}`);
  console.log(`Rows to KEEP (Round 1, 2026-07-20): ${toKeep.length}`);

  const distinctOrdersToDelete = new Set(toDelete.map(r => r.reference_id));
  console.log(`Distinct orders affected by rollback: ${distinctOrdersToDelete.size}`);

  if (!apply) {
    console.log("\nDry run only -- no data deleted. Re-run with --apply to delete these rows.");
    return;
  }

  const ids = toDelete.map(r => r.id);
  const BATCH_SIZE = 500;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    await removeMany("Stock_Ledger", batch);
    deleted += batch.length;
    console.log(`  Deleted ${deleted}/${ids.length}...`);
  }

  console.log(`\nDone. Deleted ${deleted} rows.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
