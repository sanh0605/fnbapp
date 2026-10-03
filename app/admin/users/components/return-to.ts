const LIST = "/admin/users";

// Only a path inside the users screen is accepted, so a crafted link
// cannot send the user off-site after saving. Accepts the list screen and
// valid record detail paths (/admin/users/<id>), refusing "new", other
// lists, and off-site URLs.
export function safeReturnTo(raw: string | undefined | null): string {
  if (!raw) return LIST;
  if (raw === LIST || raw.startsWith(`${LIST}?`)) return raw;
  if (raw.startsWith(`${LIST}/`)) {
    const afterList = raw.slice(LIST.length + 1);
    const qIndex = afterList.indexOf("?");
    const id = qIndex === -1 ? afterList : afterList.slice(0, qIndex);

    if (id !== "new" && /^[A-Za-z0-9_-]+$/.test(id)) {
      return raw;
    }
  }
  return LIST;
}
