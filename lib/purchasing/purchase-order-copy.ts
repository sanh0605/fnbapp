// BR-INV-016: the starting values of a new purchase order copied from a stored one.
// Pure: the form and the server action both rely on these rules living only here.

export type PurchaseOrderCopySeed = {
  sourceOrderId: string;
  sourceCancelled: boolean;
  supplier_id: string;
  source_id: string;
  supplier_invoice_code: string;       // "" unless the source is CANCELLED
  transaction_date: string | null;     // ISO; null unless the source is CANCELLED
  notes: string;
  shipping_fee: number;
  tax_amount: number;
  voucher_amount: number;
  discount_amount: number;
  payment_method: "CASH" | "BANK_TRANSFER" | "";
  bank_account_id: string;             // "" when not in activeBankAccountIds
  lines: Array<{
    purchased_item_id: string;
    unit: string;
    quantity: number;
    subtotal: number;
    conversion_id: string;
  }>;
};

type CopySourceOrder = {
  id: string;
  status: string;
  supplier_id?: string | null;
  source_id?: string | null;
  supplier_invoice_code?: string | null;
  transaction_date?: string | null;
  created_at: string;
  notes?: string | null;
  shipping_fee?: number | string | null;
  tax_amount?: number | string | null;
  voucher_amount?: number | string | null;
  discount_amount?: number | string | null;
  payment_method?: string | null;
  bank_account_id?: string | null;
};

type CopySourceLine = {
  id: string;
  purchased_item_id: string;
  unit?: string | null;
  quantity: number | string;
  subtotal: number | string;
  conversion_id?: string | null;
  created_at?: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function buildPurchaseOrderCopySeed(input: {
  order: CopySourceOrder;
  lines: CopySourceLine[];
  activeBankAccountIds: Set<string>;
}): PurchaseOrderCopySeed {
  const { order, lines, activeBankAccountIds } = input;
  const cancelled = order.status === "CANCELLED";
  const method = order.payment_method === "CASH" || order.payment_method === "BANK_TRANSFER"
    ? order.payment_method
    : "";
  const accountId = order.bank_account_id ?? "";

  const sortedLines = [...lines].sort((a, b) => {
    const byTime = (a.created_at ?? "").localeCompare(b.created_at ?? "");
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });

  return {
    sourceOrderId: order.id,
    sourceCancelled: cancelled,
    supplier_id: order.supplier_id ?? "",
    source_id: order.source_id ?? "",
    supplier_invoice_code: cancelled ? order.supplier_invoice_code ?? "" : "",
    transaction_date: cancelled ? order.transaction_date || order.created_at : null,
    notes: order.notes ?? "",
    shipping_fee: toNumber(order.shipping_fee),
    tax_amount: toNumber(order.tax_amount),
    voucher_amount: toNumber(order.voucher_amount),
    discount_amount: toNumber(order.discount_amount),
    payment_method: method,
    bank_account_id: accountId && activeBankAccountIds.has(accountId) ? accountId : "",
    lines: sortedLines.map(l => ({
      purchased_item_id: l.purchased_item_id,
      unit: l.unit ?? "",
      quantity: toNumber(l.quantity),
      subtotal: toNumber(l.subtotal),
      conversion_id: l.conversion_id ?? "",
    })),
  };
}
