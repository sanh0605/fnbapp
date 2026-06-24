type RawPurchaseOrder = {
  id: string;
  status?: string;
  subtotal_amount?: string | number;
  shipping_fee?: string | number;
  tax_amount?: string | number;
  voucher_amount?: string | number;
  discount_amount?: string | number;
  transaction_date?: string;
  created_at?: string;
};

type RawPurchaseOrderLine = {
  id: string;
  po_id?: string;
  purchase_order_id?: string;
  purchased_item_id?: string;
  item_id?: string;
  unit?: string;
  unit_id?: string;
  quantity?: string | number;
  subtotal?: string | number;
  conversion_id?: string;
};

type RawPurchasedItem = {
  id: string;
  name?: string;
  base_ingredient_id?: string;
};

type RawConversion = {
  id: string;
  purchased_item_id?: string;
  purchased_unit?: string;
  conversion_rate?: string | number;
};

type RawLedgerEntry = {
  id: string;
  transaction_type?: string;
  reference_id?: string;
  item_reference?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
};

export type PurchaseLedgerSafeBackfill = {
  line_id: string;
  po_id: string;
  purchased_item_id: string;
  unit: string;
  conversion_id: string;
  conversion_rate: number;
};

export type PurchaseLedgerAmbiguousLine = {
  line_id: string;
  po_id: string;
  purchased_item_id: string;
  unit: string;
  candidate_conversion_ids: string[];
};

export type PurchaseLedgerMissingConversion = {
  line_id: string;
  po_id: string;
  purchased_item_id: string;
  unit: string;
};

export type PurchaseLedgerMismatch = {
  po_id: string;
  item_reference: string;
  expected_quantity: number;
  actual_quantity: number;
  expected_unit_cost: number;
  actual_unit_cost: number;
  expected_total_cost: number;
  actual_total_cost: number;
  delta_quantity: number;
  delta_total_cost: number;
};

export type PurchaseLedgerAuditReport = {
  completedPoCount: number;
  lineCount: number;
  expectedLedgerGroupCount: number;
  actualLedgerGroupCount: number;
  safeBackfills: PurchaseLedgerSafeBackfill[];
  ambiguousLines: PurchaseLedgerAmbiguousLine[];
  missingConversions: PurchaseLedgerMissingConversion[];
  ledgerMismatches: PurchaseLedgerMismatch[];
};

type ExpectedLedgerGroup = {
  po_id: string;
  item_reference: string;
  quantity: number;
  total_cost: number;
};

type ActualLedgerGroup = {
  po_id: string;
  item_reference: string;
  quantity: number;
  total_cost: number;
};

export function auditPurchaseLedger(input: {
  purchaseOrders: RawPurchaseOrder[];
  purchaseOrderLines: RawPurchaseOrderLine[];
  purchasedItems: RawPurchasedItem[];
  conversions: RawConversion[];
  stockLedger: RawLedgerEntry[];
  mismatchThreshold?: number;
}): PurchaseLedgerAuditReport {
  const mismatchThreshold = input.mismatchThreshold ?? 0.0001;
  const completedOrders = input.purchaseOrders.filter(po => po.status === "COMPLETED");
  const orderMap = new Map(completedOrders.map(po => [po.id, po]));
  const itemMap = new Map(input.purchasedItems.map(item => [item.id, item]));
  const conversionMap = new Map(input.conversions.map(conversion => [conversion.id, conversion]));
  const expectedGroups = new Map<string, ExpectedLedgerGroup>();
  const safeBackfills: PurchaseLedgerSafeBackfill[] = [];
  const ambiguousLines: PurchaseLedgerAmbiguousLine[] = [];
  const missingConversions: PurchaseLedgerMissingConversion[] = [];
  let lineCount = 0;

  for (const line of input.purchaseOrderLines) {
    const poId = getPoId(line);
    const po = orderMap.get(poId);
    if (!po) continue;
    lineCount += 1;

    const purchasedItemId = getPurchasedItemId(line);
    const item = itemMap.get(purchasedItemId);
    if (!item) continue;

    const conversion = resolveConversion(line, input.conversions, conversionMap);
    if (conversion.kind === "safe_backfill") {
      safeBackfills.push({
        line_id: line.id,
        po_id: poId,
        purchased_item_id: purchasedItemId,
        unit: getLineUnit(line),
        conversion_id: conversion.conversion.id,
        conversion_rate: Number(conversion.conversion.conversion_rate) || 0,
      });
    } else if (conversion.kind === "ambiguous") {
      ambiguousLines.push({
        line_id: line.id,
        po_id: poId,
        purchased_item_id: purchasedItemId,
        unit: getLineUnit(line),
        candidate_conversion_ids: conversion.candidates.map(candidate => candidate.id),
      });
      continue;
    } else if (conversion.kind === "missing") {
      missingConversions.push({
        line_id: line.id,
        po_id: poId,
        purchased_item_id: purchasedItemId,
        unit: getLineUnit(line),
      });
      continue;
    }

    const itemReference = item.base_ingredient_id || purchasedItemId;
    const conversionRate = item.base_ingredient_id ? Number(conversion.conversion.conversion_rate) || 0 : 1;
    const quantity = Number(line.quantity) || 0;
    const quantityChange = quantity * conversionRate;
    const landedCost = calculateLineLandedCost(po, line);
    const group = getExpectedGroup(expectedGroups, poId, itemReference);
    group.quantity += quantityChange;
    group.total_cost += landedCost;
  }

  const actualGroups = buildActualLedgerGroups(input.stockLedger, orderMap);
  const ledgerMismatches = compareGroups(expectedGroups, actualGroups, mismatchThreshold);

  return {
    completedPoCount: completedOrders.length,
    lineCount,
    expectedLedgerGroupCount: expectedGroups.size,
    actualLedgerGroupCount: actualGroups.size,
    safeBackfills,
    ambiguousLines,
    missingConversions,
    ledgerMismatches,
  };
}

