/**
 * Shared routine-vs-anomalous classification for the automatic backdated-
 * event cron sweep (both PO_RECEIPT-style backdated_ledger_events and
 * recipe-version-style backdated_recipe_events use this same function and
 * the same thresholds, so one review of these three numbers covers both
 * event kinds).
 *
 * Thresholds were picked from the 2026-07-20 historical correction's actual,
 * reviewed, accepted numbers: the largest single event corrected 6,819 VND
 * across 19 lines, and the largest single-line delta was about 7% of that
 * line's cost. These limits comfortably clear all of that while still
 * catching something genuinely unusual.
 */

export type AnomalyPlanChange = {
  line_id: string;
  old_cost_at_sale: number;
  new_cost_at_sale: number;
};

export type AnomalyClassification = {
  isAnomalous: boolean;
  reason: string | null;
};

export const MAX_TOTAL_DELTA_VND = 20000;
export const MAX_SINGLE_LINE_DELTA_RATIO = 0.2;
export const MAX_AFFECTED_LINES = 20;

export function classifyBackdatedEventPlan(changes: AnomalyPlanChange[]): AnomalyClassification {
  if (changes.length > MAX_AFFECTED_LINES) {
    return {
      isAnomalous: true,
      reason: `Affects ${changes.length} lines, exceeding the ${MAX_AFFECTED_LINES}-line routine threshold`,
    };
  }

  const totalDeltaVnd = changes.reduce((sum, change) => sum + (change.new_cost_at_sale - change.old_cost_at_sale), 0);
  if (Math.abs(totalDeltaVnd) > MAX_TOTAL_DELTA_VND) {
    return {
      isAnomalous: true,
      reason: `Total delta ${totalDeltaVnd} VND exceeds the ${MAX_TOTAL_DELTA_VND} VND routine threshold`,
    };
  }

  for (const change of changes) {
    if (change.old_cost_at_sale === 0) continue;
    const ratio = Math.abs(change.new_cost_at_sale - change.old_cost_at_sale) / change.old_cost_at_sale;
    if (ratio > MAX_SINGLE_LINE_DELTA_RATIO) {
      return {
        isAnomalous: true,
        reason: `Line ${change.line_id} cost changed by ${(ratio * 100).toFixed(1)}%, exceeding the ${MAX_SINGLE_LINE_DELTA_RATIO * 100}% routine threshold`,
      };
    }
  }

  return { isAnomalous: false, reason: null };
}
