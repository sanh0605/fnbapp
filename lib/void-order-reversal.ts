const VOIDABLE_CHECKOUT_TYPES = new Set([
  "SALES_CONSUME",
  "PRODUCTION_CONSUME",
  "PRODUCTION_YIELD",
]);

export type VoidSourceLedgerRow = {
  id?: string;
  reference_id?: string;
  transaction_type?: string;
  item_reference?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
  cost_at_sale?: string | number;
  source?: string;
};

export type VoidReversalRow = {
  id: string;
  transaction_type: "EDIT_REVERSAL";
  reference_id: string;
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
  created_at: string;
  order_event_id: string;
  cost_at_sale: number;
  source: string;
};

export function buildVoidReversalRows(input: {
  orderId: string;
  orderEventId: string;
  eventTime: string;
  ledgerRows: VoidSourceLedgerRow[];
  createRowId: () => string;
}): VoidReversalRow[] {
  return input.ledgerRows.flatMap(row => {
    if (row.reference_id !== input.orderId) return [];
    if (!VOIDABLE_CHECKOUT_TYPES.has(row.transaction_type || "")) return [];

    const quantityChange = Number(row.quantity_change);
    if (!row.item_reference || !Number.isFinite(quantityChange) || quantityChange === 0) {
      return [];
    }

    return [{
      id: input.createRowId(),
      transaction_type: "EDIT_REVERSAL" as const,
      reference_id: input.orderId,
      item_reference: row.item_reference,
      quantity_change: -quantityChange,
      unit_cost: Number(row.unit_cost) || 0,
      created_at: input.eventTime,
      order_event_id: input.orderEventId,
      cost_at_sale: Number(row.cost_at_sale) || 0,
      source: row.source || "VARIANT_RECIPE",
    }];
  });
}
