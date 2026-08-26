"use client";

import { useEffect, useState, type ComponentType } from "react";

// docs/superpowers/plans/2026-08-26-ui-feedback-tool.md section 6: "the
// import is conditional... Next tree-shakes the branch." The plan itself
// distrusts that claim enough to demand build evidence (section 6's own
// verification instruction), and rightly so -- app/layout.tsx is a Server
// Component, the toolbar must be a Client Component, and whether a plain
// `{NODE_ENV !== "production" && <Toolbar/>}` conditional is *guaranteed*
// to keep the client chunk out of a production visitor's browser is a real
// App Router uncertainty, not a settled fact.
//
// This loader is the stronger guarantee the plan asked me to look for: the
// heavy component is never imported at module scope at all, only inside a
// useEffect gated by the same NODE_ENV check, via a dynamic import(). A
// production browser's JS for this file never calls that import(), so it
// can never issue the network request that would fetch or execute the
// toolbar -- true regardless of whether static tree-shaking also removed
// the chunk. app/layout.tsx still wraps this in the plan's own literal
// `NODE_ENV !== "production"` conditional as well; this is defense in
// depth on top of that, not a replacement for it.
export function DevPreviewToolsLoader() {
  const [Tools, setTools] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    let cancelled = false;
    import("./DevPreviewTools").then(mod => {
      if (!cancelled) setTools(() => mod.DevPreviewTools);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Tools) return null;
  return <Tools />;
}
