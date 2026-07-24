export type NegativeStockClassification =
  | "MISSING_PRODUCTION_YIELD"
  | "INSUFFICIENT_PRODUCTION_YIELD"
  | "RECIPE_MISMATCH"
  | "PO_RECEIPT_GAP"
  | "LEDGER_GAP_MIGRATION"
  | "OTHER";

export type NegativeStockAction =
  | "PRODUCTION_YIELD_BACKFILL"
  | "STOCK_ADJUST_IN"
  | "PO_RECEIPT_BACKFILL"
  | "MANUAL_REVIEW";

export type LedgerRow = {
  id?: string;
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
  reference_id?: string;
  source?: string;
  notes?: string;
  created_at?: string;
};

export type ItemRow = {
  id?: string;
  name?: string;
  base_unit?: string;
  is_non_inventory?: string | boolean;
};

export type UnitRow = {
  id?: string;
  name?: string;
  abbreviation?: string;
};

export type NegativeStockItemDiagnosis = {
  itemId: string;
  itemName: string;
  itemType: "BASE_INGREDIENT" | "SEMI_PRODUCT" | "UNKNOWN";
  unitName: string;
  balance: number;
  classification: NegativeStockClassification;
  suggestedAction: NegativeStockAction;
  proposedQuantity: number;
  latestKnownUnitCost: number;
  totalsByTransactionType: Record<string, number>;
  timeline: LedgerRow[];
};

export type NegativeStockDiagnosis = {
  generated_at: string;
  items: NegativeStockItemDiagnosis[];
};

export type DiagnoseNegativeStockInput = {
  ledger: LedgerRow[];
  baseIngredients: ItemRow[];
  semiProducts: ItemRow[];
  units?: UnitRow[];
  targetItemIds?: string[];
  generatedAt?: string;
};

export type ResolutionPlanInput = {
  diagnosis: NegativeStockDiagnosis;
  ledger: LedgerRow[];
  now: string;
  idSeed: string;
};

export type ResolutionPlan = {
  referenceId: string;
  changesNeeded: number;
  rowsToInsert: LedgerRow[];
  skipped: Array<{ itemId: string; reason: string }>;
};

const PHASE9_REFERENCE_ID = "PHASE9-NEGATIVE-STOCK-2026-06-26";
const EPSILON = 0.000001;

export function diagnoseNegativeStock(input: DiagnoseNegativeStockInput): NegativeStockDiagnosis {
  const itemById = buildItemMap(input.baseIngredients, input.semiProducts);
  const unitNameById = new Map((input.units || []).map(unit => [unit.id || "", unit.name || unit.abbreviation || unit.id || ""]));
  const targetItemIds = input.targetItemIds || [...itemById.keys()];

  const items = targetItemIds
    .map(itemId => diagnoseItem(itemId, input.ledger, itemById, unitNameById))
    .filter((item): item is NegativeStockItemDiagnosis => Boolean(item))
    .filter(item => item.balance < -EPSILON);

  return {
    generated_at: input.generatedAt || new Date().toISOString(),
    items,
  };
}

export function planNegativeStockResolution(input: ResolutionPlanInput): ResolutionPlan {
  const currentBalanceByItem = computeBalanceByItem(input.ledger);
  const rowsToInsert: LedgerRow[] = [];
  const skipped: Array<{ itemId: string; reason: string }> = [];

  for (const item of input.diagnosis.items) {
    const currentBalance = currentBalanceByItem.get(item.itemId) ?? item.balance;
    if (currentBalance >= -EPSILON) {
      skipped.push({ itemId: item.itemId, reason: "already balanced" });
      continue;
    }

    const quantity = roundQuantity(Math.abs(currentBalance));
    if (quantity <= EPSILON) {
      skipped.push({ itemId: item.itemId, reason: "no quantity needed" });
      continue;
    }

    const transactionType = actionToTransactionType(item.suggestedAction);
    if (!transactionType) {
      skipped.push({ itemId: item.itemId, reason: `manual review for ${item.classification}` });
      continue;
    }

    rowsToInsert.push({
      id: `STK-PHASE9-${input.idSeed}-${String(rowsToInsert.length + 1).padStart(3, "0")}`,
      transaction_type: transactionType,
      reference_id: PHASE9_REFERENCE_ID,
      item_reference: item.itemId,
      quantity_change: quantity,
      unit_cost: transactionType === "PRODUCTION_YIELD" ? item.latestKnownUnitCost : 0,
      notes: buildResolutionNote(item),
      created_at: input.now,
    });
  }

  return {
    referenceId: PHASE9_REFERENCE_ID,
    changesNeeded: rowsToInsert.length,
    rowsToInsert,
    skipped,
  };
}

