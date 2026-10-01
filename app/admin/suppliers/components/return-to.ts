const LIST = "/admin/suppliers";

// Only a path inside the suppliers screen is accepted, so a crafted link
// cannot send the user off-site after saving.
export function safeReturnTo(raw: string | undefined | null): string {
  if (!raw) return LIST;
  if (raw === LIST || raw.startsWith(`${LIST}?`)) return raw;
  return LIST;
}
