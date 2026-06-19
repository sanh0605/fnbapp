/**
 * Re-migration wrapper: reset migrated V2 orders → re-migrate with WS-7 corrected helpers.
 *
 * Run: npx tsx scripts/re-migrate-v1-to-v2.ts --live
 *
 * Pre-conditions:
 *   - WS-7 Tasks 1-3 merged (corrected helpers + MAC recompute + topping COGS)
 *   - V1 backups still in place (Orders_BACKUP_PRE_WS5_2026-06-19 etc.)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const { execSync } = require("child_process");

async function main() {
  const isLive = process.argv.includes("--live");
  if (!isLive) {
    console.log("DRY-RUN mode. This script only supports --live (reset + migrate).");
    console.log("To preview reset: npx tsx scripts/reset-migrated-v2-orders.ts");
    console.log("To preview migration: npx tsx scripts/migrate-orders-to-v2.ts --dry-run");
    return;
  }

  console.log("\n=== WS-7 Re-Migration (LIVE) ===\n");

  console.log("Step 1: Selective reset of migrated V2 orders...");
  execSync("npx tsx scripts/reset-migrated-v2-orders.ts --live", { stdio: "inherit" });

  console.log("\nStep 2: Re-migrate with corrected helpers...");
  execSync("npx tsx scripts/migrate-orders-to-v2.ts --live", { stdio: "inherit" });

  console.log("\n=== Re-migration complete ===");
  console.log("Next: run scripts/verify-pnl-patterns.ts to verify fixes.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
