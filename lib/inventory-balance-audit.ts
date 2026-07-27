/**
 * Read-only drift audit: compares stock_ledger's summed quantity_change per
 * item against the materialized inventory_balances table (migration 0038).
 * stock_ledger is the source of truth -- any disagreement means the
 * trigger-maintained balance has drifted and needs `rebuild_inventory_balances()`.
 */

export interface InventoryBalanceAuditLedgerRow {
  item_reference: string;
  quantity_change: number | string;
}

export interface InventoryBalanceAuditBalanceRow {
  item_reference: string;
  quantity: number | string;
}

export interface InventoryBalanceMismatch {
  item_reference: string;
  reason: "missing" | "extra" | "delta";
  expected: number;
  actual: number;
  delta: number;
}

export interface InventoryBalanceAuditResult {
  itemCount: number;
  mismatchCount: number;
  mismatches: InventoryBalanceMismatch[];
}

const DEFAULT_TOLERANCE = 0.000001;

export function auditInventoryBalances(
  ledgerRows: InventoryBalanceAuditLedgerRow[],
  balanceRows: InventoryBalanceAuditBalanceRow[],
  tolerance: number = DEFAULT_TOLERANCE,
): InventoryBalanceAuditResult {
  const expectedByItem = new Map<string, number>();
  for (const row of ledgerRows) {
    const itemReference = String(row.item_reference || "").trim();
    if (!itemReference) continue;
    const delta = Number(row.quantity_change) || 0;
    expectedByItem.set(itemReference, (expectedByItem.get(itemReference) || 0) + delta);
  }

  const actualByItem = new Map<string, number>();
  for (const row of balanceRows) {
    const itemReference = String(row.item_reference || "").trim();
    if (!itemReference) continue;
    actualByItem.set(itemReference, Number(row.quantity) || 0);
  }

  const allItems = new Set<string>([...expectedByItem.keys(), ...actualByItem.keys()]);
  const mismatches: InventoryBalanceMismatch[] = [];

  for (const itemReference of allItems) {
    const hasExpected = expectedByItem.has(itemReference);
    const hasActual = actualByItem.has(itemReference);
    const expected = expectedByItem.get(itemReference) || 0;
    const actual = actualByItem.get(itemReference) || 0;

    if (!hasActual) {
      mismatches.push({ item_reference: itemReference, reason: "missing", expected, actual: 0, delta: -expected });
      continue;
    }
    if (!hasExpected) {
      mismatches.push({ item_reference: itemReference, reason: "extra", expected: 0, actual, delta: actual });
      continue;
    }
    const delta = actual - expected;
    if (Math.abs(delta) > tolerance) {
      mismatches.push({ item_reference: itemReference, reason: "delta", expected, actual, delta });
    }
  }

  return {
    itemCount: allItems.size,
    mismatchCount: mismatches.length,
    mismatches,
  };
}
