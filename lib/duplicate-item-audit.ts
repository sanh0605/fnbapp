/**
 * Diagnostic for the "duplicate purchased-item record" hypothesis: an
 * ingredient purchased under one item id but consumed by recipes under a
 * different id with the same real-world name, so the two never reconcile
 * and one side looks like a bottomless negative balance.
 *
 * A raw ledger negative alone cannot distinguish "nothing was ever
 * purchased" from "it was purchased under a twin record" -- this module
 * makes that distinction visible by comparing purchased vs consumed
 * quantity per item id, then matching id pairs that only differ in id but
 * share the same normalised name.
 */

export interface DuplicateItemRow {
  item: string;
  item_name: string;
  purchased_qty: number;
  consumed_qty: number;
}

export interface NameTwinPair {
  normalized_name: string;
  consumedItem: DuplicateItemRow;
  purchasedItem: DuplicateItemRow;
}

export interface DuplicateItemAuditResult {
  consumedNeverPurchased: DuplicateItemRow[];
  purchasedNeverConsumed: DuplicateItemRow[];
  nameTwins: NameTwinPair[];
}

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function auditDuplicateItems(input: {
  itemIds: string[];
  nameOf: (id: string) => string;
  purchasedByItem: Map<string, number>;
  consumedByItem: Map<string, number>;
  tolerance?: number;
}): DuplicateItemAuditResult {
  const tolerance = input.tolerance ?? 0.001;
  const uniqueIds = [...new Set(input.itemIds)];

  const consumedNeverPurchased: DuplicateItemRow[] = [];
  const purchasedNeverConsumed: DuplicateItemRow[] = [];

  for (const item of uniqueIds) {
    const purchased_qty = input.purchasedByItem.get(item) || 0;
    const consumed_qty = input.consumedByItem.get(item) || 0;
    const row: DuplicateItemRow = { item, item_name: input.nameOf(item), purchased_qty, consumed_qty };

    if (consumed_qty > tolerance && purchased_qty <= tolerance) consumedNeverPurchased.push(row);
    if (purchased_qty > tolerance && consumed_qty <= tolerance) purchasedNeverConsumed.push(row);
  }

  const nameTwins: NameTwinPair[] = [];
  for (const consumedItem of consumedNeverPurchased) {
    const normalized = normalizeName(consumedItem.item_name);
    const purchasedItem = purchasedNeverConsumed.find(
      candidate => normalizeName(candidate.item_name) === normalized,
    );
    if (purchasedItem) {
      nameTwins.push({ normalized_name: normalized, consumedItem, purchasedItem });
    }
  }

  return { consumedNeverPurchased, purchasedNeverConsumed, nameTwins };
}
