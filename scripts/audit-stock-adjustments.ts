import * as dotenv from "dotenv";
import { auditStockAdjustmentLedgerLinks } from "../lib/stock-adjustment-audit";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 4.3 — Audit stock adjustments:
 *   - Categorize: real adjustment vs historical fix
 *   - Identify rows missing reason
 *   - Report by date/item
 */

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [adjustments, ledger, items] = await Promise.all([
    findAllNoCache("Stock_Adjustments"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Base_Ingredients"),
  ]);

  const itemName = new Map<string, string>();
  for (const item of items as any[]) itemName.set(item.id, item.name);

  const all = adjustments as any[];
  const missingReason = all.filter(a => !a.reason || String(a.reason).trim().length === 0);
  const byStatus = new Map<string, number>();
  for (const a of all) byStatus.set(a.status || "(empty)", (byStatus.get(a.status || "(empty)") || 0) + 1);

  console.log("=== STOCK ADJUSTMENTS AUDIT ===");
  console.log(`Total adjustments: ${all.length}`);
  console.log(`Missing reason:    ${missingReason.length}`);
  console.log(`\nBy status:`);
  for (const [s, c] of byStatus.entries()) console.log(`  ${s}: ${c}`);

  if (missingReason.length > 0) {
    console.log(`\nAdjustments missing reason (historical, can't fix without overwriting user data):`);
    for (const a of missingReason.slice(0, 20)) {
      const name = itemName.get(a.item_reference) || a.item_reference;
      console.log(`  ${a.id} | ${name} | diff=${a.difference} | ${a.created_at} | by=${a.created_by}`);
    }
  }

  // Verify each APPROVED adjustment has matching STOCK_ADJUST ledger entry
  const links = auditStockAdjustmentLedgerLinks(all, ledger as any[]);
  console.log(`\nApproved adjustments:                       ${links.approvedCount}`);
  console.log(`Missing STOCK_ADJUST ledger entry:         ${links.missingLedgerIds.length}`);
  console.log(`Duplicate STOCK_ADJUST ledger entry:       ${links.duplicateLedgerIds.length}`);
  console.log(`Mismatched STOCK_ADJUST ledger entry:      ${links.mismatchedLedgerIds.length}`);

  console.log("\nNo data was written.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
