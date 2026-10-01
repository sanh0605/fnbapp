/**
 * Pure row filtering for scripts/clear-issue-slip-notes.ts (owner decision
 * 2026-10-01, BR-INV-014: an issue slip carries no reason and no note).
 * No I/O here; the script does the fetching, printing and writing.
 */

// The only two reasons the old issue-slip form could write into note.
export const CLEARABLE_ISSUE_NOTES = ["Khác", "Hao hụt / hư hỏng"] as const;

export interface SlipRow {
  id: string;
  note: string | null;
}

export interface StockIssueRow {
  id: string;
  source: string;
  reverses_issue_id: string | null;
  note: string | null;
}

function hasText(note: string | null | undefined): boolean {
  return (note ?? "").trim() !== "";
}

function isReturnRow(row: { reverses_issue_id: string | null }): boolean {
  return row.reverses_issue_id !== null && row.reverses_issue_id !== "";
}

function isOldReason(note: string | null | undefined): boolean {
  return (CLEARABLE_ISSUE_NOTES as readonly string[]).includes((note ?? "").trim());
}

export function selectIssueSlipsToClear<T extends SlipRow>(slips: readonly T[]): T[] {
  return slips.filter(s => hasText(s.note));
}

// Return rows (reverses_issue_id set) are never selected: parseCancelReason
// reads the cancel reason out of their note.
export function selectStockIssuesToClear<T extends StockIssueRow>(rows: readonly T[]): T[] {
  return rows.filter(r => r.source === "MANUAL" && !isReturnRow(r) && isOldReason(r.note));
}

export interface AfterClearSummary {
  slipsTotal: number;
  slipsWithNote: number;
  manualNonReturnTotal: number;
  manualNonReturnWithOldReason: number;
  returnRowsTotal: number;
  returnRowsWithNote: number;
}

export function summarizeAfterClear(
  slips: readonly SlipRow[],
  issues: readonly StockIssueRow[],
): AfterClearSummary {
  const manualNonReturn = issues.filter(r => r.source === "MANUAL" && !isReturnRow(r));
  const returnRows = issues.filter(isReturnRow);
  return {
    slipsTotal: slips.length,
    slipsWithNote: slips.filter(s => hasText(s.note)).length,
    manualNonReturnTotal: manualNonReturn.length,
    manualNonReturnWithOldReason: manualNonReturn.filter(r => isOldReason(r.note)).length,
    returnRowsTotal: returnRows.length,
    returnRowsWithNote: returnRows.filter(r => hasText(r.note)).length,
  };
}
