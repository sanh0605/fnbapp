export type SheetContentRecommendation = "ARCHIVE_RECOMMENDED" | "KEEP_REVIEW";

export type SheetContentSummary = {
  title: string;
  nonEmptyRows: number;
  nonEmptyCells: number;
  dataRows: number;
  formulaCells: number;
  headers: string[];
  sampleRows: string[][];
  recommendation: SheetContentRecommendation;
  reason: string;
};

export function summarizeSheetContent(title: string, values: unknown[][]): SheetContentSummary {
  const normalized = values.map(row => row.map(cell => String(cell ?? "").trim()));
  const nonEmptyRows = normalized.filter(row => row.some(Boolean));
  const nonEmptyCells = nonEmptyRows.reduce(
    (sum, row) => sum + row.filter(Boolean).length,
    0,
  );
  const headers = (nonEmptyRows[0] || []).filter(Boolean);
  const dataRows = Math.max(0, nonEmptyRows.length - (headers.length > 0 ? 1 : 0));
  const formulaCells = normalized.reduce(
    (sum, row) => sum + row.filter(cell => cell.startsWith("=")).length,
    0,
  );
  const sampleRows = nonEmptyRows.slice(headers.length > 0 ? 1 : 0, headers.length > 0 ? 4 : 3);

  if (formulaCells > 0) {
    return {
      title,
      nonEmptyRows: nonEmptyRows.length,
      nonEmptyCells,
      dataRows,
      formulaCells,
      headers,
      sampleRows,
      recommendation: "KEEP_REVIEW",
      reason: "Contains formulas; inspect manually before archive.",
    };
  }

  if (dataRows === 0) {
    return {
      title,
      nonEmptyRows: nonEmptyRows.length,
      nonEmptyCells,
      dataRows,
      formulaCells,
      headers,
      sampleRows,
      recommendation: "ARCHIVE_RECOMMENDED",
      reason: nonEmptyRows.length === 0 ? "No values found." : "Header-only sheet.",
    };
  }

  return {
    title,
    nonEmptyRows: nonEmptyRows.length,
    nonEmptyCells,
    dataRows,
    formulaCells,
    headers,
    sampleRows,
    recommendation: "KEEP_REVIEW",
    reason: "Contains data rows; inspect manually before archive.",
  };
}
