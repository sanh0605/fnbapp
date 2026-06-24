import { FIFOTracker, type LedgerEntry } from "./fifo-tracker";
import type { SemiProductContext } from "./order-cogs";
import { computeLineCostFIFO } from "./order-cogs-fifo";
import { parseLineRecipeSnapshot } from "./order-types";

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

  const eligibleLines = input.lines
    .filter(line => {
      if (orderMap.has(line.order_id)) return true;
      const hasAnyOrder = input.orders.some(order => order.id === line.order_id);
      if (!hasAnyOrder) {
        warnings.push({
          type: "MISSING_ORDER",
          line_id: line.id,
          order_id: line.order_id,
          message: `Line ${line.id} references missing order ${line.order_id}`,
        });
      }
      return false;
    })
    .sort((a, b) => {
      const orderA = orderMap.get(a.order_id);
      const orderB = orderMap.get(b.order_id);
      return new Date(orderA?.created_at || 0).getTime() - new Date(orderB?.created_at || 0).getTime();
    });

  const fifoTracker = new FIFOTracker();
  fifoTracker.init(input.ledger);

  const spContext = buildSemiProductContext(input.recipes, input.semiProducts);
  const lineMismatches: CogsLineMismatch[] = [];
  const orderTotals = new Map<string, CogsOrderMismatch>();
  let totalStoredCogs = 0;
  let totalExpectedCogs = 0;

  for (const line of eligibleLines) {
    const order = orderMap.get(line.order_id);
    if (!order) continue;

    const qty = Number(line.qty) || 0;
    const storedCost = Number(line.cost_at_sale) || 0;
    let expectedCost = 0;

    try {
      const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
      expectedCost = computeLineCostFIFO(lineRecipe, fifoTracker, qty, spContext);
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

function buildSemiProductContext(recipes: RawRecipe[], semiProducts: RawSemiProduct[]): SemiProductContext {
  const spRecipes = recipes
    .filter(recipe => recipe.target_type === "SEMI_PRODUCT")
    .map(recipe => ({
      target_id: recipe.target_id || "",
      ingredients_json: recipe.ingredients_json || "",
    }));
  const spYields = new Map<string, number>();
  for (const semiProduct of semiProducts) {
    if (!semiProduct.id) continue;
    spYields.set(semiProduct.id, Number(semiProduct.batch_yield) || 1);
  }
  return { recipes: spRecipes, yields: spYields };
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
