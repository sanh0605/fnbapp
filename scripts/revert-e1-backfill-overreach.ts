/**
 * Revert backfill-e1-edit-bug.ts overreach:
 * - 8 parked orders (PHD000467, 468, 476, 479, 490, 497, 503, 504): total back to 0
 * - UCK000094: total back to 156,000 (suspicious increase, needs separate investigation)
 *
 * Keep the 4 E.1 victim fixes (UCK000100, UCK000161, PHD000522, PHD000530).
 *
 * Usage:
 *   Dry-run: npx tsx -e "require('dotenv').config({path:'.env.local'}); require('./scripts/revert-e1-backfill-overreach.ts');"
 *   Live:    add --live flag
 */
import { findAllNoCache, update } from "../lib/sheets_db";

const REVERTS: Record<string, number> = {
  "PHD000467": 0,
  "PHD000468": 0,
  "PHD000476": 0,
  "PHD000479": 0,
  "PHD000490": 0,
  "PHD000497": 0,
  "PHD000503": 0,
  "PHD000504": 0,
  "UCK000094": 156000,
};

const LIVE = process.argv.includes("--live");

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE" : "DRY RUN"}`);
  console.log(`Reverts planned: ${Object.keys(REVERTS).length}`);
  console.log("");

  const orders = await findAllNoCache("Orders");

  for (const [orderNo, targetTotal] of Object.entries(REVERTS)) {
    const order = orders.find((o: any) => o.order_no === orderNo);
    if (!order) {
      console.log(`  ✗ ${orderNo}: NOT FOUND`);
      continue;
    }
    const currentTotal = Number(order.total_amount || 0);
    console.log(`  ${orderNo}: ${currentTotal} → ${targetTotal}`);

    if (LIVE) {
      await update("Orders", order.id, { total_amount: targetTotal });
      console.log(`    ✓ reverted`);
    }
  }

  if (!LIVE) {
    console.log("");
    console.log("Dry run only. Add --live to apply.");
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
