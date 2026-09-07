import { describe, it, expect } from "vitest";
import { checkDocsRefs } from "./docs-refs-core";

const exists = (p: string) => p === "docs/02-rules/GLOSSARY.md";

describe("checkDocsRefs", () => {
  it("passes a reference to a doc that exists", () => {
    const r = checkDocsRefs([{ path: "lib/x.ts", content: "// see docs/02-rules/GLOSSARY.md" }], exists);
    expect(r.ok).toBe(true);
  });
  it("flags a reference to a deleted doc, naming file, line, and token", () => {
    const r = checkDocsRefs([{ path: "lib/x.ts", content: 'a\n// gone: docs/BUSINESS-RULES.md' }], exists); // docs-ref-allow: test fixture, path is test data not a real reference
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("lib/x.ts:2");
    expect(r.problems[0]).toContain("docs/BUSINESS-RULES.md"); // docs-ref-allow: test fixture, path is test data not a real reference
  });
  it("flags a deleted doc whose path is wrapped across two comment lines", () => {
    // How every dead plan reference hid from this gate until 2026-09-07: the path
    // breaks after a hyphen or a slash and continues on the next comment line.
    const content = "// the asset register (docs/superpowers/plans/2026-08-22-batch-3-asset-\n// register.md), never through a stock issue."; // docs-ref-allow: test fixture, path is test data not a real reference
    const r = checkDocsRefs([{ path: "app/x.ts", content }], exists);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("app/x.ts:1");
  });
  it("honors an inline docs-ref-allow marker", () => {
    const r = checkDocsRefs([{ path: "s/y.ts", content: 'const p = "docs/audits/gone.json"; // docs-ref-allow: history-only' }], exists);
    expect(r.ok).toBe(true);
  });
  it("catches deleted root doc filenames (DEVELOPMENT-TRACKING.md)", () => { // docs-ref-allow: test fixture, path is test data not a real reference
    const r = checkDocsRefs([{ path: "lib/x.ts", content: "// see DEVELOPMENT-TRACKING.md" }], exists); // docs-ref-allow: test fixture, path is test data not a real reference
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("DEVELOPMENT-TRACKING.md"); // docs-ref-allow: test fixture, path is test data not a real reference
  });
});
