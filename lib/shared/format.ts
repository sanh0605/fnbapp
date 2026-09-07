/**
 * Centralized number formatter — vi-VN locale, plain number output.
 *
 * Why: 144 ad-hoc toLocaleString calls used inconsistent formats. User direction
 * 2026-07-06: display numbers only, no currency unit suffix. Context (VND vs
 * quantity) is inferred from surrounding UI labels.
 */

const NUMBER_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER_DECIMAL = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format number with vi-VN thousand separators.
 * Returns "15.000" for 15000.
 * Returns "---" for null/undefined/NaN/Infinity (defensive).
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
