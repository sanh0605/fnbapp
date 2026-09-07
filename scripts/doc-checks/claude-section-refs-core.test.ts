import { describe, it, expect } from "vitest";
import { checkClaudeSectionRefs } from "./claude-section-refs-core";

const headings = new Set(["Lệnh", "Luật dữ liệu", "Viết code"]);

describe("checkClaudeSectionRefs", () => {
  it("flags a pointer to a CLAUDE.md section number", () => {
    // Section numbers rot the moment CLAUDE.md is reordered; the 2026-09-07 trim
    // left 37 of them pointing at sections that no longer existed.
    const r = checkClaudeSectionRefs([{ path: "lib/x.ts", content: "// gate per CLAUDE.md section 9" }], headings); // claude-section-allow: test fixture, not a real pointer
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("lib/x.ts:1");
  });

  it("flags the section-sign and Rule spellings of the same pointer", () => {
    // Both forms survived the 2026-09-07 trim untouched because the first version
    // of this gate only knew the words "section" and "mục".
    const r = checkClaudeSectionRefs([
      { path: "docs/a.md", content: "bands live in a screen (`CLAUDE.md` §8's rule)" }, // claude-section-allow, docs-ref-allow: test fixture
      { path: "docs/b.md", content: "measure it (CLAUDE.md, Rule 0)" }, // claude-section-allow, docs-ref-allow: test fixture
    ], headings);
    expect(r.ok).toBe(false);
    expect(r.problems).toHaveLength(2);
  });

  it("flags a quoted heading CLAUDE.md does not have", () => {
    const r = checkClaudeSectionRefs([{ path: "lib/x.ts", content: '// per CLAUDE.md "Mức rủi ro"' }], headings); // claude-section-allow: test fixture, not a real pointer
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("Mức rủi ro");
  });

  it("passes a quoted heading that CLAUDE.md still has", () => {
    const r = checkClaudeSectionRefs([{ path: "lib/x.ts", content: '// per CLAUDE.md "Luật dữ liệu"' }], headings);
    expect(r.ok).toBe(true);
  });

  it("leaves a section number that belongs to some other document alone", () => {
    const r = checkClaudeSectionRefs([{ path: "lib/x.ts", content: "// plan section 3, measured against CLAUDE.md alone" }], headings); // claude-section-allow: test fixture, not a real pointer
    expect(r.ok).toBe(true);
  });
});
