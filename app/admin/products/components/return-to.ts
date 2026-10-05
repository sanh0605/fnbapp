export type ProductsList =
  | "/admin/products"
  | "/admin/products/categories"
  | "/admin/products/modifiers";

// Only a path inside the specified products list screen is accepted,
// so a crafted link cannot send the user off-site or to a different list after saving.
export function safeReturnTo(
  raw: string | undefined | null,
  list: ProductsList = "/admin/products"
): string {
  if (!raw) return list;
  if (raw === list || raw.startsWith(`${list}?`)) return raw;
  if (raw.startsWith(`${list}/`)) {
    const afterList = raw.slice(list.length + 1);
    const qIndex = afterList.indexOf("?");
    const id = qIndex === -1 ? afterList : afterList.slice(0, qIndex);

    if (list === "/admin/products") {
      if (id === "categories" || id === "modifiers") {
        return list;
      }
      if (afterList.startsWith("categories/") || afterList.startsWith("modifiers/")) {
        return list;
      }
    }

    if (id !== "new" && /^[A-Za-z0-9_-]+$/.test(id)) {
      return raw;
    }
  }
  return list;
}
