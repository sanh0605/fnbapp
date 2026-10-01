export type InventoryList =
  | "/admin/inventory/items"
  | "/admin/inventory/categories"
  | "/admin/inventory/units"
  | "/admin/inventory/conversions";

// Only a path inside the specified inventory list screen is accepted,
// so a crafted link cannot send the user off-site or to a different list after saving.
export function safeReturnTo(raw: string | undefined | null, list: InventoryList): string {
  if (!raw) return list;
  if (raw === list || raw.startsWith(`${list}?`)) return raw;
  return list;
}
