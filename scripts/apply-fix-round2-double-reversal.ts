import * as dotenv from "dotenv";
import crypto from "node:crypto";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Fixes a double-reversal bug in the just-applied Round 2 correction
 * (scripts/apply-btp-shortfall-historical-correction-round2.ts), the exact
 * same class of bug already found and fixed earlier this session for the
 * original 2026-07-20 correction (scripts/apply-fix-double-reversal-bug.ts):
 * when 2+ order lines share the same item+source key (e.g. two lines both
 * needing the same semi-product via the same recipe path), the insert loop
 * pushed a FULL order-level-aggregate RECLASSIFICATION_REVERSAL once per
 * matching line-row instead of once per distinct key -- over-reversing by
 * (N-1) x aggregate for a key shared by N lines. The PRODUCTION_CONSUME
 * rows were NOT affected (they correctly used each row's own per-line
 * quantity, not the aggregate).
 *
 * For each of the 23 orders Round 2 touched, recomputes what the reversal
 * SHOULD have been (aggregate, inserted exactly once per key) versus what
 * was actually inserted (found via today's RECLASSIFY_2026-07-20-tagged
 * RECLASSIFICATION_REVERSAL rows), and inserts a compensating negative-
 * quantity RECLASSIFICATION_REVERSAL for the exact excess -- insert-only,
 * same pattern as the original fix.
 */

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const ledger = await findAllNoCache("Stock_Ledger") as any[];

  // Round 2's reversal rows: RECLASSIFICATION_REVERSAL, tagged
  // RECLASSIFY_2026-07-20, inserted today (2026-07-21) -- distinct from
  // Round 1's 2026-07-20 rows sharing the same tag.
  const round2Reversals = ledger.filter(r =>
    r.transaction_type === "RECLASSIFICATION_REVERSAL" &&
    (r.source || "").includes("RECLASSIFY_2026-07-20") &&
    String(r.created_at || "").startsWith("2026-07-21"),
  );

  // Group by (reference_id, item_reference, source) -- the exact key the
  // buggy loop collided on.
  const byKey = new Map<string, any[]>();
  for (const row of round2Reversals) {
    const key = `${row.reference_id}||${row.item_reference}||${row.source}`;
    const arr = byKey.get(key) || [];
    arr.push(row);
    byKey.set(key, arr);
  }

  const compensatingEntries: any[] = [];
  let affectedKeys = 0;
  let totalExcess = 0;

  for (const [key, rows] of byKey) {
    if (rows.length <= 1) continue; // no collision, nothing to fix
    affectedKeys++;
    const perRowQty = Number(rows[0].quantity_change);
    const excess = perRowQty * (rows.length - 1);
    totalExcess += excess;
    const [orderId, itemReference, source] = key.split("||");
    console.log(`  order=${orderId} item=${itemReference} source=${source}: ${rows.length} colliding rows, per-row=${perRowQty}, excess=${excess}`);

    compensatingEntries.push({
      id: `stk-${crypto.randomUUID()}`,
      item_reference: itemReference,
      transaction_type: "RECLASSIFICATION_REVERSAL",
      quantity_change: -excess,
      unit_cost: 0,
      reference_id: orderId,
      source: `${source}:FIX_DOUBLE_REVERSAL_2026-07-21`,
      notes: "Compensates a double-reversal bug in Round 2 (multiple lines sharing the same item+source key each got a full aggregate reversal instead of one reversal per key)",
      created_at: new Date().toISOString(),
    });
  }

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Distinct (order,item,source) keys with a collision: ${affectedKeys}`);
  console.log(`Total excess reversal to compensate: ${totalExcess}`);
  console.log(`Compensating entries to insert: ${compensatingEntries.length}`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these entries.");
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("stock_ledger").insert(compensatingEntries);
  if (error) throw new Error(error.message);

  console.log(`\nDone. Inserted ${compensatingEntries.length} compensating entries.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
