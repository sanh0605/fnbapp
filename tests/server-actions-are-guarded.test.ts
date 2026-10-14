import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

// Every export of a "use server" file is a public endpoint (audit E8,
// 2026-10-14). Each exported async function must reach one of the guards.
const GUARDS = /\b(requireAdmin|requireOwner|resolveActor|getServerSession)\b/;
const DIRECTIVE = /^(?:\s*(?:\/\/[^\n]*(?=\n|$)|\/\*[\s\S]*?\*\/))*\s*["']use server["']/;

// "file:function" -> why it is allowed to be public.
const PUBLIC_ALLOW_LIST: Record<string, string> = {};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// Body of each `export async function name(...) { ... }` (repo formatting: closing brace alone on a line).
function exportedAsyncBodies(src: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const re = /export\s+async\s+function\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    // `}` alone on a line closes the function; `}> {` closing a return type does not.
    const end = src.slice(m.index).search(/\n\}\s*(\n|$)/);
    out.push([m[1], end === -1 ? src.slice(m.index) : src.slice(m.index, m.index + end)]);
  }
  return out;
}

describe("every server action asks who is calling", () => {
  it("no exported async function in an app/ \"use server\" file is unguarded", () => {
    const unguarded: string[] = [];
    for (const file of sourceFiles("app")) {
      const src = readFileSync(file, "utf8");
      if (!DIRECTIVE.test(src)) continue;
      const key = file.split(sep).join("/");
      for (const [name, body] of exportedAsyncBodies(src)) {
        if (!GUARDS.test(body) && !PUBLIC_ALLOW_LIST[`${key}:${name}`]) unguarded.push(`${key}:${name}`);
      }
    }
    expect(unguarded).toEqual([]);
  });
});
