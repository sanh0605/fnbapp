/**
 * The one place that turns a number into on-screen text (BR-UI-008, owner
 * 2026-10-07): a comma between thousands, a dot before decimals, on every
 * screen including the POS. A guard test (lib/shared/format.guard.test.ts)
 * fails when any other file formats a number itself.
 *
 * Earlier history: 2026-07-06 the owner asked for plain numbers with no
 * currency suffix; context (đồng vs quantity) comes from the labels around.
 */

const NUMBER_LOCALE = "en-US";

const NUMBER_FORMATTER = new Intl.NumberFormat(NUMBER_LOCALE, {
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER_DECIMAL = new Intl.NumberFormat(NUMBER_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Whole number with comma thousands: 15000 -> "15,000".
 * withDecimals: exactly two decimals, "1,250.50".
 * "---" for null/undefined/NaN/Infinity (defensive).
 */
export function formatNumber(
  value: number | string | null | undefined,
  opts: { withDecimals?: boolean } = {}
): string {
  const { withDecimals = false } = opts;
  if (value === null || value === undefined) return "---";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "---";
  return withDecimals
    ? NUMBER_FORMATTER_DECIMAL.format(num)
    : NUMBER_FORMATTER.format(num);
}

const decimalFormatters = new Map<string, Intl.NumberFormat>();

/**
 * A number with up to maxDigits decimals (trailing zeros trimmed down to
 * minDigits): formatDecimal(20.625, { maxDigits: 2 }) -> "20.63".
 */
export function formatDecimal(
  value: number,
  opts: { maxDigits: number; minDigits?: number }
): string {
  const minDigits = opts.minDigits ?? 0;
  const key = `${minDigits}:${opts.maxDigits}`;
  let formatter = decimalFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(NUMBER_LOCALE, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: opts.maxDigits,
    });
    decimalFormatters.set(key, formatter);
  }
  return formatter.format(value);
}
