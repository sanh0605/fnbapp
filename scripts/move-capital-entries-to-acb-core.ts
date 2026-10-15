// Pure part of scripts/move-capital-entries-to-acb.ts (owner answer 2026-10-15):
// the three "Vốn góp" hand rows were paid into ACB, not cash.
// The ACB account check reuses pickAcbAccount from the Shopee core.

export interface CashEntryRow {
  id: string;
  entry_date: string;
  category_id: string;
  amount: number;
  payment_method: string;
  bank_account_id: string | null;
  status: string;
}

// ACTIVE rows of the group still marked as cash.
export function planCapitalMove(entries: readonly CashEntryRow[], categoryId: string) {
  const targets = entries
    .filter((e) => e.category_id === categoryId && e.status === "ACTIVE" && e.payment_method === "CASH")
    .sort((a, b) => a.id.localeCompare(b.id));
  return { targets, total: targets.reduce((sum, e) => sum + Number(e.amount), 0) };
}

// The entries as they will read after the write; used to predict the balances.
export function withCapitalMove<T extends CashEntryRow>(entries: readonly T[], ids: readonly string[], accountId: string): T[] {
  const moved = new Set(ids);
  return entries.map((e) => (moved.has(e.id) ? { ...e, payment_method: "BANK_TRANSFER", bank_account_id: accountId } : e));
}
