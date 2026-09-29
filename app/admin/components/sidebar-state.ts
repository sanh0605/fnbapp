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

export function activeGroupName(pathname: string): string | null {
  let best: { name: string; length: number } | null = null;
  for (const group of NAV_GROUPS) {
    const hrefs = group.href ? [group.href] : (group.children ?? []).map(c => c.href);
    for (const href of hrefs) {
      const hit = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
      if (hit && (!best || href.length > best.length)) best = { name: group.name, length: href.length };
    }
  }
  return best?.name ?? null;
}
