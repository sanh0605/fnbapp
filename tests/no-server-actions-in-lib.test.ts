import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Every export of a "use server" file is a public endpoint. Endpoints live in
// app/, where each one starts with requireAdmin()/requireOwner(); lib/ holds
// helpers those endpoints call, so a directive there publishes an unguarded
// write (supersedeOrderV2, audit 2026-10-14).
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// The directive is the first statement; comments may come before it.
const DIRECTIVE = /^(?:\s*(?:\/\/[^\n]*(?=\n|$)|\/\*[\s\S]*?\*\/))*\s*["']use server["']/;

describe("lib/ has no server actions", () => {
  it("no file under lib/ starts with a \"use server\" directive", () => {
    const offenders = sourceFiles("lib").filter(f => DIRECTIVE.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
