import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

type LedgerRow = {
  id: string;
  reference_id?: string;
  transaction_type?: string;
  item_reference?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
  created_at?: string;
  source?: string;
  order_event_id?: string;
};

function isMigratedOrder(order: any): boolean {
  try {
    return JSON.parse(order.pos_snapshot_json || "{}").migrated_from_v1 === true;
  } catch {
    return false;
  }
}

function ledgerFingerprint(row: LedgerRow): string {
  return [
    row.reference_id || "",
    row.transaction_type || "",
    row.item_reference || "",
    Number(row.quantity_change || 0),
    Number(row.unit_cost || 0),
    row.created_at || "",
  ].join("|");
}

function fmt(value: number): string {
  return Number(value.toFixed(6)).toString();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { auditOrderLedger } = await import("../lib/order-ledger-audit");
  const { findAllNoCache, removeMany } = await import("../lib/sheets_db");

  const [orders, lines, ledger] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
  ]);

  const orderById = new Map((orders as any[]).map(order => [order.id, order]));
  const reportBefore = auditOrderLedger({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
  });

  const idsToRemove = new Set<string>();
  const skipped: any[] = [];

  for (const mismatch of reportBefore.mismatches) {
    const order = orderById.get(mismatch.order_id);
    if (!order || !isMigratedOrder(order)) continue;
    if (mismatch.delta >= 0) continue;

    const candidates = (ledger as LedgerRow[]).filter(row =>
      row.id &&
      row.reference_id === mismatch.order_id &&
      row.transaction_type === "SALES_CONSUME" &&
      row.item_reference === mismatch.item_reference &&
      row.id.startsWith("stk-migrated-") &&
      !idsToRemove.has(row.id),
    );

    const byFingerprint = new Map<string, LedgerRow[]>();
    for (const row of candidates) {
      const key = ledgerFingerprint(row);
      const group = byFingerprint.get(key) || [];
      group.push(row);
      byFingerprint.set(key, group);
    }

    const removable: LedgerRow[] = [];
    for (const group of byFingerprint.values()) {
      if (group.length < 2) continue;
      const removableCount = Math.floor(group.length / 2);
      removable.push(...group.slice(0, removableCount));
    }

    let removedQty = 0;
    const selected: LedgerRow[] = [];
    for (const row of removable) {
      if (Math.abs(removedQty - mismatch.delta) <= 0.000001) break;
      const qty = Number(row.quantity_change || 0);
      if (qty >= 0) continue;
      if (removedQty + qty < mismatch.delta - 0.000001) continue;
      selected.push(row);
      removedQty += qty;
    }

    if (Math.abs(removedQty - mismatch.delta) > 0.000001) {
      skipped.push({
        order_no: mismatch.order_no,
        item_reference: mismatch.item_reference,
        delta: mismatch.delta,
        removable_quantity: removedQty,
        removable_rows: removable.length,
      });
      continue;
    }

    for (const row of selected) idsToRemove.add(row.id);
  }

  const ledgerAfter = (ledger as LedgerRow[]).filter(row => !row.id || !idsToRemove.has(row.id));
  const reportAfter = auditOrderLedger({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledgerAfter as any[],
  });

  console.log(`=== DUPLICATED MIGRATED ORDER LEDGER CLEANUP (${apply ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`Before mismatches: ${reportBefore.mismatches.length}`);
  console.log(`Planned removes:   ${idsToRemove.size}`);
  console.log(`After mismatches:  ${reportAfter.mismatches.length}`);
  console.log(`Skipped groups:    ${skipped.length}`);

  for (const row of reportAfter.mismatches.slice(0, 20)) {
    console.log([
      row.order_no || row.order_id,
      `status=${row.status}`,
      `item=${row.item_reference}`,
      `expected=${fmt(row.expected_quantity)}`,
      `actual=${fmt(row.actual_quantity)}`,
      `delta=${fmt(row.delta)}`,
    ].join(" | "));
  }

  if (skipped.length > 0) {
    console.log("\nSkipped examples:");
    for (const row of skipped.slice(0, 10)) console.log(JSON.stringify(row));
  }

  if (!apply) {
    console.log("\nNo data was written. Re-run with --apply to remove planned duplicate rows.");
    return;
  }

  if (idsToRemove.size === 0) {
    console.log("Nothing to remove.");
    return;
  }

  const ids = [...idsToRemove];
  const batchSize = 200;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await removeMany("Stock_Ledger", batch);
    console.log(`Removed ${Math.min(i + batch.length, ids.length)}/${ids.length}`);
  }
  console.log(`Removed ${idsToRemove.size} Stock_Ledger rows.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
