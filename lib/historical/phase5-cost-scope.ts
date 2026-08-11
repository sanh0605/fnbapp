import { toSaigonIsoString } from "../datetime";

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

// Owner correction 2026-07-30: was 1 dong, matched to the audit's own
// no-op threshold when cost_at_sale was a whole-VND bigint. Now numeric(18,6)
// with Math.round removed from the engine (docs/superpowers/plans/2026-07-
// 30-exact-cost-precision.md), the residual that plan corrects is always
// < 0.5 dong -- callers already filter their own candidates against the
// same 1e-6 threshold (scripts/apply-phase5-cost-rebuild.ts's
// CHANGE_THRESHOLD_VND, scripts/audit-full-history-recompute.ts's
// COST_MISMATCH_THRESHOLD_VND) before reaching this function, but this
// function re-filtered with the stale 1-dong value regardless of what its
// caller already decided, silently discarding most of them a second time.
export function groupCostChangesByMonth(input: CostChangeInput[]): MonthlyCostBatch[] {
  const NO_OP_THRESHOLD_VND = 1e-6;
  const byMonth = new Map<string, MonthlyCostBatch>();
  for (const change of input) {
    const delta = change.new_cost_at_sale - change.old_cost_at_sale;
    if (Math.abs(delta) <= NO_OP_THRESHOLD_VND) continue;
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
