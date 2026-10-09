import { addDays, type DateRange } from "@/lib/shared/date-range-presets";
import { saigonToday } from "@/lib/shared/datetime";
import { saigonBucketKeys, toSaigonUtcRange } from "@/lib/shared/report-time";

// Dashboard days in Asia/Saigon (BR-DATA-006). The server runs in UTC on
// Vercel, so the range, its compare periods and the 7-day chart must never
// come from the runtime's own clock parts.

function startOfSaigonDay(day: string): Date {
  return toSaigonUtcRange(day, day)!.startUtc;
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

/** True when the instant falls in the Saigon days range.start..range.end, both inclusive. */
export function inSaigonDayRange(createdAtIso: string, range: DateRange): boolean {
  const day = saigonBucketKeys(createdAtIso).dateKey;
  return day >= range.start && day <= range.end;
}

/** Lower bound for the order fetch: the earliest Saigon 00:00 of every range start and of the 7-day chart's first day. */
export function dashboardQueryStart(ranges: DateRange[], now: Date): Date {
  const chartFirstDay = addDays(saigonToday(now), -6);
  const starts = [chartFirstDay, ...ranges.map(r => r.start)].map(startOfSaigonDay);
  return new Date(Math.min(...starts.map(d => d.getTime())));
}
