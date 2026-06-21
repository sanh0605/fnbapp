"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/**
 * Render children into document.body via React Portal.
 *
 * Why: ancestors with `backdrop-filter`, `transform`, or `filter` create a
 * containing block that traps `position: fixed` modals — causing the overlay
 * to size/position wrong. Portals escape any ancestor.
 *
 * SSR-safe: returns null until mounted.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