function diagnoseItem(
  itemId: string,
  ledger: LedgerRow[],
  itemById: Map<string, ItemRow & { itemType: "BASE_INGREDIENT" | "SEMI_PRODUCT" }>,
  unitNameById: Map<string, string>,
): NegativeStockItemDiagnosis | null {
  const item = itemById.get(itemId);
  if (!item || isNonInventory(item)) return null;

  const timeline = ledger
    .filter(row => row.item_reference === itemId)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  const totalsByTransactionType: Record<string, number> = {};
  let balance = 0;
  for (const row of timeline) {
    const qty = Number(row.quantity_change || 0);
    if (!Number.isFinite(qty)) continue;
    balance += qty;
    const type = row.transaction_type || "(blank)";
    totalsByTransactionType[type] = (totalsByTransactionType[type] || 0) + qty;
  }

  const classification = classifyItem(item.itemType, totalsByTransactionType, timeline);
  return {
    itemId,
    itemName: item.name || itemId,
    itemType: item.itemType,
    unitName: unitNameById.get(item.base_unit || "") || item.base_unit || "",
    balance: roundQuantity(balance),
    classification,
    suggestedAction: suggestedActionFor(classification, item.itemType),
    proposedQuantity: roundQuantity(Math.max(0, -balance)),
    latestKnownUnitCost: getLatestKnownUnitCost(timeline),
    totalsByTransactionType: roundTotals(totalsByTransactionType),
    timeline,
  };
}

function classifyItem(
  itemType: "BASE_INGREDIENT" | "SEMI_PRODUCT",
  totals: Record<string, number>,
  timeline: LedgerRow[],
): NegativeStockClassification {
  if (itemType === "SEMI_PRODUCT") {
    const yieldQty = totals.PRODUCTION_YIELD || 0;
    const salesConsume = Math.abs(totals.SALES_CONSUME || 0);
    if (salesConsume > 0 && yieldQty <= EPSILON) return "MISSING_PRODUCTION_YIELD";
    if (yieldQty > EPSILON && yieldQty < salesConsume) return "INSUFFICIENT_PRODUCTION_YIELD";
    return "OTHER";
  }

  const receiptQty = totals.PO_RECEIPT || 0;
  const salesConsume = Math.abs(totals.SALES_CONSUME || 0);
  if (salesConsume > receiptQty) return "PO_RECEIPT_GAP";
  if (timeline.some(row => String(row.source || "").includes("MIGRATION"))) return "LEDGER_GAP_MIGRATION";
  return "OTHER";
}

function suggestedActionFor(
  classification: NegativeStockClassification,
  itemType: "BASE_INGREDIENT" | "SEMI_PRODUCT" | "UNKNOWN",
): NegativeStockAction {
  if (classification === "MISSING_PRODUCTION_YIELD" || classification === "INSUFFICIENT_PRODUCTION_YIELD") {
    return "PRODUCTION_YIELD_BACKFILL";
  }
  if (classification === "PO_RECEIPT_GAP" && itemType === "BASE_INGREDIENT") {
    return "STOCK_ADJUST_IN";
  }
  return "MANUAL_REVIEW";
}

function actionToTransactionType(action: NegativeStockAction): string | null {
  if (action === "PRODUCTION_YIELD_BACKFILL") return "PRODUCTION_YIELD";
  if (action === "STOCK_ADJUST_IN") return "STOCK_ADJUST";
  if (action === "PO_RECEIPT_BACKFILL") return "PO_RECEIPT";
  return null;
}

function buildItemMap(baseIngredients: ItemRow[], semiProducts: ItemRow[]) {
  const itemById = new Map<string, ItemRow & { itemType: "BASE_INGREDIENT" | "SEMI_PRODUCT" }>();
  for (const item of baseIngredients) {
    if (item.id) itemById.set(item.id, { ...item, itemType: "BASE_INGREDIENT" });
  }
  for (const item of semiProducts) {
    if (item.id) itemById.set(item.id, { ...item, itemType: "SEMI_PRODUCT" });
  }
  return itemById;
}

function computeBalanceByItem(ledger: LedgerRow[]): Map<string, number> {
  const balanceByItem = new Map<string, number>();
  for (const row of ledger) {
    const itemId = row.item_reference || "";
    if (!itemId) continue;
    balanceByItem.set(itemId, (balanceByItem.get(itemId) || 0) + Number(row.quantity_change || 0));
  }
  return balanceByItem;
}

function getLatestKnownUnitCost(timeline: LedgerRow[]): number {
  const costRows = timeline
    .filter(row => Number(row.quantity_change || 0) > 0 && Number(row.unit_cost || 0) > 0)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const latest = costRows.at(-1);
  return latest ? Number(latest.unit_cost || 0) : 0;
}

function buildResolutionNote(item: NegativeStockItemDiagnosis): string {
  return [
    "Phase 9 negative stock resolution",
    `classification=${item.classification}`,
    `diagnosed_balance=${item.balance}`,
  ].join("; ");
}

function isNonInventory(item?: ItemRow): boolean {
  return item?.is_non_inventory === true || item?.is_non_inventory === "TRUE";
}

function roundTotals(totals: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, roundQuantity(value)]));
}

function roundQuantity(value: number): number {
  return Number(value.toFixed(6));
}
