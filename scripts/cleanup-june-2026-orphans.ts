/**
 * Cleanup orphan orders from June 2026 import.
 *
 * During apply on 2026-06-26, 2 orders got their Orders_V2 row inserted
 * but the follow-up lines/events/ledger inserts hit Google Sheets quota.
 * Cleanup-on-fail in insertOrderV2Records also failed (quota), so the
 * orphan header rows remained. The retry detected them via migration_notes
 * and skipped, leaving them incomplete.
 *
 * This script deletes the 2 orphans by order_no so re-running apply
 * picks them up cleanly.
 *
 * Usage: vite-node scripts/cleanup-june-2026-orphans.ts --apply
 */

process.env.CLI_MODE = "true";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const ORPHAN_ORDER_NOS = ["PHD000704", "PHD000724"];

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`=== Cleanup June 2026 Orphans ===`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Targets: ${ORPHAN_ORDER_NOS.join(", ")}`);

  const { findAllNoCache, remove } = await import("../lib/sheets_db");
  const orders = (await findAllNoCache("Orders_V2")) as any[];
  const targets = orders.filter((o) => ORPHAN_ORDER_NOS.includes(String(o.order_no)));

  if (targets.length === 0) {
    console.log("No orphan orders found. Nothing to do.");
    return;
  }

  for (const t of targets) {
    console.log(
      `  ${t.order_no} id=${t.id} migration_notes=${t.migration_notes} gross=${t.gross_total}`,
    );
    if (apply) {
      await remove("Orders_V2", String(t.id));
      console.log(`    DELETED`);
    }
  }

  if (!apply) {
    console.log();
    console.log(`DRY-RUN. Re-run with --apply to actually delete.`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
