export type InventoryList =
  | "/admin/inventory/items"
  | "/admin/inventory/categories"
  | "/admin/inventory/units"
  | "/admin/inventory/conversions"
  | "/admin/inventory/assets"
  | "/admin/inventory/asset-bands";

// Only a path inside the specified inventory list screen is accepted,
// so a crafted link cannot send the user off-site or to a different list after saving.
export function safeReturnTo(raw: string | undefined | null, list: InventoryList): string {
  if (!raw) return list;
  if (raw === list || raw.startsWith(`${list}?`)) return raw;
  if (raw.startsWith(`${list}/`)) {
    const afterList = raw.slice(list.length + 1);
    const qIndex = afterList.indexOf("?");
    const id = qIndex === -1 ? afterList : afterList.slice(0, qIndex);
    if (id !== "new" && /^[A-Za-z0-9_-]+$/.test(id)) {
      return raw;
    }
  }
  return list;
}
