/**
 * Pure comparison logic for scripts/verify-cogs.ts, split out so it is
 * testable without a live Supabase client (repo's existing -core.ts
 * convention, e.g. scripts/verify-revenue-core.ts).
 *
 * docs/superpowers/plans/2026-09-07-verify-cogs.md. Gate 2's challenger
 * (buildChallengerPurchases, buildChallengerIssues, computeWeightedAverage)
 * is an INDEPENDENT reimplementation of the same weighted-average-cost
 * arithmetic lib/costing/issue-costing.ts and
 * lib/costing/purchase-order-cost-allocation.ts already contain --
 * deliberately not imported from here. A check that called those same
 * functions would prove only that they are deterministic; it would stay
 * green on the day their arithmetic is wrong, which is exactly the failure
 * BR-COGS-006 describes. Two implementations that agree is evidence. One
 * implementation run twice is not. Do not "simplify" this file by importing
 * the shared helper.
 *
 * Every function here is pure: no I/O, no Supabase client. The script does
 * the fetching and printing.
 */

// ============================================================================
// Gate 1: every purchase reconciles to what was paid
// ============================================================================

export interface PurchaseOrderHeader {
  id: string;
  subtotal_amount: number;
  shipping_fee: number;
  tax_amount: number;
  voucher_amount: number;
  discount_amount: number;
  total_amount: number;
}

export interface PurchaseOrderLineRow {
  purchase_order_id: string;
  subtotal: number;
}

export interface ReconciliationMismatch {
  order_id: string;
  lineSubtotalSum: number;
  reconciled: number;
  total_amount: number;
}

export interface SubtotalMismatch {
  order_id: string;
  subtotal_amount: number;
  lineSubtotalSum: number;
}

export interface Gate1Result {
  reconciliationMismatches: ReconciliationMismatch[];
  subtotalMismatches: SubtotalMismatch[];
  ordersWithNoLines: string[];
  orderCount: number;
  lineCount: number;
  sumLineSubtotals: number;
  sumPaid: number;
}

export function checkPurchaseOrderReconciliation(
  orders: readonly PurchaseOrderHeader[],
  lines: readonly PurchaseOrderLineRow[],
): Gate1Result {
  const linesByOrder = new Map<string, PurchaseOrderLineRow[]>();
  for (const l of lines) {
    const arr = linesByOrder.get(l.purchase_order_id) ?? [];
    arr.push(l);
    linesByOrder.set(l.purchase_order_id, arr);
  }

  const reconciliationMismatches: ReconciliationMismatch[] = [];
  const subtotalMismatches: SubtotalMismatch[] = [];
  const ordersWithNoLines: string[] = [];
  let sumLineSubtotals = 0;
  let sumPaid = 0;

  for (const order of orders) {
    const orderLines = linesByOrder.get(order.id) ?? [];
    if (orderLines.length === 0) {
      ordersWithNoLines.push(order.id);
      continue;
    }
    const lineSubtotalSum = orderLines.reduce((s, l) => s + l.subtotal, 0);
    sumLineSubtotals += lineSubtotalSum;
    sumPaid += order.total_amount;

    const reconciled = lineSubtotalSum + order.shipping_fee + order.tax_amount - order.voucher_amount - order.discount_amount;
    if (reconciled !== order.total_amount) {
      reconciliationMismatches.push({ order_id: order.id, lineSubtotalSum, reconciled, total_amount: order.total_amount });
    }
    if (order.subtotal_amount !== lineSubtotalSum) {
      subtotalMismatches.push({ order_id: order.id, subtotal_amount: order.subtotal_amount, lineSubtotalSum });
    }
  }

  return {
    reconciliationMismatches,
    subtotalMismatches,
    ordersWithNoLines,
    orderCount: orders.length,
    lineCount: lines.length,
    sumLineSubtotals,
    sumPaid,
  };
}

// ============================================================================
// Gate 2: an independent weighted-average recomputation of issued cost
// ============================================================================

export interface ChallengerPurchase {
  purchased_item_id: string;
  at: string;
  base_quantity: number;
  subtotal: number;
}

export interface ChallengerIssue {
  purchased_item_id: string;
  at: string;
  base_quantity: number;
  source: "MANUAL" | "STOCKTAKE";
}

