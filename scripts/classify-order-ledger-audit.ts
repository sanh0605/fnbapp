import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function isNear(a: number, b: number, tolerance = 0.000001): boolean {
  return Math.abs(a - b) <= tolerance;
}

async function main() {
  const { auditOrderLedger } = await import("../lib/order-ledger-audit");
  const { findAllNoCache } = await import("../lib/sheets_db");

  const [orders, lines, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const orderById = new Map((orders as any[]).map(order => [order.id, order]));
  const report = auditOrderLedger({ orders: orders as any[], lines: lines as any[], ledger: ledger as any[] });

  const groups = {
    migrated: 0,
    native: 0,
    supersededOrVoided: 0,
    actualDoubleExpected: 0,
    actualZeroExpectedNonzero: 0,
    expectedZeroActualNonzero: 0,
    other: 0,
  };

  const ordersWithMismatch = new Set<string>();
  for (const mismatch of report.mismatches) {
    ordersWithMismatch.add(mismatch.order_id);
    const order = orderById.get(mismatch.order_id) || {};
    const isMigrated = String(order.id || "").startsWith("ord-migrated-") || String(order.pos_snapshot_json || "").includes("migrated_from_v1");
    if (isMigrated) groups.migrated += 1;
    else groups.native += 1;

    if (order.status === "SUPERSEDED" || order.status === "VOIDED") groups.supersededOrVoided += 1;
    if (mismatch.expected_quantity !== 0 && isNear(mismatch.actual_quantity, mismatch.expected_quantity * 2)) {
      groups.actualDoubleExpected += 1;
    } else if (mismatch.expected_quantity !== 0 && mismatch.actual_quantity === 0) {
      groups.actualZeroExpectedNonzero += 1;
    } else if (mismatch.expected_quantity === 0 && mismatch.actual_quantity !== 0) {
      groups.expectedZeroActualNonzero += 1;
    } else {
      groups.other += 1;
    }
  }

  const orphanByReferencePrefix = new Map<string, number>();
  for (const row of report.orphanLedgerRows) {
    const ref = String(row.reference_id || "");
    const prefix = ref.startsWith("ord-") ? "ord-*" : ref.startsWith("ORD-") ? "ORD-*" : ref.includes("-") ? `${ref.split("-")[0]}-*` : "(blank/other)";
    orphanByReferencePrefix.set(prefix, (orphanByReferencePrefix.get(prefix) || 0) + 1);
  }

  console.log("=== ORDER LEDGER CLASSIFICATION ===");
  console.log(`Mismatch rows:       ${report.mismatches.length}`);
  console.log(`Orders affected:     ${ordersWithMismatch.size}`);
  console.log(`Migrated mismatches: ${groups.migrated}`);
  console.log(`Native mismatches:   ${groups.native}`);
  console.log(`Superseded/voided:   ${groups.supersededOrVoided}`);
  console.log(`Actual = 2x expected:${groups.actualDoubleExpected}`);
  console.log(`Actual = 0:          ${groups.actualZeroExpectedNonzero}`);
  console.log(`Expected = 0:        ${groups.expectedZeroActualNonzero}`);
  console.log(`Other:               ${groups.other}`);
  console.log(`Orphans:             ${report.orphanLedgerRows.length}`);
  console.log("Orphans by reference prefix:");
  for (const [prefix, count] of [...orphanByReferencePrefix.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${prefix}: ${count}`);
  }

  console.log("\nNative mismatch samples:");
  for (const mismatch of report.mismatches.filter(m => {
    const order = orderById.get(m.order_id) || {};
    return !String(order.id || "").startsWith("ord-migrated-") && !String(order.pos_snapshot_json || "").includes("migrated_from_v1");
  }).slice(0, 25)) {
    console.log(JSON.stringify(mismatch));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
