/**
 * Read-only audit: compares each purchase order's header subtotal_amount
 * against the summed subtotal of its own Purchase_Order_Lines. Stock is
 * credited per line, not from the header, so a header total unsupported by
 * its lines means goods were paid for but never credited to inventory.
 */

export interface PoHeaderLinesAuditOrder {
  id: string;
  subtotal_amount: number | string;
  status?: string;
  transaction_date?: string;
}

export interface PoHeaderLinesAuditLine {
  po_id?: string;
  purchase_order_id?: string;
  subtotal: number | string;
}

export interface PoHeaderLinesMismatch {
  po_id: string;
  header_subtotal: number;
  lines_subtotal: number;
  delta: number;
  line_count: number;
  status: string;
  transaction_date: string;
}

export interface PoHeaderLinesAuditResult {
  orderCount: number;
  mismatchCount: number;
  mismatches: PoHeaderLinesMismatch[];
}

const DEFAULT_TOLERANCE = 0.000001;

export function auditPurchaseOrderHeaderLines(
  orders: PoHeaderLinesAuditOrder[],
  lines: PoHeaderLinesAuditLine[],
  tolerance: number = DEFAULT_TOLERANCE,
): PoHeaderLinesAuditResult {
  const linesByPoId = new Map<string, { subtotal: number; count: number }>();
  for (const line of lines) {
    const poId = String(line.po_id || line.purchase_order_id || "").trim();
    if (!poId) continue;
    const subtotal = Number(line.subtotal) || 0;
    const existing = linesByPoId.get(poId) || { subtotal: 0, count: 0 };
    linesByPoId.set(poId, { subtotal: existing.subtotal + subtotal, count: existing.count + 1 });
  }

  const mismatches: PoHeaderLinesMismatch[] = [];
  for (const order of orders) {
    const poId = String(order.id || "").trim();
    if (!poId) continue;
    const headerSubtotal = Number(order.subtotal_amount) || 0;
    const linesEntry = linesByPoId.get(poId) || { subtotal: 0, count: 0 };
    const delta = headerSubtotal - linesEntry.subtotal;
    if (Math.abs(delta) > tolerance) {
      mismatches.push({
        po_id: poId,
        header_subtotal: headerSubtotal,
        lines_subtotal: linesEntry.subtotal,
        delta,
        line_count: linesEntry.count,
        status: String(order.status || ""),
        transaction_date: String(order.transaction_date || ""),
      });
    }
  }

  return {
    orderCount: orders.length,
    mismatchCount: mismatches.length,
    mismatches,
  };
}
