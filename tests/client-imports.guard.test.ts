import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

// A "use client" screen that reaches next/cache, next/headers or lib/db through a
// lib module passes tsc and vitest but fails `npm run build` (B1, 2026-10-18).
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// `import type` is erased, so only the other imports can pull a module into the client bundle.
function valueImports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/^import\s+(?!type\b)(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm)].map(m => m[1]);
}

const isClient = (file: string) => /^\s*["']use client["']/.test(readFileSync(file, "utf8"));

const isServerOnly = (spec: string, file: string) =>
  /^next\/(cache|headers)$|^@\/lib\/db\//.test(spec) ||
  (file.startsWith("lib/db/") && /^\.\/(supabase|tables)$/.test(spec));

function resolveLib(spec: string): string | undefined {
  const base = spec.slice(2);
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find(existsSync);
}

describe("client screens", () => {
  it("import no lib module that reaches server-only code", () => {
    const offenders = [...sourceFiles("app"), ...sourceFiles("components")].filter(isClient).flatMap(file =>
      valueImports(file).filter(spec => spec.startsWith("@/lib/")).flatMap(spec => {
        const mod = resolveLib(spec);
        return mod && valueImports(mod).some(s => isServerOnly(s, mod)) ? [`${file} → ${mod}`] : [];
      }));
    expect(offenders, "Client screens must not import server-only modules (build breaks)").toEqual([]);
  });
});
