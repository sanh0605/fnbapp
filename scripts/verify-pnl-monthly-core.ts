import { displayMoney } from "@/lib/reports/display-rounding";
import type { PnlMonthFigures, PnlSource } from "@/lib/reports/profit-and-loss";

// Pure: no I/O. scripts/verify-pnl-monthly.ts fetches and prints.
// docs/superpowers/plans/2026-09-11-bao-cao-lai-lo.md Mục 3.

export interface PnlReference {
  totalRevenue: number;     // getPnLDataV2(month).totalRevenue
  totalCOGS: number;        // getPnLDataV2(month).totalCOGS, already displayMoney-rounded
  shrinkageValue: number;   // getPnLDataV2(month).shrinkageValue, already rounded
}

const TOLERANCE = 0.01;
const sum = (xs: PnlSource[]) => xs.reduce((a, s) => a + s.amountExact, 0);

export function checkPnlMonth(month: PnlMonthFigures, reference: PnlReference): string[] {
  const problems: string[] = [];
  const m = month.month;

  if (Math.abs(month.posRevenue - reference.totalRevenue) > TOLERANCE) {
    problems.push(`${m}: POS revenue ${month.posRevenue} != getPnLDataV2 totalRevenue ${reference.totalRevenue}`);
  }
  const cogsPlusShrinkage = displayMoney(month.cogsExact + month.shrinkageExact);
  if (cogsPlusShrinkage !== reference.totalCOGS) {
    problems.push(`${m}: Giá vốn + Hao hụt ${cogsPlusShrinkage} != getPnLDataV2 totalCOGS ${reference.totalCOGS}`);
  }
  if (displayMoney(month.shrinkageExact) !== reference.shrinkageValue) {
    problems.push(`${m}: Hao hụt ${displayMoney(month.shrinkageExact)} != getPnLDataV2 shrinkageValue ${reference.shrinkageValue}`);
  }

  const lines: Array<[string, number, PnlSource[]]> = [
    ["manualRevenue", month.manualRevenue, month.sources.manualRevenue],
    ["cogs", month.cogsExact, month.sources.cogs],
    ["shrinkage", month.shrinkageExact, month.sources.shrinkage],
    ["nonInventory", month.nonInventoryExact, month.sources.nonInventory],
    ["otherIncome", month.otherIncome, month.sources.otherIncome],
    ["depreciation", month.depreciationExact, month.sources.depreciation],
  ];
  const categoryIds = new Set([...Object.keys(month.expenseByCategory), ...Object.keys(month.sources.expense)]);
  for (const id of categoryIds) {
    lines.push([`expense ${id}`, month.expenseByCategory[id] ?? 0, month.sources.expense[id] ?? []]);
  }
  for (const [name, figure, sources] of lines) {
    if (Math.abs(sum(sources) - figure) > TOLERANCE) {
      problems.push(`${m}: ${name} sources add to ${sum(sources)}, line says ${figure}`);
    }
  }
  return problems;
}
