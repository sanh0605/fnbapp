const DERIVED_LEDGER_TYPES = new Set([
  "SALES_CONSUME",
  "PRODUCTION_CONSUME",
  "PRODUCTION_YIELD",
  "RECLASSIFICATION_REVERSAL",
  "EDIT_REVERSAL",
  "EDIT_CONSUME",
]);

type RepairOrder = {
  id?: string;
  order_no?: string;
};

type ExistingLedgerRow = {
  reference_id?: string;
  transaction_type?: string;
};

type ComputedLedgerRow = {
  reference_id: string;
  item_reference: string;
  transaction_type: string;
  quantity_change: number;
  unit_cost: number;
  created_at: string;
};

export type VoidShortfallRepairPlan = {
  orderId: string;
  orderNo: string;
  expectedDeleteCount: number;
  insertRows: Array<{
    item_reference: string;
    transaction_type: string;
    quantity_change: number;
    unit_cost: number;
    created_at: string;
  }>;
};

export function buildVoidShortfallRepairPlan(input: {
  targetOrderNos: string[];
  orders: RepairOrder[];
  rawLedger: ExistingLedgerRow[];
  computedLedger: ComputedLedgerRow[];
}): VoidShortfallRepairPlan[] {
  return input.targetOrderNos.map(orderNo => {
    const matches = input.orders.filter(order => order.order_no === orderNo);
    if (matches.length !== 1 || !matches[0].id) {
      throw new Error(`Expected exactly one order ${orderNo}, found ${matches.length}`);
    }

    const orderId = matches[0].id;
    const expectedDeleteCount = input.rawLedger.filter(row =>
      row.reference_id === orderId
      && DERIVED_LEDGER_TYPES.has(row.transaction_type || ""),
    ).length;
    const insertRows = input.computedLedger
      .filter(row => row.reference_id === orderId)
      .map(row => ({
        item_reference: row.item_reference,
        transaction_type: row.transaction_type,
        quantity_change: row.quantity_change,
        unit_cost: row.unit_cost,
        created_at: row.created_at,
      }));

    return { orderId, orderNo, expectedDeleteCount, insertRows };
  });
}
