// Giai đoạn 1 of the owner-approved full-rebuild plan
// (C:\Users\Admin\.claude\plans\toasty-mapping-hollerith.md). Read-only --
// exports every Stock_Ledger row that was inserted by one of Claude's own
// correction scripts (2026-07-20/21/22 reclassification rounds), which is
// the ONLY thing that will be deleted in Giai đoạn 2. Per the owner's
// explicit instruction: anything recorded by the owner, staff, or the
// system itself in real time (live POS checkout, genuine production
// entries, genuine purchases, genuine stock adjustments) is original,
// trusted data and must NEVER be touched -- only Claude's own inserted
// correction rows are in scope.
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

// Precise marker: every row Claude's own correction scripts ever inserted
// has "RECLASSIFY" literally in its source tag (RECLASSIFY_2026-07-20,
// FULLHISTORY_RECLASSIFY_2026-07-22, and the two bugfix-of-bugfix rounds
// BUGFIX_DOUBLE_REVERSAL_2026-07-20 / FIX_DOUBLE_REVERSAL_2026-07-21 always
// co-occur with a RECLASSIFY-tagged parent). This deliberately does NOT
// match genuine real-time tags like "VARIANT_RECIPE:BTP_SHORTFALL:BTP-001"
// (no RECLASSIFY suffix) -- those are the live system's own normal
// operation and must be kept.
function isClaudeInserted(row: any): boolean {
  return (row.source || "").includes("RECLASSIFY");
}

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const fs = await import("node:fs");
  const path = await import("node:path");

  console.log("Loading Stock_Ledger...");
  const ledger = await findAllNoCache("Stock_Ledger");
  console.log(`Total rows: ${ledger.length}`);

  const claudeInserted = (ledger as any[]).filter(isClaudeInserted);
  const kept = (ledger as any[]).filter(r => !isClaudeInserted(r));

  const byType = new Map<string, number>();
  for (const r of claudeInserted) byType.set(r.transaction_type, (byType.get(r.transaction_type) || 0) + 1);
  console.log(`\nRows inserted by Claude's own correction scripts (will be deleted in Giai đoạn 2): ${claudeInserted.length}`);
  console.log("By type:", JSON.stringify(Object.fromEntries(byType)));

  const bySource = new Map<string, number>();
  for (const r of claudeInserted) bySource.set(r.source || "(none)", (bySource.get(r.source || "(none)") || 0) + 1);
  console.log("\nBy exact source tag:");
  for (const [src, count] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${src}": ${count}`);
  }

  // Sanity check: are there any RECLASSIFICATION_REVERSAL rows WITHOUT a
  // RECLASSIFY marker? If so, they need manual review before assuming
  // they're safe to keep as genuine.
  const reclassTypeRows = (ledger as any[]).filter(r => r.transaction_type === "RECLASSIFICATION_REVERSAL");
  const reclassTypeWithoutMarker = reclassTypeRows.filter(r => !isClaudeInserted(r));
  console.log(`\nSanity check: RECLASSIFICATION_REVERSAL rows total=${reclassTypeRows.length}, WITHOUT a RECLASSIFY marker=${reclassTypeWithoutMarker.length}`);
  if (reclassTypeWithoutMarker.length > 0) {
    console.log("  First 5 examples (need review):", JSON.stringify(reclassTypeWithoutMarker.slice(0, 5), null, 2));
  }

  const keptByType = new Map<string, number>();
  for (const r of kept) keptByType.set(r.transaction_type, (keptByType.get(r.transaction_type) || 0) + 1);
  console.log(`\nRows to KEEP untouched (owner/staff/live-system, original data): ${kept.length}`);
  console.log("By type:", JSON.stringify(Object.fromEntries(keptByType)));

  const outDir = path.resolve("docs/audits");
  const outPath = path.join(outDir, "2026-07-23-deleted-stock-ledger-backup.json");
  fs.writeFileSync(outPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_ledger_rows: ledger.length,
    claude_inserted_row_count: claudeInserted.length,
    kept_row_count: kept.length,
    claude_inserted_by_type: Object.fromEntries(byType),
    rows: claudeInserted,
  }, null, 2));
  console.log(`\nBackup written to ${outPath}`);
  console.log("\nNo data was written to the database. This is a read-only export.");
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
