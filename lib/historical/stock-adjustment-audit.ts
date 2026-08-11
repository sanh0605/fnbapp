export function auditStockAdjustmentLedgerLinks(
  adjustments: Array<Record<string, unknown>>,
  ledgerRows: Array<Record<string, unknown>>,
): {
  approvedCount: number;
  missingLedgerIds: string[];
  duplicateLedgerIds: string[];
  mismatchedLedgerIds: string[];
} {
  const approved = adjustments.filter((row) => row.status === "APPROVED");
  const missingLedgerIds: string[] = [];
  const duplicateLedgerIds: string[] = [];
  const mismatchedLedgerIds: string[] = [];

  for (const adjustment of approved) {
    const id = String(adjustment.id || "");
    const matches = ledgerRows.filter((row) =>
      row.reference_id === id && row.transaction_type === "STOCK_ADJUST"
    );
    if (matches.length === 0) {
      missingLedgerIds.push(id);
      continue;
    }
    if (matches.length > 1) {
      duplicateLedgerIds.push(id);
      continue;
    }
    if (
      matches[0].item_reference !== adjustment.item_reference ||
      Number(matches[0].quantity_change) !== Number(adjustment.difference)
    ) {
      mismatchedLedgerIds.push(id);
    }
  }

  return {
    approvedCount: approved.length,
    missingLedgerIds,
    duplicateLedgerIds,
    mismatchedLedgerIds,
  };
}