function resolveConversion(
  line: RawPurchaseOrderLine,
  conversions: RawConversion[],
  conversionMap: Map<string, RawConversion>,
):
  | { kind: "resolved"; conversion: RawConversion }
  | { kind: "safe_backfill"; conversion: RawConversion }
  | { kind: "ambiguous"; candidates: RawConversion[] }
  | { kind: "missing" } {
  const conversionId = String(line.conversion_id || "").trim();
  if (conversionId) {
    const conversion = conversionMap.get(conversionId);
    return conversion ? { kind: "resolved", conversion } : { kind: "missing" };
  }

  const purchasedItemId = getPurchasedItemId(line);
  const unit = normalizeUnit(getLineUnit(line));
  const candidates = conversions.filter(conversion =>
    conversion.purchased_item_id === purchasedItemId &&
    normalizeUnit(conversion.purchased_unit || "") === unit,
  );

  if (candidates.length === 1) return { kind: "safe_backfill", conversion: candidates[0] };
  if (candidates.length > 1) return { kind: "ambiguous", candidates };
  return { kind: "missing" };
}

function calculateLineLandedCost(po: RawPurchaseOrder, line: RawPurchaseOrderLine): number {
  const subtotalAmount = Number(po.subtotal_amount) || 0;
  const lineSubtotal = Number(line.subtotal) || 0;
  const totalExtraCosts =
    (Number(po.shipping_fee) || 0) +
    (Number(po.tax_amount) || 0) -
    (Number(po.voucher_amount) || 0) -
    (Number(po.discount_amount) || 0);
  const allocatedExtra = subtotalAmount > 0 ? totalExtraCosts * (lineSubtotal / subtotalAmount) : 0;
  return lineSubtotal + allocatedExtra;
}

function buildActualLedgerGroups(
  ledger: RawLedgerEntry[],
  orderMap: Map<string, RawPurchaseOrder>,
): Map<string, ActualLedgerGroup> {
  const groups = new Map<string, ActualLedgerGroup>();
  for (const entry of ledger) {
    if (entry.transaction_type !== "PO_RECEIPT") continue;
    const poId = entry.reference_id || "";
    if (!orderMap.has(poId)) continue;
    const itemReference = entry.item_reference || "";
    const key = groupKey(poId, itemReference);
    let group = groups.get(key);
    if (!group) {
      group = { po_id: poId, item_reference: itemReference, quantity: 0, total_cost: 0 };
      groups.set(key, group);
    }
    const quantity = Number(entry.quantity_change) || 0;
    const unitCost = Number(entry.unit_cost) || 0;
    group.quantity += quantity;
    group.total_cost += quantity * unitCost;
  }
  return groups;
}

function compareGroups(
  expectedGroups: Map<string, ExpectedLedgerGroup>,
  actualGroups: Map<string, ActualLedgerGroup>,
  mismatchThreshold: number,
): PurchaseLedgerMismatch[] {
  const keys = new Set([...expectedGroups.keys(), ...actualGroups.keys()]);
  const mismatches: PurchaseLedgerMismatch[] = [];
  for (const key of keys) {
    const expected = expectedGroups.get(key);
    const actual = actualGroups.get(key);
    const expectedQuantity = expected?.quantity || 0;
    const actualQuantity = actual?.quantity || 0;
    const expectedTotalCost = expected?.total_cost || 0;
    const actualTotalCost = actual?.total_cost || 0;
    const deltaQuantity = expectedQuantity - actualQuantity;
    const deltaTotalCost = expectedTotalCost - actualTotalCost;
    if (Math.abs(deltaQuantity) <= mismatchThreshold && Math.abs(deltaTotalCost) <= mismatchThreshold) {
      continue;
    }
    const poId = expected?.po_id || actual?.po_id || "";
    const itemReference = expected?.item_reference || actual?.item_reference || "";
    mismatches.push({
      po_id: poId,
      item_reference: itemReference,
      expected_quantity: expectedQuantity,
      actual_quantity: actualQuantity,
      expected_unit_cost: expectedQuantity > 0 ? expectedTotalCost / expectedQuantity : 0,
      actual_unit_cost: actualQuantity > 0 ? actualTotalCost / actualQuantity : 0,
      expected_total_cost: expectedTotalCost,
      actual_total_cost: actualTotalCost,
      delta_quantity: deltaQuantity,
      delta_total_cost: deltaTotalCost,
    });
  }
  return mismatches.sort((a, b) =>
    Math.abs(b.delta_total_cost) - Math.abs(a.delta_total_cost) ||
    Math.abs(b.delta_quantity) - Math.abs(a.delta_quantity),
  );
}

function getExpectedGroup(groups: Map<string, ExpectedLedgerGroup>, poId: string, itemReference: string) {
  const key = groupKey(poId, itemReference);
  let group = groups.get(key);
  if (!group) {
    group = { po_id: poId, item_reference: itemReference, quantity: 0, total_cost: 0 };
    groups.set(key, group);
  }
  return group;
}

function getPoId(line: RawPurchaseOrderLine): string {
  return line.po_id || line.purchase_order_id || "";
}

function getPurchasedItemId(line: RawPurchaseOrderLine): string {
  return line.purchased_item_id || line.item_id || "";
}

function getLineUnit(line: RawPurchaseOrderLine): string {
  return line.unit || line.unit_id || "";
}

function normalizeUnit(unit: string): string {
  return String(unit).trim().toLowerCase();
}

function groupKey(poId: string, itemReference: string): string {
  return `${poId}\u0000${itemReference}`;
}
