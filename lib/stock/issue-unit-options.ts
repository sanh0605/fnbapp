import { formatNumber } from "@/lib/shared/format";
import type { PackageLine } from "@/lib/stock/stocktake-package-lines";

// Units offered when typing an issue-slip quantity. Only the base quantity is
// ever stored; the chosen unit is a screen convenience.
export interface IssueUnitOption { key: string; label: string; factor: number; unitName: string }

export const LOOSE_UNIT_KEY = "BASE";

export function buildIssueUnitOptions(baseUnitName: string, packageLines: PackageLine[]): IssueUnitOption[] {
  const options: IssueUnitOption[] = packageLines.map(p => ({
    key: p.conversionId, label: p.sizeLabel, factor: p.conversionRate, unitName: p.purchasedUnitName,
  }));
  // A package of 1 base unit that carries the base unit's own name already is the loose unit.
  const hasLoose = packageLines.some(p => p.conversionRate === 1 && p.purchasedUnitName === baseUnitName);
  if (!hasLoose) {
    options.push({ key: LOOSE_UNIT_KEY, label: `${baseUnitName} (lẻ)`, factor: 1, unitName: baseUnitName });
  }
  return options;
}

export function initialUnitQuantity(baseQuantity: number, options: IssueUnitOption[]): { key: string; quantity: number } {
  const first = options[0];
  return { key: first.key, quantity: baseQuantity / first.factor };
}

/** Round to 6 decimals so 0.1 * 3 does not become 0.30000000000000004. */
export function toBaseQuantity(quantity: number, option: IssueUnitOption): number {
  return Math.round(quantity * option.factor * 1e6) / 1e6;
}

// formatNumber(x, { withDecimals: true }) always prints two decimals ("2,00"),
// so whole numbers use the plain form and only fractions use the decimal form.
function quantityText(value: number): string {
  return formatNumber(value, { withDecimals: !Number.isInteger(value) });
}

export function describeQuantity(baseQuantity: number, baseUnitName: string, options: IssueUnitOption[]): string {
  const first = options[0];
  if (first && first.factor !== 1) {
    const qty = quantityText(baseQuantity / first.factor);
    return `${qty} ${first.unitName} (${quantityText(baseQuantity)} ${baseUnitName})`;
  }
  return `${quantityText(baseQuantity)} ${first ? first.unitName : baseUnitName}`;
}
