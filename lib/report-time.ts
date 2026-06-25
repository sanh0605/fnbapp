/**
 * Timezone helpers for report date filters.
 *
 * Why: User-supplied date params (e.g., "2026-06-25") must be interpreted in
 * Asia/Saigon (UTC+7) so a Vietnamese business day maps to the correct UTC
 * range. Without this, "2026-06-25" becomes UTC midnight and misses the
 * first 7 hours of that Vietnamese business day.
 *
 * Claude code — Phase 5.3: document date range semantics and centralize.
 */

const SAIGON_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface UtcDateRange {
  startUtc: Date;
  endUtc: Date;
}

/**
 * Convert user input to UTC date range.
 *
 * Accepts:
 *   - Date-only "YYYY-MM-DD" → interpreted as Asia/Saigon start/end of day.
 *   - Full ISO "2026-06-25T17:00:00.000Z" → passed through unchanged.
 *
 * Returns null if either input is missing.
 */
export function toSaigonUtcRange(startDate?: string, endDate?: string): UtcDateRange | null {
  if (!startDate || !endDate) return null;

  return {
    startUtc: parseStart(startDate),
    endUtc: parseEnd(endDate),
  };
}

function parseStart(value: string): Date {
  const dateOnly = matchDateOnly(value);
  if (dateOnly) {
    const utcMs = Date.UTC(dateOnly.y, dateOnly.m, dateOnly.d, 0, 0, 0, 0) - SAIGON_OFFSET_MS;
    return new Date(utcMs);
  }
  return new Date(value);
}

function parseEnd(value: string): Date {
  const dateOnly = matchDateOnly(value);
  if (dateOnly) {
    const utcMs = Date.UTC(dateOnly.y, dateOnly.m, dateOnly.d, 23, 59, 59, 999) - SAIGON_OFFSET_MS;
    return new Date(utcMs);
  }
  return new Date(value);
}

function matchDateOnly(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}
