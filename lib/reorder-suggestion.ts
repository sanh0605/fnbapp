// FC-2: consumption-rate-based low-stock detection + reorder-quantity suggestion.
// Design approved 2026-07-20 (docs/superpowers/plans/2026-07-20-feature-completeness-required-now-roadmap.md, section 2).
// Read-only: no new write path, no atomicity concern.
//
// Pure computation over already-fetched data, matching lib/full-history-recompute.ts's
// convention: data access lives in the caller (server action), not in this module.

import { buildInventoryBalances } from "@/lib/inventory-consumption";

export type ReorderItemType = "BASE_INGREDIENT" | "SEMI_PRODUCT";

export type ReorderSuggestion = {
  itemId: string;
  itemName: string;
  itemType: ReorderItemType;
  baseUnitName: string;
  currentStock: number;
  hasSufficientData: boolean;
  avgDailyConsumption: number | null;
  lookbackDays: number;
  leadTimeDays: number | null;
  leadTimeIsDefault: boolean;
  safetyBufferMultiplier: number;
  reorderPoint: number | null;
  isLowStock: boolean;
  targetCoverageDays: number;
  suggestedReorderQtyBaseUnit: number | null;
  suggestedReorderQtyPurchaseUnit: number | null;
  purchaseUnitName: string | null;
  conversionRate: number | null;
};

export type ReorderSuggestionOptions = {
  lookbackDays?: number;
  defaultLeadTimeDays?: number;
  safetyBufferMultiplier?: number;
  targetCoverageDays?: number;
  asOf?: Date;
};

export type RawStockLedgerRow = {
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
  reference_id?: string;
  created_at?: string;
};

export type RawBaseIngredient = {
  id: string;
  name: string;
  base_unit?: string;
  is_non_inventory?: boolean | string;
};

export type RawSemiProduct = {
  id: string;
  name: string;
  base_unit?: string;
};

export type RawUnit = { id: string; name: string };

export type RawPurchasedItem = {
  id: string;
  base_ingredient_id?: string;
  semi_product_id?: string;
};

export type RawUomConversion = {
  purchased_item_id: string;
  purchased_unit: string;
  conversion_rate: string | number;
  status?: string;
};

export type RawPurchaseOrder = { id: string; status?: string; created_at?: string };

export type RawPurchaseOrderLine = {
  purchase_order_id: string;
  purchased_item_id?: string;
};

export type ReorderSuggestionInput = {
  stockLedger: RawStockLedgerRow[];
  baseIngredients: RawBaseIngredient[];
  semiProducts: RawSemiProduct[];
  units: RawUnit[];
  purchasedItems: RawPurchasedItem[];
  uomConversions: RawUomConversion[];
  purchaseOrders: RawPurchaseOrder[];
  purchaseOrderLines: RawPurchaseOrderLine[];
};

const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_LEAD_TIME_DAYS = 3;
const DEFAULT_SAFETY_BUFFER_MULTIPLIER = 1.3;
const DEFAULT_TARGET_COVERAGE_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const CONSUMPTION_TYPES = new Set(["SALES_CONSUME", "PRODUCTION_CONSUME"]);

// Minimum number of distinct consumption events within the lookback window before a
// consumption rate is trusted enough to drive a suggestion. Below this, history is too
// thin to distinguish a real rate from noise.
const MIN_CONSUMPTION_EVENTS = 3;

