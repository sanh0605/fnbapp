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
  qty?: string | number;
  recipe_snapshot_json?: string;
  modifiers_snapshot_json?: string;
};

type RawLedger = {
  id?: string;
  reference_id?: string;
  transaction_type?: string;
  item_reference?: string;
  quantity_change?: string | number;
  created_at?: string;
};

type RawRecipe = {
  target_id?: string;
  target_type?: string;
  ingredients_json?: string;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
};

type RawSemiProduct = {
  id?: string;
  batch_yield?: string | number;
};

export type OrderLedgerMismatch = {
  order_id: string;
  order_no: string;
  status: string;
  item_reference: string;
  expected_quantity: number;
  actual_quantity: number;
  delta: number;
};

export type OrderLedgerAuditReport = {
  orderCount: number;
  lineCount: number;
  ledgerRowCount: number;
  mismatches: OrderLedgerMismatch[];
  orphanLedgerRows: RawLedger[];
};

export function auditOrderLedger(input: {
  orders: RawOrder[];
  lines: RawLine[];
  ledger: RawLedger[];
  recipes?: RawRecipe[];
  semiProducts?: RawSemiProduct[];
  shortfallCutoverAt?: string;
  tolerance?: number;
}): OrderLedgerAuditReport {
  const tolerance = input.tolerance ?? 0.000001;
  const orderById = new Map(input.orders.map(order => [order.id, order]));
  const linesByOrder = new Map<string, RawLine[]>();
  for (const line of input.lines) {
    const rows = linesByOrder.get(line.order_id) || [];
    rows.push(line);
    linesByOrder.set(line.order_id, rows);
  }

  const ledgerByOrder = new Map<string, RawLedger[]>();
  const orphanLedgerRows: RawLedger[] = [];
  for (const row of input.ledger) {
    if (!isOrderInventoryLedger(row)) continue;
    if (!row.reference_id) continue;
    if (!orderById.has(row.reference_id)) {
      orphanLedgerRows.push(row);
      continue;
    }
    const rows = ledgerByOrder.get(row.reference_id) || [];
    rows.push(row);
    ledgerByOrder.set(row.reference_id, rows);
  }

  const shortfallCutoverMs = input.shortfallCutoverAt
    ? new Date(input.shortfallCutoverAt).getTime()
    : Number.NEGATIVE_INFINITY;
  const sortedOrders = [...input.orders].sort((a, b) =>
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );

  const mismatches: OrderLedgerMismatch[] = [];
  for (const order of sortedOrders) {
    const expected = expectedNetByItem(
      order,
      linesByOrder.get(order.id) || [],
      input.ledger,
      input.recipes,
      input.semiProducts,
      shortfallCutoverMs,
    );
    const actual = actualNetByItem(ledgerByOrder.get(order.id) || []);
    const keys = new Set([...expected.keys(), ...actual.keys()]);

    for (const key of keys) {
      const expectedQty = expected.get(key) || 0;
      const actualQty = actual.get(key) || 0;
      const delta = actualQty - expectedQty;
      if (Math.abs(delta) <= tolerance) continue;
      mismatches.push({
        order_id: order.id,
        order_no: order.order_no || "",
        status: order.status || "",
        item_reference: key,
        expected_quantity: expectedQty,
        actual_quantity: actualQty,
        delta,
      });
    }
  }

  mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    orderCount: input.orders.length,
    lineCount: input.lines.length,
    ledgerRowCount: input.ledger.length,
    mismatches,
    orphanLedgerRows,
  };
}

