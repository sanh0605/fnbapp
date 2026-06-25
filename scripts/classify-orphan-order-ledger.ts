import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main() {
  const { auditOrderLedger } = await import("../lib/order-ledger-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [ordersV2, linesV2, ledger, ordersV1] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Orders"),
  ]);

  const report = auditOrderLedger({
    orders: ordersV2 as any[],
    lines: linesV2 as any[],
    ledger: ledger as any[],
  });

  const v1OrderIds = new Set((ordersV1 as any[]).map(order => order.id));
  const migratedV1Ids = new Set<string>();
  for (const order of ordersV2 as any[]) {
    try {
      const snap = JSON.parse(order.pos_snapshot_json || "{}");
      if (snap.v1_id) migratedV1Ids.add(String(snap.v1_id));
    } catch {}
  }

  const byClass = new Map<string, number>();
  const add = (key: string) => byClass.set(key, (byClass.get(key) || 0) + 1);

  for (const row of report.orphanLedgerRows as any[]) {
    const ref = String(row.reference_id || "");
    if (migratedV1Ids.has(ref)) add("migrated_v1_order");
    else if (v1OrderIds.has(ref)) add("unmigrated_v1_order");
    else if (ref.startsWith("ORD-")) add("missing_ord_reference");
    else add("missing_uuid_reference");
  }

  console.log("=== ORPHAN ORDER LEDGER CLASSIFICATION ===");
  console.log(`Orphan ledger rows: ${report.orphanLedgerRows.length}`);
  for (const [key, count] of [...byClass.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${key}: ${count}`);
  }

  console.log("\nExamples:");
  for (const row of report.orphanLedgerRows.slice(0, 20) as any[]) {
    const ref = String(row.reference_id || "");
    const cls = migratedV1Ids.has(ref)
      ? "migrated_v1_order"
      : v1OrderIds.has(ref)
        ? "unmigrated_v1_order"
        : ref.startsWith("ORD-")
          ? "missing_ord_reference"
          : "missing_uuid_reference";
    console.log(JSON.stringify({ class: cls, id: row.id, reference_id: row.reference_id, item_reference: row.item_reference, quantity_change: row.quantity_change }));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
