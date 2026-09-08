export const DATE_RANGE_PRESETS = [
  { key: "TODAY", label: "Hôm nay" },
  { key: "YESTERDAY", label: "Hôm qua" },
  { key: "LAST_7_DAYS", label: "7 ngày qua" },
  { key: "LAST_28_DAYS", label: "28 ngày qua" },
  { key: "LAST_30_DAYS", label: "30 ngày qua" },
  { key: "THIS_WEEK", label: "Tuần này" },
  { key: "LAST_WEEK", label: "Tuần trước" },
  { key: "THIS_MONTH", label: "Tháng này" },
  { key: "LAST_MONTH", label: "Tháng trước" },
  { key: "THIS_QUARTER", label: "Quý này" },
  { key: "LAST_QUARTER", label: "Quý trước" },
  { key: "THIS_YEAR", label: "Năm nay" },
  { key: "LAST_YEAR", label: "Năm trước" },
  { key: "MONTH_TO_DATE", label: "Từ đầu tháng đến nay" },
  { key: "YEAR_TO_DATE", label: "Từ đầu năm đến nay" },
  { key: "CUSTOM", label: "Tuỳ chọn" },
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];
export type DateRangePresetKey = DateRangePreset["key"];

export interface DateRange {
  // Both ends inclusive, "YYYY-MM-DD".
  start: string;
  end: string;
}

// All arithmetic runs in UTC on a calendar date with no time of day, so the
// answer never depends on where the process happens to be running: Vercel is
// on UTC, the owner's machine is on Asia/Saigon.
function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}

const startOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;

function endOfMonthOf(year: number, monthIndex: number): string {
  // Day 0 of the next month is the last day of this one -- correct for
  // February in a leap year without a table of month lengths.
  return fmt(new Date(Date.UTC(year, monthIndex + 1, 0)));
}

function endOfMonth(iso: string): string {
  const d = toUtc(iso);
  return endOfMonthOf(d.getUTCFullYear(), d.getUTCMonth());
}

// Monday-first, matching how the shop reads a week.
function startOfWeek(iso: string): string {
  const shift = (toUtc(iso).getUTCDay() + 6) % 7;
  return addDays(iso, -shift);
}

export function resolvePreset(key: DateRangePresetKey, today: string): DateRange {
  const yesterday = addDays(today, -1);
  const d = toUtc(today);
  const year = d.getUTCFullYear();
  const quarterFirstMonth = Math.floor(d.getUTCMonth() / 3) * 3;

  switch (key) {
    case "TODAY": return { start: today, end: today };
    case "YESTERDAY": return { start: yesterday, end: yesterday };
    case "LAST_7_DAYS": return { start: addDays(yesterday, -6), end: yesterday };
    case "LAST_28_DAYS": return { start: addDays(yesterday, -27), end: yesterday };
    case "LAST_30_DAYS": return { start: addDays(yesterday, -29), end: yesterday };
    case "THIS_WEEK": {
      const s = startOfWeek(today);
      return { start: s, end: addDays(s, 6) };
    }
    case "LAST_WEEK": {
      const s = addDays(startOfWeek(today), -7);
      return { start: s, end: addDays(s, 6) };
    }
    case "THIS_MONTH": return { start: startOfMonth(today), end: endOfMonth(today) };
    case "LAST_MONTH": {
      const prev = addDays(startOfMonth(today), -1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case "THIS_QUARTER": return {
      start: fmt(new Date(Date.UTC(year, quarterFirstMonth, 1))),
      end: endOfMonthOf(year, quarterFirstMonth + 2),
    };
    case "LAST_QUARTER": {
      // Subtract three months from the first month of this quarter; Date.UTC
      // normalises a negative month index back into the previous year.
      const s = new Date(Date.UTC(year, quarterFirstMonth - 3, 1));
      return {
        start: fmt(s),
        end: endOfMonthOf(s.getUTCFullYear(), s.getUTCMonth() + 2),
      };
    }
    case "THIS_YEAR": return { start: `${year}-01-01`, end: `${year}-12-31` };
    case "LAST_YEAR": return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
    case "MONTH_TO_DATE": return { start: startOfMonth(today), end: today };
    case "YEAR_TO_DATE": return { start: `${year}-01-01`, end: today };
    case "CUSTOM": return { start: "", end: "" };
  }
}

const vn = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export function formatRangeLabel(start: string, end: string): string {
  if (!start || !end) return "";
  return start === end ? vn(start) : `${vn(start)} – ${vn(end)}`;
}
