import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-009 (owner 2026-10-08 "a"): a typed box that is still empty shows only
// a worked example in grey, "Ví dụ: …". No other grey text ("Tên hoặc mã...",
// "Không bắt buộc", "Nhập số...") and no "VD:" shorthand.
//
// Scanned: every .tsx under app and components, tests excluded, and the
// developer-only feedback tool (components/dev-feedback) excluded. Out of the
// rule by kind, as BR-UI-009 says:
// - the closed box of a pick list (SearchableSelect's own `placeholder`),
//   which names what to pick, not an example to type;
// - password boxes (type="password");
// - the date box's format hint in components/ui/DayInput.tsx.
// Only literal texts are read; a computed placeholder such as
// `Ví dụ: ${…}` or an inherited value is the template's own business.

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) return [];
    return [full];
  });
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const root = process.cwd();
const files = ["app", "components"]
  .flatMap(dir => sources(join(root, dir)))
  .map(f => ({ path: relative(root, f).split(sep).join("/"), src: stripComments(readFileSync(f, "utf8")) }))
  .filter(f => !f.path.startsWith("components/dev-feedback/"));

// The opening tag a placeholder attribute sits in: from the nearest "<Name"
// before it to the attribute itself.
function enclosingTag(src: string, at: number): { name: string; text: string } {
  const before = src.slice(0, at);
  const starts = [...before.matchAll(/<([A-Za-z][\w.]*)/g)];
  const last = starts[starts.length - 1];
  if (!last) return { name: "", text: "" };
  return { name: last[1], text: src.slice(last.index!, at) };
}

function offenders(): string[] {
  const out: string[] = [];
  const literal = /placeholder=(?:"([^"]*)"|\{\s*["'`]([^"'`$]*)["'`]\s*\})/g;
  for (const f of files) {
    for (const m of f.src.matchAll(literal)) {
      const text = m[1] ?? m[2] ?? "";
      if (text.startsWith("Ví dụ: ")) continue;
      const tag = enclosingTag(f.src, m.index!);
      if (tag.name === "SearchableSelect") continue;
      if (/type=["']password["']/.test(tag.text)) continue;
      if (f.path === "components/ui/DayInput.tsx" && text === "dd/mm/yyyy") continue;
      out.push(`${f.path}: "${text}"`);
    }
  }
  return out.sort();
}

describe("empty boxes show only a worked example (BR-UI-009)", () => {
  it("every literal placeholder of a typed box starts with \"Ví dụ: \"", () => {
    expect(offenders()).toEqual([]);
  });

  it("the scan reads real files (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some(f => f.path === "components/ui/SearchableSelect.tsx")).toBe(true);
  });
});