export function computeReorderSuggestions(
  input: ReorderSuggestionInput,
  options: ReorderSuggestionOptions = {}
): ReorderSuggestion[] {
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const defaultLeadTimeDays = options.defaultLeadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  const safetyBufferMultiplier = options.safetyBufferMultiplier ?? DEFAULT_SAFETY_BUFFER_MULTIPLIER;
  const targetCoverageDays = options.targetCoverageDays ?? DEFAULT_TARGET_COVERAGE_DAYS;
  const asOf = options.asOf ?? new Date();
  const asOfMs = asOf.getTime();
  const lookbackStartMs = asOfMs - lookbackDays * DAY_MS;

  const { stockLedger, baseIngredients, semiProducts, units, purchasedItems, uomConversions, purchaseOrders, purchaseOrderLines } = input;

  const balances = buildInventoryBalances(stockLedger, asOf.toISOString());
  const unitNameById = new Map<string, string>(units.map((u) => [u.id, u.name]));

  const consumptionTotalByItem = new Map<string, number>();
  const consumptionEventCountByItem = new Map<string, number>();
  const receiptTimeByPoAndItem = new Map<string, number>();

  for (const row of stockLedger) {
    if (!row.item_reference) continue;
    const createdAtMs = new Date(row.created_at || 0).getTime();

    if (row.transaction_type && CONSUMPTION_TYPES.has(row.transaction_type) && createdAtMs >= lookbackStartMs && createdAtMs <= asOfMs) {
      const qty = Math.abs(Number(row.quantity_change || 0));
      if (qty > 0) {
        consumptionTotalByItem.set(row.item_reference, (consumptionTotalByItem.get(row.item_reference) || 0) + qty);
        consumptionEventCountByItem.set(row.item_reference, (consumptionEventCountByItem.get(row.item_reference) || 0) + 1);
      }
    }

    if (row.transaction_type === "PO_RECEIPT" && row.reference_id) {
      const key = `${row.reference_id}::${row.item_reference}`;
      const existing = receiptTimeByPoAndItem.get(key);
      if (existing === undefined || createdAtMs < existing) receiptTimeByPoAndItem.set(key, createdAtMs);
    }
  }

  // purchased_item lookup by the base_ingredient/semi_product id it represents.
  const purchasedItemByItemRef = new Map<string, RawPurchasedItem>();
  for (const pi of purchasedItems) {
    if (pi.base_ingredient_id) purchasedItemByItemRef.set(pi.base_ingredient_id, pi);
    if (pi.semi_product_id) purchasedItemByItemRef.set(pi.semi_product_id, pi);
  }

  const activeConversionByPurchasedItemId = new Map<string, RawUomConversion>();
  for (const conv of uomConversions) {
    if (conv.status !== "ACTIVE") continue;
    if (!activeConversionByPurchasedItemId.has(conv.purchased_item_id)) {
      activeConversionByPurchasedItemId.set(conv.purchased_item_id, conv);
    }
  }

  const poById = new Map<string, RawPurchaseOrder>(purchaseOrders.map((po) => [po.id, po]));
  const purchasedItemById = new Map<string, RawPurchasedItem>(purchasedItems.map((pi) => [pi.id, pi]));

  const leadTimeSamplesByItemRef = new Map<string, number[]>();
  for (const line of purchaseOrderLines) {
    const po = poById.get(line.purchase_order_id);
    if (!po || po.status !== "COMPLETED") continue;
    const pi = line.purchased_item_id ? purchasedItemById.get(line.purchased_item_id) : undefined;
    const itemRef = pi?.base_ingredient_id || pi?.semi_product_id;
    if (!itemRef) continue;

    const receiptTime = receiptTimeByPoAndItem.get(`${po.id}::${itemRef}`);
    if (receiptTime === undefined) continue;

    const poCreatedAtMs = new Date(po.created_at || 0).getTime();
    const deltaDays = (receiptTime - poCreatedAtMs) / DAY_MS;
    if (!Number.isFinite(deltaDays) || deltaDays < 0) continue;

    const samples = leadTimeSamplesByItemRef.get(itemRef) ?? [];
    samples.push(deltaDays);
    leadTimeSamplesByItemRef.set(itemRef, samples);
  }

  const items: Array<(RawBaseIngredient | RawSemiProduct) & { itemType: ReorderItemType }> = [
    ...baseIngredients
      .filter((b) => b.is_non_inventory !== true && b.is_non_inventory !== "TRUE")
      .map((b) => ({ ...b, itemType: "BASE_INGREDIENT" as ReorderItemType })),
    ...semiProducts.map((s) => ({ ...s, itemType: "SEMI_PRODUCT" as ReorderItemType })),
  ];

  return items.map((item) => {
    const currentStock = balances.get(item.id) || 0;
    const eventCount = consumptionEventCountByItem.get(item.id) || 0;
    const hasSufficientData = eventCount >= MIN_CONSUMPTION_EVENTS;

    const avgDailyConsumption = hasSufficientData
      ? (consumptionTotalByItem.get(item.id) || 0) / lookbackDays
      : null;

    const leadTimeSamples = leadTimeSamplesByItemRef.get(item.id);
    const leadTimeDays = leadTimeSamples?.length
      ? leadTimeSamples.reduce((sum, d) => sum + d, 0) / leadTimeSamples.length
      : defaultLeadTimeDays;
    const leadTimeIsDefault = !leadTimeSamples?.length;

    const reorderPoint = avgDailyConsumption === null
      ? null
      : avgDailyConsumption * leadTimeDays * safetyBufferMultiplier;

    const isLowStock = reorderPoint !== null && currentStock <= reorderPoint;

    const suggestedReorderQtyBaseUnit = avgDailyConsumption === null
      ? null
      : Math.max(0, targetCoverageDays * avgDailyConsumption - currentStock);

    const purchasedItem = purchasedItemByItemRef.get(item.id);
    const conversion = purchasedItem ? activeConversionByPurchasedItemId.get(purchasedItem.id) : undefined;
    const conversionRate = conversion ? Number(conversion.conversion_rate) : null;
    const purchaseUnitName = conversion ? unitNameById.get(conversion.purchased_unit) ?? conversion.purchased_unit : null;
    const suggestedReorderQtyPurchaseUnit = suggestedReorderQtyBaseUnit !== null && conversionRate
      ? suggestedReorderQtyBaseUnit / conversionRate
      : null;

    return {
      itemId: item.id,
      itemName: item.name,
      itemType: item.itemType,
      baseUnitName: unitNameById.get(item.base_unit ?? "") ?? item.base_unit ?? "",
      currentStock,
      hasSufficientData,
      avgDailyConsumption,
      lookbackDays,
      leadTimeDays: avgDailyConsumption === null ? null : leadTimeDays,
      leadTimeIsDefault,
      safetyBufferMultiplier,
      reorderPoint,
      isLowStock,
      targetCoverageDays,
      suggestedReorderQtyBaseUnit,
      suggestedReorderQtyPurchaseUnit,
      purchaseUnitName,
      conversionRate,
    };
  });
}
