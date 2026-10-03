export type FinanceList =
  | "/admin/finance"
  | "/admin/finance/categories"
  | "/admin/finance/bank-accounts";

// Only a path inside the specified finance list screen is accepted,
// so a crafted link cannot send the user off-site or to a different list after saving.
// Additionally accepts ${list}/<id> optionally followed by ?..., where id
// matches /^[A-Za-z0-9_-]+$/ and is not "new".
// For list = "/admin/finance", also refuses "categories" and "bank-accounts".
export function safeReturnTo(raw: string | undefined | null, list: FinanceList): string {
  if (!raw) return list;
  if (raw === list || raw.startsWith(`${list}?`)) return raw;

  if (raw.startsWith(`${list}/`)) {
    const afterList = raw.slice(list.length + 1);
    const qIndex = afterList.indexOf("?");
    const id = qIndex === -1 ? afterList : afterList.slice(0, qIndex);

    if (id !== "new" && /^[A-Za-z0-9_-]+$/.test(id)) {
      if (list === "/admin/finance" && (id === "categories" || id === "bank-accounts")) {
        return list;
      }
      return raw;
    }
  }

  return list;
}
