import { describe, it, expect } from "vitest";
import { checkOrphanModules } from "./orphan-modules-core";

describe("checkOrphanModules", () => {
  it("passes a module that is imported somewhere", () => {
    const r = checkOrphanModules([{ path: "lib/a.ts", content: "export const a=1" }], new Set(["lib/a.ts"]));
    expect(r.ok).toBe(true);
  });
  it("flags a module imported by nothing", () => {
    const r = checkOrphanModules([{ path: "lib/dead.ts", content: "export const d=1" }], new Set());
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("lib/dead.ts");
  });
  it("honors an orphan-allow marker", () => {
    const r = checkOrphanModules([{ path: "lib/tool.ts", content: "// orphan-allow: standalone CLI helper\nexport const t=1" }], new Set());
    expect(r.ok).toBe(true);
  });
});
