"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export const LAST_URL_PREFIX = "fnb:last-url:";

export function getRememberedUrl(pathname: string): string | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(LAST_URL_PREFIX + pathname);
  } catch {
    return null;
  }
}

export function setRememberedUrl(pathname: string, fullUrl: string): void {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    window.sessionStorage.setItem(LAST_URL_PREFIX + pathname, fullUrl);
  } catch {
    // Ignore storage exceptions (private browsing, disabled storage, quota)
  }
}

export function AdminRouteMemory(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    try {
      const query = searchParams ? searchParams.toString() : "";
      const fullUrl = query ? `${pathname}?${query}` : pathname;
      setRememberedUrl(pathname, fullUrl);
    } catch {
      // Storage guard
    }
  }, [pathname, searchParams]);

  return null;
}
