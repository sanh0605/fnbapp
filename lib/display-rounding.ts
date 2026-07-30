/**
 * Owner rule, confirmed 2026-07-30 (docs/superpowers/plans/2026-07-30-exact-
 * cost-precision.md): rounding at the display edge is directional, not
 * Math.round -- never flatter the business.
 *
 *   Stock quantity -> DOWN (floor): never claims more goods than are really
 *   there.
 *   Cost / money -> UP (ceiling): never understates what something cost.
 *
 * Together, reported profit is always at or below true profit, never above.
 *
 * Round from the exact value, then sum for display -- never sum rounded
 * parts. Displayed parts will therefore not always add to a displayed total
 * (e.g. 100.1 and 100.2 both display as 101, but their exact sum 300.3
 * displays as 301). This is an accepted consequence, not a bug -- any UI
 * that sums parts for display must carry a note saying so.
 */

export function displayStock(exactValue: number): number {
  return Math.floor(exactValue);
}

export function displayMoney(exactValue: number): number {
  return Math.ceil(exactValue);
}
