// Only paths to the cash book or a cash transfer detail page are accepted,
// so a crafted link cannot send the user off-site or to an arbitrary page after saving.
// Accepts:
// - /admin/finance (with or without query string)
// - /admin/finance/transfers/<id> (with or without query string, where id is not "new")
export function safeReturnTo(
  raw: string | undefined | null,
  fallback: string = "/admin/finance",
): string {
  if (!raw) return fallback;
  if (raw === "/admin/finance" || raw.startsWith("/admin/finance?")) return raw;

  if (raw.startsWith("/admin/finance/transfers/")) {
    const after = raw.slice("/admin/finance/transfers/".length);
    const qIndex = after.indexOf("?");
    const id = qIndex === -1 ? after : after.slice(0, qIndex);

    if (id !== "new" && /^[A-Za-z0-9_-]+$/.test(id)) {
      return raw;
    }
  }

  return fallback;
}
