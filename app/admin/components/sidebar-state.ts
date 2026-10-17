import { NAV_GROUPS } from "../nav-items";

const KEY = "fnb.sidebarCollapsed";

export function readSidebarCollapsed(getStorage: () => Pick<Storage, "getItem"> | null): boolean {
  try {
    return getStorage()?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(getStorage: () => Pick<Storage, "setItem"> | null, collapsed: boolean): void {
  try {
    getStorage()?.setItem(KEY, collapsed ? "1" : "0");
  } catch {
    // Private window or blocked site data: the choice just is not remembered.
  }
}

function normalizePathname(pathname: string): string {
  if (pathname === "/admin/inventory/conversions" || pathname.startsWith("/admin/inventory/conversions/")) {
    return "/admin/inventory/items";
  }
  return pathname;
}

/**
 * Returns the href of the single child whose href matches the given pathname
 * (either exactly or as a prefix followed by '/') with the longest href.
 * Returns null if no child matches.
 */
export function activeChildHref(pathname: string, children: { href: string }[]): string | null {
  const path = normalizePathname(pathname);
  let best: { href: string; length: number } | null = null;
  for (const child of children) {
    const hit = path === child.href || path.startsWith(`${child.href}/`);
    if (hit && (!best || child.href.length > best.length)) {
      best = { href: child.href, length: child.href.length };
    }
  }
  return best?.href ?? null;
}

export function activeGroupName(pathname: string): string | null {
  const path = normalizePathname(pathname);
  let best: { name: string; length: number } | null = null;
  for (const group of NAV_GROUPS) {
    const hrefs = group.href ? [group.href] : (group.children ?? []).map(c => c.href);
    for (const href of hrefs) {
      const hit = href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);
      if (hit && (!best || href.length > best.length)) best = { name: group.name, length: href.length };
    }
  }
  return best?.name ?? null;
}
