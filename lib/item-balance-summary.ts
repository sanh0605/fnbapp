/**
 * Splits per-item stock balances into two independent views.
 *
 * These were previously conflated in scripts/audit-full-history-recompute.ts,
 * where negatives were filtered out of the mismatch list. An item whose
 * theoretical and recorded balances agree is not a mismatch, so a negative
 * balance the system agrees with itself about could never be reported -- which
 * is exactly the case the owner was seeing on screen while audits read clean.
 */

export interface ItemBalanceRow {
  item: string;
  item_name: string;
  theoretical: number;
  recorded: number;
  delta: number;
}

export interface ItemBalanceSummary {
  mismatches: ItemBalanceRow[];
  negatives: ItemBalanceRow[];
}

export function summariseItemBalances(input: {
  theoreticalByItem: Map<string, number>;
  recordedByItem: Map<string, number>;
  nameOf: (id: string) => string;
  tolerance?: number;
}): ItemBalanceSummary {
  const tolerance = input.tolerance ?? 0.01;
  const allItemIds = new Set([
    ...input.theoreticalByItem.keys(),
    ...input.recordedByItem.keys(),
  ]);

  const mismatches: ItemBalanceRow[] = [];
  const negatives: ItemBalanceRow[] = [];

  for (const item of allItemIds) {
    const theoretical = input.theoreticalByItem.get(item) || 0;
    const recorded = input.recordedByItem.get(item) || 0;
    const row: ItemBalanceRow = {
      item,
      item_name: input.nameOf(item),
      theoretical,
      recorded,
      delta: theoretical - recorded,
    };

    if (Math.abs(row.delta) > tolerance) mismatches.push(row);
    // Evaluated over every item, never filtered through the mismatch list.
    if (theoretical < -tolerance) negatives.push(row);
  }

  mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  negatives.sort((a, b) => a.theoretical - b.theoretical);

  return { mismatches, negatives };
}
