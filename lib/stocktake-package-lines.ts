import { formatNumber } from "@/lib/format";

/**
 * Plan D section 4 -- the package-line count model.
 *
 * Counting by purchased-unit name breaks when the same name means different
 * sizes (Dau say: three ACTIVE conversions all named "Tui" -- 100 g, 500 g,
 * 1.000 g). One line per conversion, labelled with the size derived from
 * conversion_rate, removes the ambiguity without renaming any master data.
 */

export type PurchasedItemConversion = {
  conversionId: string;
  purchasedItemId: string;
  purchasedItemName: string;
  purchasedUnitName: string;
  baseUnitName: string;
  conversionRate: number;
  status: string;
  // Plan D D15: true for a purchase-only bundle (e.g. "Combo 2" of two
  // 500 g bags) -- never a thing that sits on the shelf, so never a count
  // or issue-slip line. Still offered when receiving a purchase order,
  // which does not go through this function.
  purchaseOnly: boolean;
};

export type PackageLine = {
  conversionId: string;
  purchasedItemId: string;
  purchasedItemName: string;
  sizeLabel: string;
  conversionRate: number;
  baseUnitName: string;
  // docs/superpowers/plans/2026-08-30-issue-slip-picker-and-unit-display.md:
  // the issue-slip screen needs the purchased unit's own name (not just the
  // composed sizeLabel string) to show on-hand converted into the unit
  // being typed, e.g. "20 Cây" for a "Cây 50 Cái" conversion.
  purchasedUnitName: string;
};

/**
 * One line per ACTIVE conversion. Inactive conversions are dropped here --
 * callers building a NEW session get this filtered list (Gap 1/C8); an
 * already-open session must keep its existing lines regardless (C8/C16),
 * which is the caller's responsibility, not this function's.
 *
 * Plan D D15 (P2/P3): a purchase_only conversion is dropped here too -- it
 * describes how goods were bought (a combo, a bulk-deal bundle), never
 * something that sits on the shelf to be counted or issued. Both counting
 * and issue slips call this same function, so both inherit the filter from
 * one place -- purchase orders read uom_conversions directly, not through
 * here, so purchase_only conversions stay offered there (P1).
 *
 * Sorted by purchased item name, then ascending size, so a multi-conversion
 * item's lines stay grouped and ordered small-to-large on screen.
 */
export function buildPackageLines(conversions: readonly PurchasedItemConversion[]): PackageLine[] {
  return conversions
    .filter(c => c.status === "ACTIVE" && !c.purchaseOnly)
    .map(c => ({
      conversionId: c.conversionId,
      purchasedItemId: c.purchasedItemId,
      purchasedItemName: c.purchasedItemName,
      sizeLabel: formatSizeLabel(c.purchasedUnitName, c.conversionRate, c.baseUnitName),
      conversionRate: c.conversionRate,
      baseUnitName: c.baseUnitName,
      purchasedUnitName: c.purchasedUnitName,
    }))
    .sort((a, b) => a.purchasedItemName.localeCompare(b.purchasedItemName) || a.conversionRate - b.conversionRate);
}

/**
 * "Tui 100 g", "Hop 1.000 ml" -- purchased-unit name, the base-unit quantity
 * it holds (vi-VN thousand separators, matching lib/format.ts convention),
 * and the base unit. Deliberately does not scale to a larger unit (no
 * "1 kg" / "1 l") -- that needs an explicit per-unit scaling table nothing
 * in the schema defines yet, and Plan D section 4's own mockup used it for
 * one item (ml -> l) but not the other (g stayed at 1.000), so it was never
 * an actual rule to implement. Base unit, always, is the simple, consistent
 * choice; revisit if the owner asks for it explicitly.
 */
function formatSizeLabel(purchasedUnitName: string, conversionRate: number, baseUnitName: string): string {
  return `${purchasedUnitName} ${formatNumber(conversionRate)} ${baseUnitName}`;
}
