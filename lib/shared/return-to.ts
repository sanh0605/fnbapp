// Only a path inside the given list screen is accepted, so a crafted link cannot send
// the user off-site or to another screen after saving. Accepts the list (with or without a
// query) and <list>/<id> (id not "new"); anything else returns the list.
// Per-list rules that older per-screen copies carried:
const NOT_AN_ID: Record<string, string[]> = {
  "/admin/finance": ["categories", "bank-accounts"],
  "/admin/products": ["categories", "modifiers"],
};

const ID = /^[A-Za-z0-9_-]+$/;

function isDetail(raw: string, base: string, skip: string[] = []): boolean {
  if (!raw.startsWith(`${base}/`)) return false;
  const rest = raw.slice(base.length + 1);
  const id = rest.split("?")[0];
  return id !== "new" && ID.test(id) && !skip.includes(id);
}

// opts.detail: more bases whose <base>/<id> is accepted (cash transfers under the cash book).
// opts.listOnly: accept the list itself only, no detail paths (orders).
export function safeReturnTo(
  raw: string | undefined | null,
  list: string,
  opts: { detail?: string[]; listOnly?: boolean } = {},
): string {
  if (!raw) return list;
  // The dashboard's monthly-reminder link enters the cash book and comes back to /admin.
  if (raw === "/admin" && list.startsWith("/admin/finance")) return raw;
  if (raw === list || raw.startsWith(`${list}?`)) return raw;
  if (opts.listOnly) return list;
  if (isDetail(raw, list, NOT_AN_ID[list])) return raw;
  if (opts.detail?.some((b) => isDetail(raw, b))) return raw;
  return list;
}
