"use client";

import { useEffect } from "react";

// docs/superpowers/plans/2026-08-26-ui-feedback-tool.md section 3.
//
// Fast Refresh already preserves scroll position for a component edit; only
// a full reload does not. Persists scrollY to sessionStorage on unload and
// restores it once, and only for the same path -- restoring a stale offset
// onto a different page is worse than jumping to the top.
const STORAGE_KEY = "ui-feedback-tool:scroll";

export function ScrollRestoration() {
  useEffect(() => {
    const path = window.location.pathname;

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { path: savedPath, y } = JSON.parse(raw) as { path: string; y: number };
        if (savedPath === path) {
          window.scrollTo(0, y);
        }
        // Consumed once -- a later reload with nothing new saved should not
        // keep re-applying a now-stale offset.
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Malformed or inaccessible sessionStorage -- fall back to the
      // browser's own default (top of page), never throw.
    }

    function saveScroll() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ path: window.location.pathname, y: window.scrollY }));
      } catch {
        // Best-effort.
      }
    }

    window.addEventListener("beforeunload", saveScroll);
    return () => window.removeEventListener("beforeunload", saveScroll);
  }, []);

  return null;
}