function expectedNetByItem(
  order: RawOrder,
  lines: RawLine[],
  ledger: RawLedger[],
  recipes: RawRecipe[] | undefined,
  semiProducts: RawSemiProduct[] | undefined,
  shortfallCutoverMs: number,
): Map<string, number> {
  if (order.status === "SUPERSEDED" || order.status === "VOIDED") {
    return new Map();
  }
  if (order.status !== "COMPLETED" || order.superseded_by) {
    return new Map();
  }

  const map = new Map<string, number>();
  const orderTime = new Date(order.created_at || 0).getTime();
  // The semi-product recipe used to explode a shortfall must be the one
  // effective AT THE ORDER'S OWN TIME, not whatever is effective today --
  // otherwise a later recipe revision (e.g. a changed raw-ingredient ratio)
  // makes this recompute silently diverge from what was actually recorded at
  // sale time, producing a fixed-ratio false mismatch for every order sold
  // under the old recipe version.
  const consumptionMaps = recipes && semiProducts
    ? buildSemiProductRecipeMaps(recipes, semiProducts, order.created_at || undefined)
    : null;
  const shouldUseShortfallAllocator = consumptionMaps && orderTime >= shortfallCutoverMs;
  if (shouldUseShortfallAllocator) {
    const pastLedger = ledger.filter(row => {
      const rowTime = new Date(row.created_at || 0).getTime();
      if (Number.isFinite(orderTime) && rowTime > orderTime) return false;
      return row.reference_id !== order.id;
    });
    const balances = buildInventoryBalances(pastLedger as any[], order.created_at);

    for (const line of lines) {
      const lineQty = Number(line.qty || 0);
      const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
      const modifierQtyById = modifierQtyByIdFromLine(line);
      const lineRows: ConsumptionRow[] = [];

      lineRows.push(...allocateRecipeConsumption({
        ingredients: recipe.variant.ingredients,
        multiplier: lineQty,
        balances,
        ...consumptionMaps,
        source: "VARIANT_RECIPE",
      }));

      for (const modifier of recipe.modifiers) {
        const modifierQty = Number(modifier.modifier_qty || modifierQtyById.get(modifier.modifier_id) || 1);
        lineRows.push(...allocateRecipeConsumption({
          ingredients: modifier.recipe.ingredients,
          multiplier: lineQty * modifierQty,
          balances,
          ...consumptionMaps,
          source: `MODIFIER_RECIPE:${modifier.modifier_id}`,
        }));
      }

      // Expected is the raw recipe-implied consumption (not folded into the
      // implicit-production shape): actualNetByItem below counts
      // PRODUCTION_CONSUME/PRODUCTION_YIELD alongside SALES_CONSUME/
      // EDIT_REVERSAL/RECLASSIFICATION_REVERSAL, so a semi-product shortfall's
      // raw-ingredient leg and its production-yield leg net out on the actual
      // side the same way they do here on the expected side, regardless of
      // whether this order predates the 2026-07-20 implicit-production fix,
      // was historically corrected, or is a brand new order under the live
      // forward fix.
      for (const row of lineRows) {
        add(map, row.item_reference, -row.quantity);
      }
    }
    return map;
  }

  for (const line of lines) {
    const lineQty = Number(line.qty || 0);
    const recipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
    const modifierQtyById = modifierQtyByIdFromLine(line);

    for (const ingredient of recipe.variant.ingredients) {
      add(map, ingredient.ingredient_id, -(Number(ingredient.quantity || 0) * lineQty));
    }

    for (const modifier of recipe.modifiers) {
      const modifierQty = Number(modifier.modifier_qty || modifierQtyById.get(modifier.modifier_id) || 1);
      for (const ingredient of modifier.recipe.ingredients) {
        add(map, ingredient.ingredient_id, -(Number(ingredient.quantity || 0) * lineQty * modifierQty));
      }
    }
  }
  return map;
}

function actualNetByItem(rows: RawLedger[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!isOrderInventoryLedger(row)) continue;
    if (!row.item_reference) continue;
    add(map, row.item_reference, Number(row.quantity_change || 0));
  }
  return map;
}

function isOrderInventoryLedger(row: RawLedger): boolean {
  // A semi-product shortfall's implicit production step (2026-07-20 fix)
  // writes PRODUCTION_CONSUME (raw ingredient) and PRODUCTION_YIELD (semi-
  // product) rows against the order's own reference_id; RECLASSIFICATION_
  // REVERSAL is the historical-correction counterpart that reverses the
  // original mis-classified SALES_CONSUME row. All three must be counted
  // alongside SALES_CONSUME/EDIT_REVERSAL so expectedNetByItem's raw,
  // unfolded recipe expectation nets against the actual ledger the same way
  // regardless of whether an order predates this fix, was historically
  // corrected, or is a brand new order under the live forward fix.
  return (
    row.transaction_type === "SALES_CONSUME" ||
    row.transaction_type === "EDIT_REVERSAL" ||
    row.transaction_type === "RECLASSIFICATION_REVERSAL" ||
    row.transaction_type === "PRODUCTION_CONSUME" ||
    row.transaction_type === "PRODUCTION_YIELD"
  );
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

function add(map: Map<string, number>, key: string, quantity: number): void {
  if (!key || !Number.isFinite(quantity) || quantity === 0) return;
  map.set(key, (map.get(key) || 0) + quantity);
}