// BR-COGS-006: a purchased item's true cost is what was actually paid --
// shipping and tax included, vouchers and discounts subtracted -- allocated
// per line by its share of the order's line-subtotal sum, rounded, with any
// rounding residue placed on the line with the largest subtotal.
function allocateAdjustment(
  lineSubtotals: readonly { lineId: string; subtotal: number }[],
  adjustment: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (lineSubtotals.length === 0) return result;
  const sumSubtotal = lineSubtotals.reduce((s, l) => s + l.subtotal, 0);
  if (adjustment === 0 || sumSubtotal <= 0) {
    for (const l of lineSubtotals) result.set(l.lineId, l.subtotal);
    return result;
  }
  const shares = lineSubtotals.map(l => Math.round((adjustment * l.subtotal) / sumSubtotal));
  const sumShares = shares.reduce((s, v) => s + v, 0);
  const residue = adjustment - sumShares;
  if (residue !== 0) {
    let largestIndex = 0;
    for (let i = 1; i < lineSubtotals.length; i++) {
      if (lineSubtotals[i].subtotal > lineSubtotals[largestIndex].subtotal) largestIndex = i;
    }
    shares[largestIndex] += residue;
  }
  return new Map(lineSubtotals.map((l, i) => [l.lineId, l.subtotal + shares[i]]));
}

export function buildChallengerPurchases(
  orders: readonly (PurchaseOrderHeader & { status: string; transaction_date: string; created_at: string })[],
  lines: readonly (PurchaseOrderLineRow & { id: string; purchased_item_id: string; base_quantity: number })[],
): ChallengerPurchase[] {
  const completedById = new Map(orders.filter(o => o.status === "COMPLETED").map(o => [o.id, o]));
  const linesByOrder = new Map<string, typeof lines[number][]>();
  for (const l of lines) {
    if (!completedById.has(l.purchase_order_id)) continue;
    const arr = linesByOrder.get(l.purchase_order_id) ?? [];
    arr.push(l);
    linesByOrder.set(l.purchase_order_id, arr);
  }

  const result: ChallengerPurchase[] = [];
  for (const [orderId, orderLines] of linesByOrder) {
    const order = completedById.get(orderId)!;
    const adjustment = order.shipping_fee + order.tax_amount - order.voucher_amount - order.discount_amount;
    const adjusted = allocateAdjustment(orderLines.map(l => ({ lineId: l.id, subtotal: l.subtotal })), adjustment);
    for (const l of orderLines) {
      result.push({
        purchased_item_id: l.purchased_item_id,
        at: order.transaction_date || order.created_at,
        base_quantity: l.base_quantity,
        subtotal: adjusted.get(l.id) ?? l.subtotal,
      });
    }
  }
  return result;
}

export function buildChallengerIssues(
  stockIssues: readonly { purchased_item_id: string; issued_at: string; base_quantity: number; source: "MANUAL" | "STOCKTAKE" }[],
  purchasedItems: readonly { id: string; item_category_id: string; is_non_inventory?: unknown }[],
  itemCategories: readonly { id: string; system_type: string }[],
): ChallengerIssue[] {
  const equipmentCategoryIds = new Set(itemCategories.filter(c => c.system_type === "EQUIPMENT").map(c => c.id));
  const excludedItemIds = new Set(
    purchasedItems
      .filter(p =>
        equipmentCategoryIds.has(p.item_category_id) ||
        // BR-COGS-007, 2026-09-11: bought for immediate use, counted when
        // bought. Written out again here on purpose -- see the header.
        p.is_non_inventory === true || p.is_non_inventory === "TRUE")
      .map(p => p.id),
  );
  return stockIssues
    .filter(row => !excludedItemIds.has(row.purchased_item_id))
    .map(row => ({
      purchased_item_id: row.purchased_item_id,
      at: row.issued_at,
      base_quantity: row.base_quantity,
      source: row.source,
    }));
}

export interface ItemIssuedValue {
  purchased_item_id: string;
  issued_value: number;
}

export interface IssueEventValue {
  purchased_item_id: string;
  source: "MANUAL" | "STOCKTAKE";
  value: number;
}

export interface WeightedAverageResult {
  byItem: ItemIssuedValue[];
  byEvent: IssueEventValue[];
  total: number;
}

type Event =
  | { kind: "purchase"; atMs: number; seq: number; base_quantity: number; subtotal: number }
  | { kind: "issue"; atMs: number; seq: number; base_quantity: number; source: "MANUAL" | "STOCKTAKE" };

function eventOrder(event: Event): number {
  return event.kind === "purchase" ? 0 : 1;
}

