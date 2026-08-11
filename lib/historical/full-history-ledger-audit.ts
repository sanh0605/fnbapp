export type FullHistoryAuditOrder = {
  id: string;
  order_no?: string;
  status?: string;
};

export type FullHistoryAuditLedgerRow = {
  id?: string;
  reference_id?: string;
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
};

export type FullHistoryLedgerMismatch = {
  order_id: string;
  order_no: string;
  status: string;
  item_reference: string;
  expected_quantity: number;
  actual_quantity: number;
  delta: number;
};

export type FullHistoryOrderLedgerAuditReport = {
  orderCount: number;
  computedLedgerRowCount: number;
  recordedLedgerRowCount: number;
  mismatches: FullHistoryLedgerMismatch[];
  orphanLedgerRows: FullHistoryAuditLedgerRow[];
};

const ORDER_DERIVED_TYPES = new Set([
  "SALES_CONSUME",
  "PRODUCTION_CONSUME",
  "PRODUCTION_YIELD",
  "RECLASSIFICATION_REVERSAL",
  "EDIT_REVERSAL",
  "EDIT_CONSUME",
]);

export function auditFullHistoryOrderLedger(input: {
  orders: FullHistoryAuditOrder[];
  computedLedger: FullHistoryAuditLedgerRow[];
  recordedLedger: FullHistoryAuditLedgerRow[];
  tolerance?: number;
}): FullHistoryOrderLedgerAuditReport {
  const tolerance = input.tolerance ?? 0.01;
  const orderById = new Map(input.orders.map(order => [order.id, order]));
  const expected = aggregateByOrderAndItem(input.computedLedger);
  const actualRows: FullHistoryAuditLedgerRow[] = [];
  const orphanLedgerRows: FullHistoryAuditLedgerRow[] = [];

  for (const row of input.recordedLedger) {
    if (!isOrderDerivedRow(row) || !row.reference_id) continue;
    if (!orderById.has(row.reference_id)) {
      orphanLedgerRows.push(row);
      continue;
    }
    actualRows.push(row);
  }

  const actual = aggregateByOrderAndItem(actualRows);
  const keys = new Set([...expected.keys(), ...actual.keys()]);
  const mismatches: FullHistoryLedgerMismatch[] = [];

  for (const key of keys) {
    const [orderId, itemReference] = splitKey(key);
    const expectedQuantity = expected.get(key) || 0;
    const actualQuantity = actual.get(key) || 0;
    const delta = actualQuantity - expectedQuantity;
    if (Math.abs(delta) <= tolerance) continue;
    const order = orderById.get(orderId);
    mismatches.push({
      order_id: orderId,
      order_no: order?.order_no || orderId,
      status: order?.status || "",
      item_reference: itemReference,
      expected_quantity: expectedQuantity,
      actual_quantity: actualQuantity,
      delta,
    });
  }

  mismatches.sort((a, b) =>
    Math.abs(b.delta) - Math.abs(a.delta) ||
    a.order_id.localeCompare(b.order_id) ||
    a.item_reference.localeCompare(b.item_reference),
  );

  return {
    orderCount: input.orders.length,
    computedLedgerRowCount: input.computedLedger.length,
    recordedLedgerRowCount: input.recordedLedger.length,
    mismatches,
    orphanLedgerRows,
  };
}

function aggregateByOrderAndItem(rows: FullHistoryAuditLedgerRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!isOrderDerivedRow(row) || !row.reference_id || !row.item_reference) continue;
    const quantity = Number(row.quantity_change || 0);
    if (!Number.isFinite(quantity)) continue;
    const key = makeKey(row.reference_id, row.item_reference);
    totals.set(key, (totals.get(key) || 0) + quantity);
  }
  return totals;
}

function isOrderDerivedRow(row: FullHistoryAuditLedgerRow): boolean {
  return Boolean(row.transaction_type && ORDER_DERIVED_TYPES.has(row.transaction_type));
}

function makeKey(orderId: string, itemReference: string): string {
  return `${orderId}\u0000${itemReference}`;
}

function splitKey(key: string): [string, string] {
  const separator = key.indexOf("\u0000");
  return [key.slice(0, separator), key.slice(separator + 1)];
}
