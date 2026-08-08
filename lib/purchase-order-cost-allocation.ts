export interface PurchaseOrderCostLine {
  lineId: string;
  subtotal: number;
}

// BR-COGS-006: a purchased item's true cost is what was actually paid for
// it -- shipping and tax included, vouchers and discounts subtracted -- not
// the bare line subtotal. Those four figures live only on the purchase
// order's header, so they reach no line and no unit cost unless allocated
// explicitly. Found 2026-08-09 by the owner refusing a stocktake-projected
// figure that could not be right: the sum of line subtotals across 63
// completed orders was 52.773.374đ; 49.149.880đ is what was paid.
//
// Method corrected 2026-08-09, same day as the first version, after the
// owner asked why not divide each line straight against the order total
// instead of reusing allocateOrderDiscount's running-remainder form. Two
// things settled it, both measured against the shop's real 20 orders that
// carry shipping, a voucher, or a discount:
//   1. The direct form and the running-remainder form produce identical
//      numbers on every one of those 20 orders, and the direct form
//      reconciles exactly every time (0 residues) -- the advantage claimed
//      for running-remainder does not exist in this data.
//   2. The adjustment is not always a discount: PO-056 carries +40.000đ
//      (shipping, no voucher), the other 19 are negative. allocateOrderDiscount
//      is shaped for a positive amount to SUBTRACT, capped per line so
//      nothing goes below zero -- a cost-INCREASING adjustment does not
//      fit that shape. Reusing it anyway would have leaned on guarantees
//      about a different problem.
//
// Direct form, one adjustment (additions minus subtractions), one rounding
// guard: round each line's share of the adjustment independently
// (`round(adjustment * line.subtotal / sumOfSubtotals)`); if the rounded
// shares do not sum to the adjustment (possible with numbers that do not
// divide evenly, though none observed in real data today), the residue is
// added to the line with the largest subtotal -- an arbitrary but
// deterministic and auditable place to put it, satisfying BR-COGS-003
// (the parts must sum to the whole) without a capacity-capped allocator
// that does not fit an addition. Works identically for either sign.
export function allocatePurchaseOrderCost(
  lines: PurchaseOrderCostLine[],
  additions: number,
  subtractions: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (lines.length === 0) return result;

  const adjustment = additions - subtractions;
  const sumSubtotal = lines.reduce((s, l) => s + l.subtotal, 0);

  if (adjustment === 0 || sumSubtotal <= 0) {
    for (const l of lines) result.set(l.lineId, l.subtotal);
    return result;
  }

  const shares = lines.map(l => Math.round((adjustment * l.subtotal) / sumSubtotal));
  const sumShares = shares.reduce((s, v) => s + v, 0);
  const residue = adjustment - sumShares;

  if (residue !== 0) {
    let largestIndex = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].subtotal > lines[largestIndex].subtotal) largestIndex = i;
    }
    shares[largestIndex] += residue;
  }

  lines.forEach((l, i) => result.set(l.lineId, l.subtotal + shares[i]));
  return result;
}
