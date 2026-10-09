import {
  DATE_RANGE_PRESETS,
  MONTH_PRESET_KEYS,
  formatRangeLabel,
  isValidIsoDay,
  presetLabel,
  resolvePreset,
  type DateRangePresetKey,
} from "./date-range-presets";

export type RawParams = Record<string, string | string[] | undefined>;

// start/end are yyyy-mm-dd, or yyyy-mm in month mode.
export interface RangeValue {
  preset: DateRangePresetKey;
  start: string;
  end: string;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const isPresetKey = (v: string | undefined): v is DateRangePresetKey =>
  !!v && DATE_RANGE_PRESETS.some(p => p.key === v);

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const isValidMonth = (v: string | undefined): v is string => {
  const m = v ? MONTH_PATTERN.exec(v) : null;
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
};

export function readRangeParams(params: RawParams, today: string, fallback: DateRangePresetKey): RangeValue {
  const range = first(params.range);
  const from = first(params.from);
  const to = first(params.to);
  const validPair = !!from && !!to && isValidIsoDay(from) && isValidIsoDay(to) && from <= to;

  if (range === undefined && validPair) return { preset: "CUSTOM", start: from, end: to };
  if (isPresetKey(range)) {
    if (range === "CUSTOM") {
      if (validPair) return { preset: "CUSTOM", start: from, end: to };
    } else {
      return { preset: range, ...resolvePreset(range, today) };
    }
  }
  return { preset: fallback, ...resolvePreset(fallback, today) };
}

export function readMonthRangeParams(params: RawParams, today: string): RangeValue {
  const range = first(params.range);
  const from = first(params.from);
  const to = first(params.to);

  if (isPresetKey(range) && MONTH_PRESET_KEYS.includes(range)) {
    if (range === "CUSTOM") {
      if (isValidMonth(from) && isValidMonth(to) && from <= to) return { preset: "CUSTOM", start: from, end: to };
    } else {
      const r = resolvePreset(range, today);
      const cap = today.slice(0, 7);
      const end = r.end.slice(0, 7);
      return { preset: range, start: r.start.slice(0, 7), end: end > cap ? cap : end };
    }
  }

  // Old bookmarks: ?year=2025 opens all of 2025.
  const year = first(params.year);
  if (year && /^\d{4}$/.test(year)) return { preset: "CUSTOM", start: `${year}-01`, end: `${year}-12` };

  const r = resolvePreset("THIS_YEAR", today);
  return { preset: "THIS_YEAR", start: r.start.slice(0, 7), end: today.slice(0, 7) };
}

// Touches only range, from and to; every other param stays as it was.
export function writeRangeParams(params: URLSearchParams, value: RangeValue): void {
  params.set("range", value.preset);
  if (value.preset === "CUSTOM") {
    params.set("from", value.start);
    params.set("to", value.end);
  } else {
    params.delete("from");
    params.delete("to");
  }
}

const vnMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};

export function formatRangeButtonText(value: RangeValue, mode: "day" | "month" = "day"): string {
  const label = mode === "month"
    ? (value.start === value.end ? vnMonth(value.start) : `${vnMonth(value.start)} – ${vnMonth(value.end)}`)
    : formatRangeLabel(value.start, value.end);
  return `${presetLabel(value.preset)} · ${label}`;
}
