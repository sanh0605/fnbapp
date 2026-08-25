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

const SAIGON_TZ = "Asia/Ho_Chi_Minh";

// Sunday = 0, matching both Date.getUTCDay() and the "CN" (Chu Nhat) first
// convention every day-of-week label array in this codebase already uses.
const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export interface SaigonBucketKeys {
  dateKey: string;  // "2026-08-01"
  monthKey: string; // "2026-08"
  dowLabel: string; // "T6", Sunday = "CN"
  hourKey: string;  // "06:00"
}

/**
 * Derives the Saigon calendar date/month/day-of-week/hour a timestamp falls
 * on, for chart bucketing. docs/superpowers/plans/2026-08-26-sales-chart-
 * timezone.md: app/admin/reports/actions.ts previously bucketed with
 * toISOString() (UTC) and getDay()/getHours() (the runtime's local zone,
 * UTC on Vercel) -- both wrong by the same 7-hour Saigon offset. One
 * helper for all four series, so they cannot drift apart from each other
 * again.
 */
export function saigonBucketKeys(iso: string): SaigonBucketKeys {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAIGON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "00";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some runtimes emit 24 for midnight, same guard as lib/datetime.ts

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  // Day of week from the Y/M/D components via Date.UTC + getUTCDay(), never
  // from the original timestamp's own getDay() -- reading that is exactly
  // the bug being fixed, since it reads the runtime's local zone.
  const dowLabel = DOW_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return {
    dateKey: `${year}-${mm}-${dd}`,
    monthKey: `${year}-${mm}`,
    dowLabel,
    hourKey: `${String(hour).padStart(2, "0")}:00`,
  };
}
