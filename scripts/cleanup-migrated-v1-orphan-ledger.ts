import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main() {
  const apply = process.argv.includes("--apply");
  const { auditOrderLedger } = await import("../lib/order-ledger-audit");
  const { findAllNoCache, removeMany } = await import("../lib/sheets_db");

  const [ordersV2, linesV2, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const migratedV1Ids = new Set<string>();
  for (const order of ordersV2 as any[]) {
    try {
      const snap = JSON.parse(order.pos_snapshot_json || "{}");
      if (snap.v1_id) migratedV1Ids.add(String(snap.v1_id));
    } catch {}
  }

  const report = auditOrderLedger({
    orders: ordersV2 as any[],
    lines: linesV2 as any[],
    ledger: ledger as any[],
  });

  const idsToRemove = (report.orphanLedgerRows as any[])
    .filter(row => migratedV1Ids.has(String(row.reference_id || "")))
    .map(row => row.id)
    .filter(Boolean);

  console.log(`=== MIGRATED V1 ORPHAN LEDGER CLEANUP (${apply ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`Orphan order ledger rows: ${report.orphanLedgerRows.length}`);
  console.log(`Rows to remove:           ${idsToRemove.length}`);

  for (const row of (report.orphanLedgerRows as any[]).slice(0, 30)) {
    if (!migratedV1Ids.has(String(row.reference_id || ""))) continue;
    console.log(JSON.stringify({
      id: row.id,
      reference_id: row.reference_id,
      item_reference: row.item_reference,
      quantity_change: row.quantity_change,
    }));
  }

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply to remove migrated V1 orphan rows.");
    return;
  }

  const batchSize = 200;
  for (let i = 0; i < idsToRemove.length; i += batchSize) {
    const batch = idsToRemove.slice(i, i + batchSize);
    await removeMany("Stock_Ledger", batch);
    console.log(`Removed ${Math.min(i + batch.length, idsToRemove.length)}/${idsToRemove.length}`);
  }
  console.log(`Removed ${idsToRemove.length} migrated V1 orphan Stock_Ledger rows.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