// Independent weighted-average moving-inventory replay, per BR-COGS-005: a
// purchase adds to the pool at its own price; an issue draws at the current
// pool average; a negative base_quantity ("found stock", BR-INV-008) adds
// back at the current average (or the last known rate if the pool is
// empty). Same event-ordering rule as the shared implementation this
// deliberately does not import: purchase before issue on a tie, then input
// order.
//
// Values every issue event within ONE combined replay (both sources
// together, matching what getPnLDataV2 actually feeds computeIssueCosting)
// and tags each event's own value with its source -- summing MANUAL-tagged
// and STOCKTAKE-tagged separately gives the true split of the real total,
// unlike replaying each source's subset alone, which would change every
// later event's pool average and answer a different, hypothetical question.
export function computeWeightedAverageIssuedValue(
  purchases: readonly ChallengerPurchase[],
  issues: readonly { purchased_item_id: string; at: string; base_quantity: number; source: "MANUAL" | "STOCKTAKE" }[],
): WeightedAverageResult {
  const eventsByItem = new Map<string, Event[]>();
  let seq = 0;
  for (const p of purchases) {
    const list = eventsByItem.get(p.purchased_item_id) ?? [];
    list.push({ kind: "purchase", atMs: new Date(p.at).getTime(), seq: seq++, base_quantity: p.base_quantity, subtotal: p.subtotal });
    eventsByItem.set(p.purchased_item_id, list);
  }
  for (const i of issues) {
    const list = eventsByItem.get(i.purchased_item_id) ?? [];
    list.push({ kind: "issue", atMs: new Date(i.at).getTime(), seq: seq++, base_quantity: i.base_quantity, source: i.source });
    eventsByItem.set(i.purchased_item_id, list);
  }

  const byItem: ItemIssuedValue[] = [];
  const byEvent: IssueEventValue[] = [];
  let total = 0;

  for (const [purchasedItemId, events] of eventsByItem) {
    events.sort((a, b) => a.atMs - b.atMs || eventOrder(a) - eventOrder(b) || a.seq - b.seq);
    let quantity = 0;
    let value = 0;
    let lastUnitCost: number | null = null;
    let issuedValue = 0;

    for (const event of events) {
      if (event.kind === "purchase") {
        quantity += event.base_quantity;
        value += event.subtotal;
        continue;
      }
      if (event.base_quantity > 0) {
        if (quantity <= 0) {
          throw new Error(`${purchasedItemId}: issue precedes any purchase`);
        }
        if (event.base_quantity > quantity) {
          throw new Error(`${purchasedItemId}: issue exceeds quantity on hand`);
        }
        const unitCost = value / quantity;
        lastUnitCost = unitCost;
        const thisIssueValue = unitCost * event.base_quantity;
        quantity -= event.base_quantity;
        value -= thisIssueValue;
        if (quantity === 0) value = 0;
        issuedValue += thisIssueValue;
        byEvent.push({ purchased_item_id: purchasedItemId, source: event.source, value: thisIssueValue });
        total += thisIssueValue;
      } else if (event.base_quantity < 0) {
        if (quantity <= 0 && lastUnitCost === null) {
          throw new Error(`${purchasedItemId}: found stock has no purchase to value it against`);
        }
        const foundQuantity = -event.base_quantity;
        const foundUnitCost = quantity > 0 ? value / quantity : lastUnitCost!;
        quantity += foundQuantity;
        value += foundQuantity * foundUnitCost;
        const reversedValue = -(foundQuantity * foundUnitCost);
        issuedValue += reversedValue;
        byEvent.push({ purchased_item_id: purchasedItemId, source: event.source, value: reversedValue });
        total += reversedValue;
      }
    }
    byItem.push({ purchased_item_id: purchasedItemId, issued_value: issuedValue });
  }
  return { byItem, byEvent, total };
}

// ============================================================================
// Reported, never red: the MANUAL/STOCKTAKE split, and the BR-COGS-007 gap
// ============================================================================

export interface ShrinkageSplit {
  manualCount: number;
  stocktakeCount: number;
  manualValue: number;
  stocktakeValue: number;
  totalValue: number;
}

export function splitIssuedValueBySource(
  issues: readonly { source: "MANUAL" | "STOCKTAKE" }[],
  byEvent: readonly IssueEventValue[],
): ShrinkageSplit {
  const manualCount = issues.filter(i => i.source === "MANUAL").length;
  const stocktakeCount = issues.filter(i => i.source === "STOCKTAKE").length;
  let manualValue = 0;
  let stocktakeValue = 0;
  for (const e of byEvent) {
    if (e.source === "MANUAL") manualValue += e.value;
    else stocktakeValue += e.value;
  }
  return { manualCount, stocktakeCount, manualValue, stocktakeValue, totalValue: manualValue + stocktakeValue };
}
