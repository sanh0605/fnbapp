export type ProductsList =
  | "/admin/products"
  | "/admin/products/categories"
  | "/admin/products/modifiers";

// Only a path inside the specified products list screen is accepted,
// so a crafted link cannot send the user off-site or to a different list after saving.
export function safeReturnTo(raw: string | undefined | null, list: ProductsList = "/admin/products"): string {
  if (!raw) return list;
  if (raw === list || raw.startsWith(`${list}?`)) return raw;
  return list;
}
