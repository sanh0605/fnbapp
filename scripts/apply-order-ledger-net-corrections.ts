import * as dotenv from "dotenv";
import crypto from "node:crypto";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

function fmt(value: number): string {
  return Number(value.toFixed(6)).toString();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { auditOrderLedger } = await import("../lib/order-ledger-audit");
  const { findAllNoCache, insertMany } = await import("../lib/sheets_db");

  const [orders, lines, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const reportBefore = auditOrderLedger({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
  });

  const now = new Date().toISOString();
  const corrections = reportBefore.mismatches.map(mismatch => {
    const quantityChange = mismatch.expected_quantity - mismatch.actual_quantity;
    return {
      id: `stk-audit-fix-${crypto.randomUUID()}`,
      transaction_type: quantityChange < 0 ? "SALES_CONSUME" : "EDIT_REVERSAL",
      reference_id: mismatch.order_id,
      item_reference: mismatch.item_reference,
      quantity_change: quantityChange,
      unit_cost: 0,
      created_at: now,
      order_event_id: "",
      cost_at_sale: 0,
      source: "ORDER_LEDGER_AUDIT_CORRECTION",
    };
  });

  const simulatedLedger = [...(ledger as any[]), ...corrections];
  const reportAfter = auditOrderLedger({
    orders: orders as any[],
    lines: lines as any[],
    ledger: simulatedLedger,
  });

  console.log(`=== ORDER LEDGER NET CORRECTIONS (${apply ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`Before mismatches: ${reportBefore.mismatches.length}`);
  console.log(`Corrections:       ${corrections.length}`);
  console.log(`After mismatches:  ${reportAfter.mismatches.length}`);

  for (const row of corrections.slice(0, 30)) {
    const order = (orders as any[]).find(o => o.id === row.reference_id);
    console.log([
      order?.order_no || row.reference_id,
      row.transaction_type,
      `item=${row.item_reference}`,
      `qty=${fmt(Number(row.quantity_change))}`,
    ].join(" | "));
  }

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply to insert correction rows.");
    return;
  }

  if (reportAfter.mismatches.length !== 0) {
    throw new Error("Refusing to apply: simulated corrections do not clear the audit.");
  }

  const batchSize = 200;
  for (let i = 0; i < corrections.length; i += batchSize) {
    const batch = corrections.slice(i, i + batchSize);
    await insertMany("Stock_Ledger", batch);
    console.log(`Inserted ${Math.min(i + batch.length, corrections.length)}/${corrections.length}`);
  }
  console.log(`Inserted ${corrections.length} correction rows.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
