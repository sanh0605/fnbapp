import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * docs/superpowers/plans/2026-08-24-outlets-and-order-code.md, objective 1
 * (section 4) plus the spec's own backfill (outlet_id).
 *
 * One pass, two columns, both derived from facts that never change once an
 * order exists (created_at, brand_id): sets orders_v2.outlet_id on every
 * row, and renames every group of rows sharing an order_no to the new
 * per-outlet-per-day code, writing legacy_order_no alongside it.
 *
 * Grouped by order_no, not by row: a multi-version order (edit, void) is
 * several physical rows sharing one code today, and the rename must move
 * all of them together or the code stops meaning "one order" (verified
 * against PHD000632's real 3-row chain, section 2 of the plan).
 *
 * Idempotent by construction (lib/order-code.ts's planOrderCodeRename):
 * the plan is derived fresh from created_at/brand_id every run, a group
 * whose current order_no already matches the new 12-digit format comes
 * back changed:false, and this script writes nothing for it. A second
 * --apply run is expected to report 0 rows written.
 *
 * Requires migration 0071 (outlets table + orders_v2's two new nullable
 * columns) to already exist. Dry-run by default. --apply required to write.
 */

import { planOrderCodeRename, type RawOrderRow, type OutletForBrand } from "../lib/order-code";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { findAllNoCache, update } = await import("../lib/sheets_db");

  const [orders, outlets] = await Promise.all([
    findAllNoCache("orders_v2"),
    findAllNoCache("outlets"),
  ]);

  console.log(`Total orders_v2 rows: ${orders.length}`);

  const rawOrders: RawOrderRow[] = (orders as any[]).map(o => ({
    id: o.id,
    order_no: o.order_no,
    brand_id: o.brand_id,
    created_at: o.created_at,
  }));
  const outletForBrand: OutletForBrand[] = (outlets as any[])
    .filter(o => o.status === "ACTIVE")
    .map(o => ({ outlet_id: o.id, outlet_code: o.code, brand_id: o.brand_id }));

  console.log(`Active outlets: ${outletForBrand.length}`);

  const plans = planOrderCodeRename(rawOrders, outletForBrand);
  const changedPlans = plans.filter(p => p.changed);
  const totalRowsAffected = changedPlans.reduce((sum, p) => sum + p.row_ids.length, 0);
  const distinctNewCodes = new Set(changedPlans.map(p => p.new_order_no)).size;
  const multiRowChains = changedPlans.filter(p => p.row_ids.length > 1);

  console.log(`\nOrder groups total       : ${plans.length}`);
  console.log(`Groups to rename         : ${changedPlans.length}`);
  console.log(`Rows to update           : ${totalRowsAffected}`);
  console.log(`Distinct new codes       : ${distinctNewCodes}`);
  console.log(`Multi-row chains renamed : ${multiRowChains.length}`);

  // Section 4's own check: new codes unique across the groups being
  // renamed (the partial unique index enforces this in the database too,
  // once migration 0072 swaps it -- checked here as well so a bug in this
  // script surfaces before it ever reaches the database).
  if (distinctNewCodes !== changedPlans.length) {
    console.error("ABORT: two different groups computed the same new order_no. Investigate before continuing.");
    process.exit(1);
  }

  console.log("\nFirst 10 before/after pairs:");
  changedPlans.slice(0, 10).forEach(p =>
    console.log(`  ${p.old_order_no} -> ${p.new_order_no} (outlet ${p.outlet_id}, ${p.row_ids.length} row(s))`),
  );

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write.");
    return;
  }

  let rowsWritten = 0;
  for (const plan of changedPlans) {
    for (const rowId of plan.row_ids) {
      await update("orders_v2", rowId, {
        outlet_id: plan.outlet_id,
        order_no: plan.new_order_no,
        legacy_order_no: plan.old_order_no,
      });
      rowsWritten += 1;
    }
  }
  console.log(`\nUpdated ${rowsWritten} rows.`);

  const after = (await findAllNoCache("orders_v2")) as any[];
  const stillLegacy = after.filter(o => !/^\d{12}$/.test(o.order_no)).length;
  const missingOutlet = after.filter(o => !o.outlet_id).length;
  console.log(`Rows still in legacy order_no format after apply: ${stillLegacy}`);
  console.log(`Rows still missing outlet_id after apply         : ${missingOutlet}`);
  if (stillLegacy !== 0 || missingOutlet !== 0) {
    console.error("ABORT: rows remain unfinished. Investigate before continuing.");
    process.exit(1);
  }

  // Every multi-row chain still shares exactly one code -- asserted per
  // chain, not in aggregate (section 4's own requirement).
  const byNewCode = new Map<string, Set<string>>();
  for (const o of after) {
    const legacy = o.legacy_order_no;
    if (!legacy) continue;
    const set = byNewCode.get(legacy) ?? new Set<string>();
    set.add(o.order_no);
    byNewCode.set(legacy, set);
  }
  let chainMismatches = 0;
  for (const [legacy, codes] of byNewCode) {
    if (codes.size > 1) {
      console.error(`ABORT: legacy code ${legacy} maps to ${codes.size} different new codes: ${[...codes].join(", ")}`);
      chainMismatches += 1;
    }
  }
  if (chainMismatches > 0) process.exit(1);
  console.log(`Every renamed chain confirmed to share exactly one code (checked ${byNewCode.size} legacy codes).`);
}

main().catch(error => {
  console.error("FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
