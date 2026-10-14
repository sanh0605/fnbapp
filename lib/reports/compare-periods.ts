import { addDays, addMonths, endOfMonth, startOfWeek, type DateRange } from "@/lib/shared/date-range-presets";
import type { RangeValue } from "@/lib/shared/date-range-params";

export type CompareKind = "PREVIOUS" | "DAY_BEFORE" | "SAME_WEEKDAY_LAST_WEEK";
export interface ComparePeriod { kind: CompareKind; start: string; end: string }

type Unit = "WEEK" | "MONTH" | "QUARTER" | "YEAR";

const UNIT_OF: Partial<Record<string, Unit>> = {
  THIS_WEEK: "WEEK", LAST_WEEK: "WEEK",
  THIS_MONTH: "MONTH", LAST_MONTH: "MONTH", MONTH_TO_DATE: "MONTH",
  THIS_QUARTER: "QUARTER", LAST_QUARTER: "QUARTER",
  THIS_YEAR: "YEAR", LAST_YEAR: "YEAR", YEAR_TO_DATE: "YEAR",
};

const UNIT_MONTHS: Record<Exclude<Unit, "WEEK">, number> = { MONTH: 1, QUARTER: 3, YEAR: 12 };

function shiftBack(iso: string, unit: Unit): string {
  return unit === "WEEK" ? addDays(iso, -7) : addMonths(iso, -UNIT_MONTHS[unit]);
}

function lastDayOfUnit(start: string, unit: Unit): string {
  return unit === "WEEK" ? addDays(startOfWeek(start), 6) : endOfMonth(addMonths(start, UNIT_MONTHS[unit] - 1));
}

function daysBetween(start: string, end: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(end) - ms(start)) / 86_400_000) + 1;
}

export function comparePeriods(value: RangeValue, today: string): { current: DateRange | null; previous: ComparePeriod[] } {
  if (value.start > today) return { current: null, previous: [] };
  const current: DateRange = { start: value.start, end: value.end < today ? value.end : today };

  if (value.start === value.end) {
    return {
      current,
      previous: [
        { kind: "DAY_BEFORE", start: addDays(value.start, -1), end: addDays(value.start, -1) },
        { kind: "SAME_WEEKDAY_LAST_WEEK", start: addDays(value.start, -7), end: addDays(value.start, -7) },
      ],
    };
  }

  const unit = UNIT_OF[value.preset];
  if (unit) {
    const start = shiftBack(current.start, unit);
    const end = current.end === lastDayOfUnit(current.start, unit)
      ? addDays(current.start, -1)
      : shiftBack(current.end, unit);
    return { current, previous: [{ kind: "PREVIOUS", start, end }] };
  }

  const n = daysBetween(current.start, current.end);
  const end = addDays(current.start, -1);
  return { current, previous: [{ kind: "PREVIOUS", start: addDays(end, -(n - 1)), end }] };
}

const WEEKDAYS = ["Chủ nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"];

function weekdayName(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dmy = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`;

export function compareLabel(period: ComparePeriod, current: DateRange, today: string): string {
  void current;
  if (period.kind === "DAY_BEFORE") {
    return period.start === addDays(today, -1) ? "so với hôm qua" : `so với ${dm(period.start)}`;
  }
  if (period.kind === "SAME_WEEKDAY_LAST_WEEK") {
    return `so với ${weekdayName(period.start)} ${dm(period.start)}`;
  }
  const year = today.slice(0, 4);
  const withYear = period.start.slice(0, 4) !== year || period.end.slice(0, 4) !== year;
  const f = withYear ? dmy : dm;
  return period.start === period.end ? `so với ${f(period.start)}` : `so với ${f(period.start)} – ${f(period.end)}`;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
