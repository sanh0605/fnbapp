import * as dotenv from "dotenv";
import crypto from "node:crypto";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Fixes a third bug found in Round 3
 * (scripts/apply-btp-shortfall-historical-correction-round3.ts): when an
 * order has 2+ lines where the SAME raw ingredient is consumed both
 * directly (a legitimate BASE_INGREDIENT need on one line, unrelated to any
 * semi-product) and via an old-bug semi-product substitution on another
 * line, Round 3's item-level (source-agnostic) matching reversed ALL
 * recorded consumption for that item on the order, but only re-inserted
 * the semi-product-attributable (shortfall) portion as PRODUCTION_CONSUME
 * -- silently deleting the legitimate direct consumption.
 *
 * Found via immediate re-verification: order-ledger audit showed 2 new
 * mismatches after Round 3 (209 -> 211), both Sữa đặc/ING-003, both
 * understated by exactly the deleted direct amount (UCK000300: 35 recorded
 * -> should be 35, got left at 15, missing 20; UCK000304: 55 -> should be
 * 55, got left at 15, missing 40).
 *
 * Confirmed via direct recompute (buildLineConsumptionRows' saleRows,
 * i.e. the non-shortfall consumption for the OTHER line on each order) that
 * the missing amounts are exactly the legitimate direct consumption that
 * was wrongly reversed. Restores it with a compensating SALES_CONSUME.
 */

const FIXES = [
  { orderNo: "UCK000300", item: "ING-003", missingQty: 20 },
  { orderNo: "UCK000304", item: "ING-003", missingQty: 40 },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const orders = await findAllNoCache("Orders_V2") as any[];
  const orderByNo = new Map(orders.map(o => [o.order_no, o]));

  const entries = FIXES.map(fix => {
    const order = orderByNo.get(fix.orderNo);
    if (!order) throw new Error(`${fix.orderNo}: order not found`);
    return {
      id: `stk-${crypto.randomUUID()}`,
      item_reference: fix.item,
      transaction_type: "SALES_CONSUME",
      quantity_change: -fix.missingQty,
      unit_cost: 0,
      reference_id: order.id,
      source: "VARIANT_RECIPE:FIX_ROUND3_DIRECT_LOSS_2026-07-21",
      notes: "Restores legitimate direct BASE_INGREDIENT consumption wrongly reversed by Round 3's item-level (source-agnostic) matching, which conflated it with an unrelated line's shortfall reclassification for the same item",
      created_at: new Date().toISOString(),
    };
  });

  console.log(`Mode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  for (const e of entries) {
    console.log(`  ${e.reference_id} item=${e.item_reference} qty=${e.quantity_change}`);
  }

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these entries.");
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("stock_ledger").insert(entries);
  if (error) throw new Error(error.message);

  console.log(`\nDone. Inserted ${entries.length} compensating entries.`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
