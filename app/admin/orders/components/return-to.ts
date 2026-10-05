const LIST = "/admin/orders";

// Only a path inside the orders screen is accepted, so a crafted link
// cannot send the user off-site after saving or returning.
export function safeReturnTo(raw: string | undefined | null): string {
  if (!raw) return LIST;
  if (raw === LIST || raw.startsWith(`${LIST}?`)) return raw;
  return LIST;
}
