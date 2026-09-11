/**
 * BR-DATA-005, owner rule 2026-09-11 (docs/02-rules/business-rules/
 * data-integrity.md). Replaces the directional rule of 2026-07-30 (stock
 * down, money up, "never flatter the business"), withdrawn by the owner.
 *
 * Every figure is computed exactly. Rounding happens only where a number
 * is shown: to the nearest whole unit, halves away from zero -- the same
 * direction Intl.NumberFormat uses in lib/shared/format.ts.
 *
 * Round from the exact value, then show -- never sum rounded parts. Shown
 * parts can therefore differ from a shown total by a unit or two (three
 * months of 100,4 show 100 each, their total shows 301). Accepted, not a
 * bug: any screen that shows parts beside their total says so where it
 * happens.
 */
function roundToWhole(exactValue: number): number {
  // Snap to 6 decimals first: a value that is a half on paper can land a
  // hair below it in binary floating point (1.005 * 1000 / 10 is
  // 100.49999999999999) and must still round the way a calculator would.
  const snapped = Math.round(Math.abs(exactValue) * 1e6) / 1e6;
  const rounded = Math.sign(exactValue) * Math.round(snapped);
  return rounded === 0 ? 0 : rounded; // never "-0" on screen
}

export function displayStock(exactValue: number): number {
  return roundToWhole(exactValue);
}

export function displayMoney(exactValue: number): number {
  return roundToWhole(exactValue);
}
