import { addDays } from "@/lib/shared/date-range-presets";
import { saigonToday } from "@/lib/shared/datetime";
import { saigonBucketKeys, toSaigonUtcRange } from "@/lib/shared/report-time";

// Dashboard periods in Asia/Saigon (BR-DATA-006). The server runs in UTC on
// Vercel, so "today", "this month" and the 7-day chart must never come from
// the runtime's own clock parts.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DashboardPeriods {
  isCurrent: (createdAtIso: string) => boolean;
  isPrev: (createdAtIso: string) => boolean;
  // Lower bound for the order fetch; null means "all". Always <= the earliest
  // instant isCurrent, isPrev or the 7-day chart can need.
  queryStartDate: Date | null;
}

function startOfSaigonDay(day: string): Date {
  return toSaigonUtcRange(day, day)!.startUtc;
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

const monthKeyOf = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export function resolveDashboardPeriods(filter: string, now: Date): DashboardPeriods {
  const today = saigonToday(now);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const dd = today.slice(8, 10);
  const mm = today.slice(5, 7);

  const todayStart = startOfSaigonDay(today);
  const yesterdayStart = startOfSaigonDay(addDays(today, -1));
  const sevenDayChartStart = new Date(now.getTime() - 7 * DAY_MS);
  const earliest = (...dates: Date[]) => new Date(Math.min(...dates.map(d => d.getTime())));

  const diffDays = (d: Date) => (now.getTime() - d.getTime()) / DAY_MS;
  const keys = (iso: string) => saigonBucketKeys(iso);

  switch (filter) {
    case "today":
      return {
        isCurrent: iso => new Date(iso) >= todayStart,
        isPrev: iso => { const d = new Date(iso); return d >= yesterdayStart && d < todayStart; },
        queryStartDate: earliest(yesterdayStart, sevenDayChartStart),
      };
    case "7days":
      return {
        isCurrent: iso => diffDays(new Date(iso)) <= 7,
        isPrev: iso => { const diff = diffDays(new Date(iso)); return diff > 7 && diff <= 14; },
        queryStartDate: new Date(now.getTime() - 15 * DAY_MS),
      };
    case "30days":
      return {
        isCurrent: iso => diffDays(new Date(iso)) <= 30,
        isPrev: iso => { const diff = diffDays(new Date(iso)); return diff > 30 && diff <= 60; },
        queryStartDate: new Date(now.getTime() - 61 * DAY_MS),
      };
    case "this_month": {
      const thisKey = monthKeyOf(currentYear, currentMonth);
      const last = prevMonth(currentYear, currentMonth);
      const lastKey = monthKeyOf(last.year, last.month);
      // Same day-of-month cut-off as today, compared as calendar strings; a
      // day number past the end of last month just means the whole month.
      const lastCutoff = `${lastKey}-${dd}`;
      return {
        isCurrent: iso => keys(iso).monthKey === thisKey,
        isPrev: iso => { const k = keys(iso); return k.monthKey === lastKey && k.dateKey <= lastCutoff; },
        queryStartDate: earliest(startOfSaigonDay(`${lastKey}-01`), sevenDayChartStart),
      };
    }
    case "last_month": {
      const lm = prevMonth(currentYear, currentMonth);
      const lmKey = monthKeyOf(lm.year, lm.month);
      const pm = prevMonth(lm.year, lm.month);
      const pmKey = monthKeyOf(pm.year, pm.month);
      return {
        isCurrent: iso => keys(iso).monthKey === lmKey,
        isPrev: iso => keys(iso).monthKey === pmKey,
        queryStartDate: earliest(startOfSaigonDay(`${pmKey}-01`), sevenDayChartStart),
      };
    }
    case "this_year": {
      const prevCutoff = `${currentYear - 1}-${mm}-${dd}`;
      return {
        isCurrent: iso => keys(iso).dateKey.startsWith(`${currentYear}-`),
        isPrev: iso => { const k = keys(iso).dateKey; return k.startsWith(`${currentYear - 1}-`) && k <= prevCutoff; },
        queryStartDate: earliest(startOfSaigonDay(`${currentYear - 1}-01-01`), sevenDayChartStart),
      };
    }
    case "last_year":
      return {
        isCurrent: iso => keys(iso).dateKey.startsWith(`${currentYear - 1}-`),
        isPrev: iso => keys(iso).dateKey.startsWith(`${currentYear - 2}-`),
        queryStartDate: earliest(startOfSaigonDay(`${currentYear - 2}-01-01`), sevenDayChartStart),
      };
    case "all":
      return { isCurrent: () => true, isPrev: () => false, queryStartDate: null };
    default:
      return { isCurrent: () => true, isPrev: () => false, queryStartDate: sevenDayChartStart };
  }
}

export interface SevenDayChartPoint {
  date: string; // "dd/mm"
  amount: number;
}

/** Revenue of the last 7 Saigon calendar days, oldest first, today last. */
export function buildSevenDayChart(
  orders: Array<{ created_at: string; total_amount?: number | string }>,
  now: Date,
): SevenDayChartPoint[] {
  const today = saigonToday(now);
  const byDay = new Map<string, number>();
  for (let i = 6; i >= 0; i--) byDay.set(addDays(today, -i), 0);
  for (const o of orders) {
    if (!o.created_at) continue;
    const key = saigonBucketKeys(o.created_at).dateKey;
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + Number(o.total_amount || 0));
  }
  return Array.from(byDay.entries()).map(([key, amount]) => ({
    date: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
    amount,
  }));
}
