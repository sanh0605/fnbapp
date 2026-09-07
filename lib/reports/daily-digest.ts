// RPT-DIGEST-1 D1: daily summary date math + comparison deltas.
// feature 2.
//
// Pure computation, matching lib/reorder-suggestion.ts's convention: data
// fetching (getSalesDataV2 for each period) lives in the caller.

/** Shifts a "YYYY-MM-DD" date-only string by `days` (may be negative). */
export function shiftDateOnly(dateStr: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) throw new Error(`shiftDateOnly: expected YYYY-MM-DD, got "${dateStr}"`);
  const [, y, m, d] = match;
  // Noon UTC avoids any DST/timezone edge case affecting the calendar date
  // during simple day-count arithmetic -- we only care about the date part.
  const base = Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  const shifted = new Date(base + days * 24 * 60 * 60 * 1000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export interface DigestDateOffsets {
  today: string;
  yesterday: string;
  sameWeekdayLastWeek: string;
}

export function getDigestDateOffsets(dateStr: string): DigestDateOffsets {
  return {
    today: dateStr,
    yesterday: shiftDateOnly(dateStr, -1),
    sameWeekdayLastWeek: shiftDateOnly(dateStr, -7),
  };
}

export interface PeriodSummary {
  revenue: number;
  orderCount: number;
}

export interface PeriodComparison {
  revenueDeltaPct: number | null;
  orderCountDelta: number;
}

/** Null revenueDeltaPct when the comparison period had zero revenue (division undefined, not zero change). */
export function comparePeriods(current: PeriodSummary, previous: PeriodSummary): PeriodComparison {
  return {
    revenueDeltaPct: previous.revenue > 0 ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : null,
    orderCountDelta: current.orderCount - previous.orderCount,
  };
}
