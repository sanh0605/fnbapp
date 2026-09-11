import { DATE_RANGE_PRESETS, resolvePreset, type DateRangePresetKey } from "@/lib/shared/date-range-presets";

// Kept out of page.tsx: a Next.js route file may only export the handful of
// names the framework recognises (default, dynamic, metadata, ...) --
// anything else fails the generated route type check at build time.

export function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePresetParam(value: string | undefined): DateRangePresetKey {
  const found = DATE_RANGE_PRESETS.find((p) => p.key === value);
  return found ? found.key : "THIS_MONTH";
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// M1 residuals (residuals-fix-brief.md item 1): the shape check above alone
// let a calendar-invalid date like 2026-02-30 through, which Date's own
// constructor would silently roll into March 2 -- so it is never used here
// on its own. Instead the three parts are built with Date.UTC and the
// round-trip must give back the exact year, month and day that went in.
function isValidCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  return (
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day
  );
}

// M1 (final-review.md): a hand-edited URL like ?preset=CUSTOM&start=abc&end=x
// used to reach findAllWhere with an unparsable date and throw the page;
// start > end returned an empty list with no explanation. Both fall back to
// THIS_MONTH here instead.
export function resolveDateRange(
  presetParam: string | undefined,
  startParam: string | undefined,
  endParam: string | undefined,
  today: string,
): { preset: DateRangePresetKey; start: string; end: string } {
  let preset = parsePresetParam(presetParam);

  const validCustomRange =
    preset === "CUSTOM" &&
    !!startParam && isValidCalendarDate(startParam) &&
    !!endParam && isValidCalendarDate(endParam) &&
    startParam <= endParam;

  if (validCustomRange) {
    return { preset: "CUSTOM", start: startParam as string, end: endParam as string };
  }

  // No usable custom range in the URL -- fall back to the default preset
  // rather than querying with an empty, malformed, or backwards range.
  if (preset === "CUSTOM") preset = "THIS_MONTH";
  const resolved = resolvePreset(preset, today);
  return { preset, start: resolved.start, end: resolved.end };
}
