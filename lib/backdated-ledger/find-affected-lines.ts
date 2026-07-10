import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
} from "../inventory-consumption";
import { parseLineRecipeSnapshot } from "../order-types";

export type BackdatedLedgerEvent = {
  id: string;
  effective_timestamp: string;
  visibility_timestamp: string;
  item_reference: string;
  status?: string;
};

export type BackdatedLedgerOrder = {
  id: string;
  order_no?: string;
  status?: string;
  superseded_by?: string;
  created_at?: string;
};

export type BackdatedLedgerOrderLine = {
  id: string;
  order_id: string;
  product_id?: string;
  variant_id?: string;
  qty?: string | number;
  cost_at_sale?: string | number;
  recipe_snapshot_json?: string;
  modifiers_snapshot_json?: string;
};

export type BackdatedLedgerStockRow = {
  id?: string;
  reference_id?: string;
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
  created_at?: string;
};

export type BackdatedLedgerRecipe = {
  target_type?: string;
  target_id?: string;
  ingredients_json?: string;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
};

export type BackdatedLedgerSemiProduct = {
  id?: string;
  batch_yield?: string | number;
};

export type AffectedOrderLine = {
  line_id: string;
  order_id: string;
  order_no: string;
  sale_time: string;
  stored_cost_at_sale: number;
  product_id: string;
  qty: number;
};

export type FindAffectedLinesInput = {
  event: BackdatedLedgerEvent;
  orders: BackdatedLedgerOrder[];
  lines: BackdatedLedgerOrderLine[];
  ledger: BackdatedLedgerStockRow[];
  recipes: BackdatedLedgerRecipe[];
  semiProducts: BackdatedLedgerSemiProduct[];
};

export function findAffectedLines(input: FindAffectedLinesInput): AffectedOrderLine[] {
  const eventItem = input.event.item_reference;
  const effectiveMs = timestampMs(input.event.effective_timestamp);
  const visibilityMs = timestampMs(input.event.visibility_timestamp);
  if (!eventItem || !Number.isFinite(effectiveMs) || !Number.isFinite(visibilityMs)) return [];

  const consumedOrderIds = new Set(
    input.ledger
      .filter(row => row.transaction_type === "SALES_CONSUME")
      .filter(row => row.item_reference === eventItem)
      .filter(row => {
        const rowMs = timestampMs(row.created_at || "");
        return rowMs >= effectiveMs && rowMs <= visibilityMs;
      })
      .map(row => row.reference_id || "")
      .filter(Boolean),
  );
  if (consumedOrderIds.size === 0) return [];

  const ordersById = new Map(input.orders.map(order => [order.id, order]));
  const linesByOrderId = groupLinesByOrderId(input.lines);
  const consumptionMaps = buildSemiProductRecipeMaps(input.recipes, input.semiProducts);
  const sortedLedger = [...input.ledger].sort((a, b) => timestampMs(a.created_at || "") - timestampMs(b.created_at || ""));
  const affected: AffectedOrderLine[] = [];

  for (const orderId of consumedOrderIds) {
    const order = ordersById.get(orderId);
    if (!order || order.status !== "COMPLETED" || order.superseded_by || !order.created_at) continue;
    const saleMs = timestampMs(order.created_at);
    if (saleMs < effectiveMs || saleMs > visibilityMs) continue;

    const ledgerBeforeOrder = sortedLedger.filter(row =>
      timestampMs(row.created_at || "") <= saleMs &&
      row.reference_id !== order.id,
    );
    const balances = buildInventoryBalances(ledgerBeforeOrder, order.created_at);

    for (const line of linesByOrderId.get(order.id) || []) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
      applyModifierQuantitiesFromSnapshot(lineRecipe, line);
      const rows = buildLineConsumptionRows(
        lineRecipe,
        Number(line.qty || 0),
        new Map(balances),
        consumptionMaps,
      );
      if (!rows.some(row => row.item_reference === eventItem)) continue;
      affected.push({
        line_id: line.id,
        order_id: line.order_id,
        order_no: order.order_no || order.id,
        sale_time: order.created_at,
        stored_cost_at_sale: Number(line.cost_at_sale || 0),
        product_id: String(line.product_id || ""),
        qty: Number(line.qty || 0),
      });
    }
  }

  return affected.sort((a, b) =>
    timestampMs(a.sale_time) - timestampMs(b.sale_time) ||
    a.line_id.localeCompare(b.line_id),
  );
}

function groupLinesByOrderId(lines: BackdatedLedgerOrderLine[]): Map<string, BackdatedLedgerOrderLine[]> {
  const grouped = new Map<string, BackdatedLedgerOrderLine[]>();
  for (const line of lines) {
    const rows = grouped.get(line.order_id) || [];
    rows.push(line);
    grouped.set(line.order_id, rows);
  }
  return grouped;
}

function applyModifierQuantitiesFromSnapshot(
  lineRecipe: ReturnType<typeof parseLineRecipeSnapshot>,
  line: BackdatedLedgerOrderLine,
): void {
  const modifierQtyById = modifierQtyByIdFromLine(line);
  for (const modifier of lineRecipe.modifiers) {
    if (!modifier.modifier_qty) {
      modifier.modifier_qty = modifierQtyById.get(modifier.modifier_id) || 1;
    }
  }
}

function modifierQtyByIdFromLine(line: BackdatedLedgerOrderLine): Map<string, number> {
  try {
    const parsed = JSON.parse(line.modifiers_snapshot_json || "[]") as unknown;
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.map(row => {
      const modifier = row as { id?: string; qty?: string | number };
      return [modifier.id || "", Number(modifier.qty || 1)] as const;
    }));
  } catch {
    return new Map();
  }
}

function timestampMs(value: string): number {
  return new Date(value || 0).getTime();
}
