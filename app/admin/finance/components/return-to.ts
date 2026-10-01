export type FinanceList =
  | "/admin/finance"
  | "/admin/finance/categories"
  | "/admin/finance/bank-accounts";

// Only a path inside the specified finance list screen is accepted,
// so a crafted link cannot send the user off-site or to a different list after saving.
export function safeReturnTo(raw: string | undefined | null, list: FinanceList): string {
  if (!raw) return list;
  if (raw === list || raw.startsWith(`${list}?`)) return raw;
  return list;
}
