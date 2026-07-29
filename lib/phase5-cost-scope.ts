import { toSaigonIsoString } from "./datetime";

export type CostChangeInput = {
  line_id: string;
  sale_time: string;
  old_cost_at_sale: number;
  new_cost_at_sale: number;
};

export type MonthlyCostBatch = {
  month: string; // "YYYY-MM", Saigon calendar
  changes: Array<{ line_id: string; old_cost_at_sale: number; new_cost_at_sale: number }>;
  net_delta: number;
};

/**
 * The audit's own no-op threshold is one dong (scripts/audit-full-history-
 * recompute.ts:106). Match it exactly so this phase never writes a line the
 * audit does not consider mismatched.
 */
export function groupCostChangesByMonth(input: CostChangeInput[]): MonthlyCostBatch[] {
  const byMonth = new Map<string, MonthlyCostBatch>();
  for (const change of input) {
    const delta = change.new_cost_at_sale - change.old_cost_at_sale;
    if (Math.abs(delta) <= 1) continue;
    const month = toSaigonIsoString(new Date(change.sale_time)).slice(0, 7);
    const batch = byMonth.get(month) || { month, changes: [], net_delta: 0 };
    batch.changes.push({
      line_id: change.line_id,
      old_cost_at_sale: change.old_cost_at_sale,
      new_cost_at_sale: change.new_cost_at_sale,
    });
    batch.net_delta += delta;
    byMonth.set(month, batch);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}
