import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-018 (chosen on the owner's 2026-10-16 delegation, spec
// docs/superpowers/specs/2026-10-16-khuon-dien-thoai-design.md section 3.1):
// phone lists draw PhoneRow through DataList's phoneRow prop (required, so tsc rejects renderCard).

const root = process.cwd();
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [full] : [];
  });
}
const files = sources(join(root, "app", "admin"))
  .map(f => ({ path: relative(root, f).split(sep).join("/"), src: readFileSync(f, "utf8") }))
  .filter(f => /<DataList\b/.test(f.src));

describe("BR-UI-018 phone lists use PhoneRow", () => {
  it("finds the list screens", () => expect(files.length).toBeGreaterThanOrEqual(25));
  it("every list passes phoneRow", () => {
    expect(files.filter(f => !/phoneRow=/.test(f.src)).map(f => f.path)).toEqual([]);
  });
});
