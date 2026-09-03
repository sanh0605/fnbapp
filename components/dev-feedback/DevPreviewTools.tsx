"use client";

import { ScrollRestoration } from "./ScrollRestoration";
import { UiFeedbackTool } from "./UiFeedbackTool";

// The one component app/layout.tsx loads for the local-preview workflow.
// Kept out of
// production by two independent guards -- see
// components/dev-feedback/DevPreviewToolsLoader.tsx and
// app/api/dev-feedback/route.ts's own gate.
export function DevPreviewTools() {
  return (
    <>
      <ScrollRestoration />
      <UiFeedbackTool />
    </>
  );
}
