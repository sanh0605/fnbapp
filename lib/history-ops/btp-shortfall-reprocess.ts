import crypto from "node:crypto";
import { parseLineRecipeSnapshot } from "./order-types";
import {
  allocateRecipeConsumption,
  buildInventoryBalances,
  buildSemiProductRecipeMaps,
} from "./inventory-consumption";

type RawOrder = {
  id: string;
  order_no?: string;
  status?: string;
  superseded_by?: string;
  created_at?: string;
};

type RawLine = {
  id: string;
  order_id: string;
  qty?: string | number;
  recipe_snapshot_json?: string;
  modifiers_snapshot_json?: string;
};

type RawLedger = {
  id?: string;
  transaction_type?: string;
  reference_id?: string;
  item_reference?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
  created_at?: string;
  order_event_id?: string;
  cost_at_sale?: string | number;
  source?: string;
};

type RawRecipe = {
  target_id?: string;
  target_type?: string;
  ingredients_json?: string;
};

type RawSemiProduct = {
  id?: string;
  batch_yield?: string | number;
};

export type ReprocessLedgerRow = {
  id: string;
  transaction_type: "EDIT_REVERSAL" | "SALES_CONSUME";
  reference_id: string;
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
  created_at: string;
  order_event_id: string;
  cost_at_sale: number;
  source: string;
};

export type BtpShortfallReprocessPlan = {
  cutoffAt: string;
  ordersToReprocess: number;
  rowsToInsert: ReprocessLedgerRow[];
  summaries: Array<{
    order_id: string;
    order_no: string;
    old_rows: number;
    new_rows: number;
  }>;
};

export function planBtpShortfallReprocess(input: {
  cutoffAt: string;
  orders: RawOrder[];
  lines: RawLine[];
  ledger: RawLedger[];
  recipes: RawRecipe[];
  semiProducts: RawSemiProduct[];
}): BtpShortfallReprocessPlan {
  const cutoffMs = new Date(input.cutoffAt).getTime();
  const linesByOrder = new Map<string, RawLine[]>();
  for (const line of input.lines) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const ledgerByOrder = new Map<string, RawLedger[]>();
  const reprocessedOrderIds = new Set<string>();
  for (const row of input.ledger) {
    if (
      (
        row.order_event_id?.startsWith("BTP-SHORTFALL-REPROCESS-") ||
        row.id?.startsWith("stk-btp-reprocess-")
      ) &&
      row.reference_id
    ) {
      reprocessedOrderIds.add(row.reference_id);
    }
    if (row.transaction_type !== "SALES_CONSUME" || !row.reference_id) continue;
    const rows = ledgerByOrder.get(row.reference_id) || [];
    rows.push(row);
    ledgerByOrder.set(row.reference_id, rows);
  }

  const consumptionMaps = buildSemiProductRecipeMaps(input.recipes, input.semiProducts);
  const workingLedger: RawLedger[] = [...input.ledger];
  const rowsToInsert: ReprocessLedgerRow[] = [];
  const summaries: BtpShortfallReprocessPlan["summaries"] = [];
  const orders = input.orders
    .filter(order =>
      order.status === "COMPLETED" &&
      !order.superseded_by &&
      Boolean(order.created_at) &&
      new Date(order.created_at || 0).getTime() >= cutoffMs &&
      !reprocessedOrderIds.has(order.id),
    )
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  for (const order of orders) {
    const oldRows = ledgerByOrder.get(order.id) || [];
    if (oldRows.length === 0) continue;
    const eventId = `BTP-SHORTFALL-REPROCESS-${order.id}`;
    const pastLedger = workingLedger.filter(row => {
      const rowTime = new Date(row.created_at || 0).getTime();
      if (rowTime > new Date(order.created_at || 0).getTime()) return false;
      return row.reference_id !== order.id;
    });
    const balances = buildInventoryBalances(pastLedger as any[], order.created_at);
    const newRows: ReprocessLedgerRow[] = [];

    for (const line of linesByOrder.get(order.id) || []) {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
      const modifierQtyById = modifierQtyByIdFromLine(line);

      for (const row of allocateRecipeConsumption({
        ingredients: lineRecipe.variant.ingredients,
        multiplier: Number(line.qty || 0),
        balances,
        ...consumptionMaps,
        source: "VARIANT_RECIPE",
      })) {
        newRows.push(makeSalesRow(order, eventId, row.item_reference, -row.quantity, row.source));
      }

      for (const modifier of lineRecipe.modifiers) {
        const modifierQty = Number(modifier.modifier_qty || modifierQtyById.get(modifier.modifier_id) || 1);
        for (const row of allocateRecipeConsumption({
          ingredients: modifier.recipe.ingredients,
          multiplier: Number(line.qty || 0) * modifierQty,
          balances,
          ...consumptionMaps,
          source: `MODIFIER_RECIPE:${modifier.modifier_id}`,
        })) {
          newRows.push(makeSalesRow(order, eventId, row.item_reference, -row.quantity, row.source));
        }
      }
    }

    const reversalRows = oldRows.map(row => makeReversalRow(order, eventId, row));
    const correctionRows = [...reversalRows, ...mergeSalesRows(newRows)];
    rowsToInsert.push(...correctionRows);
    workingLedger.push(...correctionRows);
    summaries.push({
      order_id: order.id,
      order_no: order.order_no || order.id,
      old_rows: oldRows.length,
      new_rows: newRows.length,
    });
  }

  return {
    cutoffAt: input.cutoffAt,
    ordersToReprocess: summaries.length,
    rowsToInsert,
    summaries,
  };
}

function makeReversalRow(order: RawOrder, eventId: string, row: RawLedger): ReprocessLedgerRow {
  return {
    id: `stk-btp-reprocess-${crypto.randomUUID()}`,
    transaction_type: "EDIT_REVERSAL",
    reference_id: order.id,
    item_reference: row.item_reference || "",
    quantity_change: Math.abs(Number(row.quantity_change || 0)),
    unit_cost: 0,
    created_at: order.created_at || new Date().toISOString(),
    order_event_id: eventId,
    cost_at_sale: 0,
    source: row.source || "VARIANT_RECIPE",
  };
}

function makeSalesRow(
  order: RawOrder,
  eventId: string,
  itemReference: string,
  quantityChange: number,
  source: string,
): ReprocessLedgerRow {
  return {
    id: `stk-btp-reprocess-${crypto.randomUUID()}`,
    transaction_type: "SALES_CONSUME",
    reference_id: order.id,
    item_reference: itemReference,
    quantity_change: quantityChange,
    unit_cost: 0,
    created_at: order.created_at || new Date().toISOString(),
    order_event_id: eventId,
    cost_at_sale: 0,
    source,
  };
}

function mergeSalesRows(rows: ReprocessLedgerRow[]): ReprocessLedgerRow[] {
  const merged = new Map<string, ReprocessLedgerRow>();
  for (const row of rows) {
    const key = `${row.item_reference}\u0000${row.source}`;
    const current = merged.get(key);
    if (current) {
      current.quantity_change += row.quantity_change;
    } else {
      merged.set(key, { ...row });
    }
  }
  return [...merged.values()].filter(row => Math.abs(row.quantity_change) > 0.000001);
}

function modifierQtyByIdFromLine(line: RawLine): Map<string, number> {
  try {
    const modifiers = JSON.parse(line.modifiers_snapshot_json || "[]");
    if (!Array.isArray(modifiers)) return new Map();
    return new Map(modifiers.map((modifier: any) => [String(modifier.id || ""), Number(modifier.qty || 1)]));
  } catch {
    return new Map();
  }
}
