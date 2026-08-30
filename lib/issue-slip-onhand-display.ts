import { formatNumber } from "@/lib/format";

// docs/superpowers/plans/2026-08-30-issue-slip-picker-and-unit-display.md
// section 3: this is a mistake guard, not a convenience. IssueSlipClient's
// own submit multiplies the typed quantity by the selected conversion's
// rate (parsedQty * pkg.conversionRate) -- so with "Cay 50 Cai" selected,
// a screen showing on-hand only in the base unit ("Ton hien tai: 1.000
// Cai") invites typing "1.000" against a box that means cay, issuing
// 50.000 cai instead of 20. The server only refuses when the result
// exceeds stock, so with enough stock it passes silently.
//
// Rounding, set by the owner 2026-08-30: show the exact value when the
// division terminates within two decimal places ("20,6"), and round to
// exactly two decimals when it does not ("20,62"). Never round to a whole
// number -- that would collapse the fractional package count this exists
// to show. maximumFractionDigits with no minimum gives exactly this: it
// trims trailing zeros for a value that already fits in <=2 decimals, and
// rounds (rather than truncates) anything longer.
const CONVERTED_QTY_FORMATTER = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/**
 * On-hand (in base units) shown in the unit the owner is currently typing
 * into, base figure kept alongside so a refusal message ("chi con 1.000")
 * stays readable against what the screen said.
 *
 * Rate 1 changes nothing on purpose (section 3): 26 of the consumables are
 * "Cai 1 Cai", and "20 Cai (1.000 Cai)" there would be pure noise, not a
 * guard against anything. Also the fallback when no package is selected at
 * all (Quy cach reset to the placeholder) -- shows the base figure alone,
 * the same thing this label always showed before this fix.
 */
export function formatConvertedOnHand(
  onHand: number,
  baseUnitName: string,
  selectedPackage: { conversionRate: number; purchasedUnitName: string } | undefined,
): string {
  if (!selectedPackage || selectedPackage.conversionRate === 1) {
    return `${formatNumber(onHand)} ${baseUnitName}`;
  }
  const converted = onHand / selectedPackage.conversionRate;
  return `${CONVERTED_QTY_FORMATTER.format(converted)} ${selectedPackage.purchasedUnitName} (${formatNumber(onHand)} ${baseUnitName})`;
}
