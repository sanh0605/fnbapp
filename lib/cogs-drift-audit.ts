import { FIFOTracker, type LedgerEntry } from "./fifo-tracker";
import { parseLineRecipeSnapshot } from "./order-types";
import {
  allocateRecipeConsumption,
  buildInventoryBalances,
  buildSemiProductRecipeMaps,
  type ConsumptionRow,
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
  product_id?: string;
  variant_id?: string;
  qty?: string | number;
  cost_at_sale?: string | number;
  recipe_snapshot_json?: string;
  modifiers_snapshot_json?: string;
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

export type CogsLineMismatch = {
  line_id: string;
  order_id: string;
  order_no: string;
  created_at: string;
  product_id: string;
  variant_id: string;
  qty: number;
  stored_cost: number;
  expected_cost: number;
  delta: number;
};

export type CogsOrderMismatch = {
  order_id: string;
  order_no: string;
  created_at: string;
  stored_cogs: number;
  expected_cogs: number;
  delta: number;
  line_count: number;
  mismatched_line_count: number;
};

export type CogsAuditWarning = {
  type: "MISSING_ORDER" | "INVALID_RECIPE";
  line_id?: string;
  order_id?: string;
  message: string;
};

export type CogsDriftAuditReport = {
  eligibleOrderCount: number;
  eligibleLineCount: number;
  mismatchedLineCount: number;
  mismatchedOrderCount: number;
  totalStoredCogs: number;
  totalExpectedCogs: number;
  totalDelta: number;
  orderMismatches: CogsOrderMismatch[];
  lineMismatches: CogsLineMismatch[];
  warnings: CogsAuditWarning[];
};

export function auditCogsDrift(input: {
  orders: RawOrder[];
  lines: RawLine[];
  ledger: LedgerEntry[];
  recipes: RawRecipe[];
  semiProducts: RawSemiProduct[];
  mismatchThreshold?: number;
}): CogsDriftAuditReport {
  const mismatchThreshold = input.mismatchThreshold ?? 1;
  const eligibleOrders = input.orders.filter(order =>
    order.status === "COMPLETED" &&
    !order.superseded_by &&
    Boolean(order.created_at),
  );
  const orderMap = new Map(eligibleOrders.map(order => [order.id, order]));
  const warnings: CogsAuditWarning[] = [];

  const linesByOrder = new Map<string, RawLine[]>();
  for (const line of input.lines) {
    if (orderMap.has(line.order_id)) {
      const rows = linesByOrder.get(line.order_id) || [];
      rows.push(line);
      linesByOrder.set(line.order_id, rows);
      continue;
    }

    const hasAnyOrder = input.orders.some(order => order.id === line.order_id);
    if (!hasAnyOrder) {
      warnings.push({
        type: "MISSING_ORDER",
        line_id: line.id,
        order_id: line.order_id,
        message: `Line ${line.id} references missing order ${line.order_id}`,
      });
    }
  }

  const sortedOrders = [...eligibleOrders].sort((a, b) =>
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );
  const eligibleLines = sortedOrders.flatMap(order => linesByOrder.get(order.id) || []);

  const consumptionMaps = buildSemiProductRecipeMaps(input.recipes, input.semiProducts);
  const lineMismatches: CogsLineMismatch[] = [];
  const orderTotals = new Map<string, CogsOrderMismatch>();
  let totalStoredCogs = 0;
  let totalExpectedCogs = 0;
  const priorLines: RawLine[] = [];

  for (const order of sortedOrders) {
    const orderLines = linesByOrder.get(order.id) || [];
    const orderTime = new Date(order.created_at || 0).getTime();
    const ledgerBeforeOrder = input.ledger.filter(entry => {
      const entryTime = new Date(entry.created_at || 0).getTime();
      if (entryTime > orderTime) return false;
      return entry.transaction_type !== "SALES_CONSUME" && entry.transaction_type !== "EDIT_REVERSAL";
    });

    const fifoTracker = new FIFOTracker();
    fifoTracker.init(ledgerBeforeOrder);
    const consumptionBalances = buildInventoryBalances(ledgerBeforeOrder, order.created_at);

    for (const priorLine of priorLines) {
      try {
        const priorRecipe = parseLineRecipeSnapshot(priorLine.recipe_snapshot_json || "{}");
        const modifierQtyById = modifierQtyByIdFromLine(priorLine);
        for (const modEntry of priorRecipe.modifiers) {
          if (!modEntry.modifier_qty) {
            modEntry.modifier_qty = modifierQtyById.get(modEntry.modifier_id) || 1;
          }
        }
        const priorConsumptionRows = buildLineConsumptionRows(
          priorRecipe,
          Number(priorLine.qty) || 0,
          consumptionBalances,
          consumptionMaps,
        );
        costConsumptionRowsFIFO(priorConsumptionRows, fifoTracker);
      } catch {}
    }

    for (const line of orderLines) {
      const qty = Number(line.qty) || 0;
      const storedCost = Number(line.cost_at_sale) || 0;
      let expectedCost = 0;

      try {
        const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
        const modifierQtyById = modifierQtyByIdFromLine(line);
        for (const modEntry of lineRecipe.modifiers) {
          if (!modEntry.modifier_qty) {
            modEntry.modifier_qty = modifierQtyById.get(modEntry.modifier_id) || 1;
          }
        }
        const consumptionRows = buildLineConsumptionRows(lineRecipe, qty, consumptionBalances, consumptionMaps);
        expectedCost = costConsumptionRowsFIFO(consumptionRows, fifoTracker);
      } catch (error: any) {
        warnings.push({
          type: "INVALID_RECIPE",
          line_id: line.id,
          order_id: line.order_id,
          message: error?.message || `Line ${line.id} has invalid recipe snapshot`,
        });
      }

      totalStoredCogs += storedCost;
      totalExpectedCogs += expectedCost;

      const orderTotal = getOrderTotal(orderTotals, order);
      orderTotal.line_count += 1;
      orderTotal.stored_cogs += storedCost;
      orderTotal.expected_cogs += expectedCost;
      orderTotal.delta = orderTotal.expected_cogs - orderTotal.stored_cogs;

      const delta = expectedCost - storedCost;
      if (Math.abs(delta) > mismatchThreshold) {
        orderTotal.mismatched_line_count += 1;
        lineMismatches.push({
          line_id: line.id,
          order_id: line.order_id,
          order_no: order.order_no || "",
          created_at: order.created_at || "",
          product_id: line.product_id || "",
          variant_id: line.variant_id || "",
          qty,
          stored_cost: storedCost,
          expected_cost: expectedCost,
          delta,
        });
      }
    }

    priorLines.push(...orderLines);
  }

  const orderMismatches = [...orderTotals.values()]
    .filter(order => order.mismatched_line_count > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  lineMismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    eligibleOrderCount: eligibleOrders.length,
    eligibleLineCount: eligibleLines.length,
    mismatchedLineCount: lineMismatches.length,
    mismatchedOrderCount: orderMismatches.length,
    totalStoredCogs,
    totalExpectedCogs,
    totalDelta: totalExpectedCogs - totalStoredCogs,
    orderMismatches,
    lineMismatches,
    warnings,
  };
}

function buildLineConsumptionRows(
  lineRecipe: ReturnType<typeof parseLineRecipeSnapshot>,
  lineQty: number,
  balances: Map<string, number>,
  consumptionMaps: ReturnType<typeof buildSemiProductRecipeMaps>,
): ConsumptionRow[] {
  const rows: ConsumptionRow[] = [];
  rows.push(...allocateRecipeConsumption({
    ingredients: lineRecipe.variant.ingredients,
    multiplier: lineQty,
    balances,
    ...consumptionMaps,
    source: "VARIANT_RECIPE",
  }));

  for (const modEntry of lineRecipe.modifiers) {
    const modifierQty = Number(modEntry.modifier_qty || 1);
    rows.push(...allocateRecipeConsumption({
      ingredients: modEntry.recipe.ingredients,
      multiplier: lineQty * modifierQty,
      balances,
      ...consumptionMaps,
      source: `MODIFIER_RECIPE:${modEntry.modifier_id}`,
    }));
  }
  return rows;
}

function costConsumptionRowsFIFO(rows: ConsumptionRow[], tracker: FIFOTracker): number {
  return Math.round(rows.reduce((sum, row) => sum + tracker.consume(row.item_reference, row.quantity), 0));
}

function modifierQtyByIdFromLine(line: RawLine): Map<string, number> {
  try {
    const modifiers = JSON.parse(line.modifiers_snapshot_json || "[]");
    if (!Array.isArray(modifiers)) return new Map();
    return new Map(modifiers.map((mod: any) => [String(mod.id || ""), Number(mod.qty || 1)]));
  } catch {
    return new Map();
  }
}

function getOrderTotal(orderTotals: Map<string, CogsOrderMismatch>, order: RawOrder): CogsOrderMismatch {
  let total = orderTotals.get(order.id);
  if (!total) {
    total = {
      order_id: order.id,
      order_no: order.order_no || "",
      created_at: order.created_at || "",
      stored_cogs: 0,
      expected_cogs: 0,
      delta: 0,
      line_count: 0,
      mismatched_line_count: 0,
    };
    orderTotals.set(order.id, total);
  }
  return total;
}
