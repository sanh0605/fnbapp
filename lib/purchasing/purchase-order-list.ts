import type { DBPurchaseOrder } from "@/types/db";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { toSaigonUtcRange } from "@/lib/shared/report-time";

// Spec 2026-09-29-menu-va-khuon-trang-design.md section 3.5: the shared
// slip-list template, first applied to purchase orders. Runs on the server;
// the browser receives one page of rows, never the whole table.
export const PURCHASE_ORDERS_PER_PAGE = 20;
const MAX_QUERY_LENGTH = 100;
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export interface PurchaseOrderListFilters {
  q?: string; status?: string; supplier?: string; from?: string; to?: string; page?: string;
  // "CASH" | "BANK_TRANSFER"; anything else is ignored.
  pay?: string;
}
export interface PurchaseOrderListRow {
  id: string; dateText: string; supplierName: string; sourceName: string;
  status: string; totalAmount: number;
  // "Tiền mặt" | "Chuyển khoản" | "—" (a draft that has not chosen yet)
  paymentLabel: string;
}
export interface PurchaseOrderListPage {
  rows: PurchaseOrderListRow[]; total: number; page: number; pageCount: number;
  firstIndex: number; lastIndex: number; rangeError: boolean;
}

function paymentLabelOf(method: DBPurchaseOrder["payment_method"]): string {
  if (method === "CASH") return "Tiền mặt";
  if (method === "BANK_TRANSFER") return "Chuyển khoản";
  return "—";
}

function slipTime(po: DBPurchaseOrder): number {
  const t = new Date(po.transaction_date || po.created_at || "").getTime();
  return Number.isNaN(t) ? 0 : t;
}
function createdTime(po: DBPurchaseOrder): number {
  const t = new Date(po.created_at || "").getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function listPurchaseOrdersPage(input: {
  orders: DBPurchaseOrder[];
  suppliers: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  lines: { purchase_order_id: string; purchased_item_id: string }[];
  items: { id: string; name: string }[];
  filters: PurchaseOrderListFilters;
}): PurchaseOrderListPage {
  const { orders, filters } = input;
  const supplierName = new Map(input.suppliers.map(s => [s.id, s.name]));
  const sourceName = new Map(input.sources.map(s => [s.id, s.name]));
  const itemName = new Map(input.items.map(i => [i.id, i.name]));
  const itemText = new Map<string, string>();
  for (const line of input.lines) {
    const name = itemName.get(line.purchased_item_id);
    if (!name) continue;
    itemText.set(line.purchase_order_id, `${itemText.get(line.purchase_order_id) ?? ""} ${name}`);
  }

  const term = (filters.q ?? "").trim().slice(0, MAX_QUERY_LENGTH).toLowerCase();
  const from = filters.from && DAY_ONLY.test(filters.from) ? filters.from : undefined;
  const to = filters.to && DAY_ONLY.test(filters.to) ? filters.to : undefined;
  const rangeError = Boolean(from && to && from > to);
  const range = rangeError ? null : toSaigonUtcRange(from ?? "1970-01-01", to ?? "9999-12-31");
  const startMs = from && range ? range.startUtc.getTime() : -Infinity;
  const endMs = to && range ? range.endUtc.getTime() : Infinity;

  const pay = filters.pay === "CASH" || filters.pay === "BANK_TRANSFER" ? filters.pay : undefined;

  const matched = orders.filter(po => {
    if (pay && po.payment_method !== pay) return false;
    if (filters.status && filters.status !== "ALL" && po.status !== filters.status) return false;
    if (filters.supplier && filters.supplier !== "ALL" && po.supplier_id !== filters.supplier) return false;
    const t = slipTime(po);
    if (t < startMs || t > endMs) return false;
    if (!term) return true;
    const haystack = [po.id, supplierName.get(po.supplier_id) ?? "", po.supplier_invoice_code ?? "", itemText.get(po.id) ?? ""]
      .join(" ").toLowerCase();
    return haystack.includes(term);
  });

  matched.sort((a, b) =>
    slipTime(b) - slipTime(a) || createdTime(b) - createdTime(a) || b.id.localeCompare(a.id));

  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / PURCHASE_ORDERS_PER_PAGE));
  const asked = Number(filters.page);
  const page = Number.isInteger(asked) && asked >= 1 ? Math.min(asked, pageCount) : 1;
  const start = (page - 1) * PURCHASE_ORDERS_PER_PAGE;
  const slice = matched.slice(start, start + PURCHASE_ORDERS_PER_PAGE);

  return {
    rows: slice.map(po => ({
      id: po.id,
      dateText: formatDateTimeFull(po.transaction_date || po.created_at),
      supplierName: supplierName.get(po.supplier_id) ?? "—",
      sourceName: sourceName.get(po.source_id) ?? "—",
      status: po.status,
      totalAmount: Number(po.total_amount) || 0,
      paymentLabel: paymentLabelOf(po.payment_method),
    })),
    total,
    page,
    pageCount,
    firstIndex: total === 0 ? 0 : start + 1,
    lastIndex: start + slice.length,
    rangeError,
  };
}
