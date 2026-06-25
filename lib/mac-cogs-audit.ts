import { computeMacCostForConsumptionRows, type MacLedgerEntry } from "./mac-cogs";
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

export type MacCogsDriftClassification =
  | "BTP_SHORTFALL"
  | "SEMI_PRODUCT_DIRECT"
  | "MIGRATED_LINE"
  | "MAC_REPRICE";

export type MacCogsLineMismatch = {
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
  classification: MacCogsDriftClassification;
  has_btp_shortfall: boolean;
  has_semi_product_direct: boolean;
};

export type MacCogsAuditWarning = {
  type: "MISSING_ORDER" | "INVALID_RECIPE";
  line_id?: string;
  order_id?: string;
  message: string;
};

export type MacCogsDriftAuditReport = {
  eligibleOrderCount: number;
  eligibleLineCount: number;
  mismatchedLineCount: number;
  totalStoredCogs: number;
  totalExpectedCogs: number;
  totalDelta: number;
  lineMismatches: MacCogsLineMismatch[];
  classificationCounts: Partial<Record<MacCogsDriftClassification, number>>;
  warnings: MacCogsAuditWarning[];
};

export function auditMacCogsDrift(input: {
  orders: RawOrder[];
  lines: RawLine[];
  ledger: MacLedgerEntry[];
  recipes: RawRecipe[];
  semiProducts: RawSemiProduct[];
  mismatchThreshold?: number;
}): MacCogsDriftAuditReport {
  const mismatchThreshold = input.mismatchThreshold ?? 1;
  const eligibleOrders = input.orders
    .filter(order => order.status === "COMPLETED" && !order.superseded_by && Boolean(order.created_at))
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const orderMap = new Map(eligibleOrders.map(order => [order.id, order]));
  const allOrderIds = new Set(input.orders.map(order => order.id));
  const warnings: MacCogsAuditWarning[] = [];

  const linesByOrder = new Map<string, RawLine[]>();
  for (const line of input.lines) {
    if (orderMap.has(line.order_id)) {
      const rows = linesByOrder.get(line.order_id) || [];
      rows.push(line);
      linesByOrder.set(line.order_id, rows);
      continue;
    }

    if (!allOrderIds.has(line.order_id)) {
      warnings.push({
        type: "MISSING_ORDER",
        line_id: line.id,
        order_id: line.order_id,
        message: `Line ${line.id} references missing order ${line.order_id}`,
      });
    }
  }

  const eligibleLines = eligibleOrders.flatMap(order => linesByOrder.get(order.id) || []);
  const consumptionMaps = buildSemiProductRecipeMaps(input.recipes, input.semiProducts);
  const lineMismatches: MacCogsLineMismatch[] = [];
  const classificationCounts: Partial<Record<MacCogsDriftClassification, number>> = {};
  let totalStoredCogs = 0;
  let totalExpectedCogs = 0;
  const sortedLedger = [...input.ledger].sort((a, b) =>
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );
  const ledgerUntilOrder: MacLedgerEntry[] = [];
  let ledgerCursor = 0;

  for (const order of eligibleOrders) {
    const orderLines = linesByOrder.get(order.id) || [];
    const orderTime = new Date(order.created_at || 0).getTime();
    while (ledgerCursor < sortedLedger.length) {
      const row = sortedLedger[ledgerCursor];
      const rowTime = new Date(row.created_at || 0).getTime();
      if (rowTime > orderTime) break;
      ledgerUntilOrder.push(row);
      ledgerCursor += 1;
    }
    const ledgerBeforeOrder = ledgerUntilOrder.filter(row => row.reference_id !== order.id);
    const balances = buildInventoryBalances(ledgerBeforeOrder, order.created_at);

    for (const line of orderLines) {
      const storedCost = Number(line.cost_at_sale || 0);
      const qty = Number(line.qty || 0);
      let expectedCost = 0;
      let consumptionRows: ConsumptionRow[] = [];

      try {
        const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json || "{}");
        applyModifierQuantitiesFromSnapshot(lineRecipe, line);
        consumptionRows = buildLineConsumptionRows(lineRecipe, qty, balances, consumptionMaps);
        expectedCost = computeMacCostForConsumptionRows(
          consumptionRows,
          ledgerBeforeOrder,
          order.created_at || "",
          consumptionMaps,
        );
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

      const delta = expectedCost - storedCost;
      if (Math.abs(delta) <= mismatchThreshold) continue;

      const classification = classifyMismatch(line, consumptionRows);
      classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
      lineMismatches.push({
        line_id: line.id,
        order_id: line.order_id,
        order_no: order.order_no || order.id,
        created_at: order.created_at || "",
        product_id: line.product_id || "",
        variant_id: line.variant_id || "",
        qty,
        stored_cost: storedCost,
        expected_cost: expectedCost,
        delta,
        classification,
        has_btp_shortfall: consumptionRows.some(row => row.source.includes("BTP_SHORTFALL")),
        has_semi_product_direct: consumptionRows.some(row => String(row.item_reference || "").startsWith("BTP-")),
      });
    }
  }

  lineMismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    eligibleOrderCount: eligibleOrders.length,
    eligibleLineCount: eligibleLines.length,
    mismatchedLineCount: lineMismatches.length,
    totalStoredCogs,
    totalExpectedCogs,
    totalDelta: totalExpectedCogs - totalStoredCogs,
    lineMismatches,
    classificationCounts,
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

  for (const modifier of lineRecipe.modifiers) {
    rows.push(...allocateRecipeConsumption({
      ingredients: modifier.recipe.ingredients,
      multiplier: lineQty * Number(modifier.modifier_qty || 1),
      balances,
      ...consumptionMaps,
      source: `MODIFIER_RECIPE:${modifier.modifier_id}`,
    }));
  }
  return rows;
}

function classifyMismatch(line: RawLine, rows: ConsumptionRow[]): MacCogsDriftClassification {
  if (rows.some(row => row.source.includes("BTP_SHORTFALL"))) return "BTP_SHORTFALL";
  if (rows.some(row => String(row.item_reference || "").startsWith("BTP-"))) return "SEMI_PRODUCT_DIRECT";
  if (line.id.startsWith("ol-migrated")) return "MIGRATED_LINE";
  return "MAC_REPRICE";
}

function applyModifierQuantitiesFromSnapshot(
  lineRecipe: ReturnType<typeof parseLineRecipeSnapshot>,
  line: RawLine,
): void {
  const modifierQtyById = modifierQtyByIdFromLine(line);
  for (const modifier of lineRecipe.modifiers) {
    if (!modifier.modifier_qty) {
      modifier.modifier_qty = modifierQtyById.get(modifier.modifier_id) || 1;
    }
  }
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
