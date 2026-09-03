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
    expect(r.problems[0]).toContain("docs/BUSINESS-RULES.md");
  });
  it("honors an inline docs-ref-allow marker", () => {
    const r = checkDocsRefs([{ path: "s/y.ts", content: 'const p = "docs/audits/gone.json"; // docs-ref-allow: history-only' }], exists);
    expect(r.ok).toBe(true);
  });
  it("catches deleted root doc filenames (DEVELOPMENT-TRACKING.md)", () => {
    const r = checkDocsRefs([{ path: "lib/x.ts", content: "// see DEVELOPMENT-TRACKING.md" }], exists); // docs-ref-allow: test fixture, path is test data not a real reference
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("DEVELOPMENT-TRACKING.md");
  });
});
