import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
} from "../inventory-consumption";
import { computeMacCostForConsumptionRows, type MacLedgerEntry } from "../mac-cogs";
import { parseLineRecipeSnapshot } from "../order-types";
import type {
  BackdatedLedgerOrder,
  BackdatedLedgerOrderLine,
  BackdatedLedgerRecipe,
  BackdatedLedgerSemiProduct,
  BackdatedLedgerStockRow,
} from "./find-affected-lines";

export type SaleTimeCogsChange = {
  line_id: string;
  order_id: string;
  old_cost_at_sale: number;
  new_cost_at_sale: number;
};

export function computeSaleTimeCogs(input: {
  order: BackdatedLedgerOrder;
  line: BackdatedLedgerOrderLine;
  ledger: BackdatedLedgerStockRow[];
  recipes: BackdatedLedgerRecipe[];
  semiProducts: BackdatedLedgerSemiProduct[];
}): SaleTimeCogsChange {
  if (!input.order.created_at) {
    throw new Error(`Order ${input.order.id} is missing created_at`);
  }

  const saleTime = input.order.created_at;
  const saleMs = new Date(saleTime).getTime();
  const ledgerBeforeOrder = input.ledger
    .filter(row => {
      const rowMs = new Date(row.created_at || 0).getTime();
      return rowMs <= saleMs && row.reference_id !== input.order.id;
    })
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  // asOf = saleTime, not "now": a semi-product recipe version that started
  // AFTER this sale must not be used to recompute it, even though the event
  // being recovered here concerns a raw-ingredient PO_RECEIPT, not the
  // recipe itself (same class of bug fixed in lib/order-ledger-audit.ts).
  const consumptionMaps = buildSemiProductRecipeMaps(input.recipes, input.semiProducts, saleTime);
  const balances = buildInventoryBalances(ledgerBeforeOrder, saleTime);
  const lineRecipe = parseLineRecipeSnapshot(input.line.recipe_snapshot_json || "{}");
  applyModifierQuantitiesFromSnapshot(lineRecipe, input.line);
  const consumptionRows = buildLineConsumptionRows(
    lineRecipe,
    Number(input.line.qty || 0),
    balances,
    consumptionMaps,
  );
  const newCost = computeMacCostForConsumptionRows(
    consumptionRows,
    ledgerBeforeOrder as MacLedgerEntry[],
    saleTime,
    consumptionMaps,
  );

  return {
    line_id: input.line.id,
    order_id: input.line.order_id,
    old_cost_at_sale: Number(input.line.cost_at_sale || 0),
    new_cost_at_sale: newCost,
  };
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
