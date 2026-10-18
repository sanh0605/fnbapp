import { formatNumber } from "@/lib/shared/format";
import { formatPercent, type PnlRow } from "@/lib/reports/profit-and-loss-table";

// Shared display rules for the computer table and the phone cards
// ("Dấu của chi phí", plan Mục 3). PnlTable itself keeps every cost
// positive; only this layer flips the sign for the screen.

// A cost line -- cost of goods, items bought for immediate use, shrinkage,
// each expense group, depreciation -- reads as something subtracted.
export function isCostRow(row: PnlRow): boolean {
  return row.kind === "cost" || row.kind === "expense";
}

// Cost rows are negated for display; 0 stays 0, never -0.
export function shownMoney(row: PnlRow, value: number): number {
  if (!isCostRow(row)) return value;
  return value === 0 ? 0 : -value;
}

// percent -> formatPercent; a money cell that is exactly 0 -> en dash, as
// in the sample; otherwise the shown (possibly negated) amount.
export function cellText(row: PnlRow, value: number | null): string {
  if (value === null) return "–";
  if (row.unit === "percent") return formatPercent(value);
  const shown = shownMoney(row, value);
  return shown === 0 ? "–" : formatNumber(shown);
}

// A cost row's minus is never red: red is kept for a result below zero
// (Lợi nhuận gộp, Lợi nhuận ròng, Biên lợi nhuận, Luỹ kế).
export function cellTone(row: PnlRow, value: number | null): string {
  if (isCostRow(row) || value === null) return "";
  return shownMoney(row, value) < 0 ? "text-danger" : "";
}

// The numbers of the footnotes that name a column or a line, e.g. "1, 3" --
// shown as normal small text in brackets after the month (Ticket G9 item 5).
export function NoteMarks({ numbers, className }: { numbers: number[]; className?: string }) {
  if (numbers.length === 0) return null;
  return <span className={className ?? "ml-1 text-xs font-normal text-text-secondary"}>({numbers.join(", ")})</span>;
}
