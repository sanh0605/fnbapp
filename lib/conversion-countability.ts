/**
 * Plan D D15, P4-P7: a purchased item must always keep at least one
 * countable conversion -- ACTIVE and not purchase_only. If every conversion
 * of an item were marked purchase_only, that item could never be counted
 * again, and under S1/S2 (docs/superpowers/plans/2026-08-07-stocktake-and-
 * issue-slips.md section 5) its ingredient's quantity would freeze
 * permanently. Same shape as C17, reached from a different direction.
 *
 * Pure so it is testable without a database round-trip -- the caller
 * (app/admin/inventory/conversions/actions.ts) fetches the item's other
 * ACTIVE conversions and passes their purchase_only flags in.
 */
export function wouldLeaveNoCountableConversion(
  otherActiveConversionsPurchaseOnly: readonly boolean[],
  savedConversionPurchaseOnly: boolean,
): boolean {
  if (!savedConversionPurchaseOnly) return false; // turning it off never reduces countability
  return !otherActiveConversionsPurchaseOnly.some(purchaseOnly => !purchaseOnly);
}
