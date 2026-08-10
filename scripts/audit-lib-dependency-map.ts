/**
 * Plan (owner) 2026-08-10: re-measure lib/'s dependency map ahead of the
 * deferred phase 3 restructure (docs/OPEN-ITEMS.md item 27). Read-only --
 * scans and reports, moves nothing.
 *
 * Supersedes the manual git-grep method behind
 * docs/audits/2026-08-02-lib-dependency-map.md, which undercounted usage by
 * 5x: it matched only `@/lib/x` and `./x`, missing the 61 `../lib/x`
 * imports scripts/ uses. This script parses every import/require/dynamic-
 * import specifier in every scanned file and resolves each one through the
 * same four forms this repo actually uses (@/lib/x, ../lib/x, ./x, ../x),
 * plus any deeper relative form (../../lib/x etc.) that a resolver, not a
 * fixed regex, catches for free.
 *
 * Method: walk app/, lib/, components/, scripts/, types/ for .ts/.tsx files
 * (excluding node_modules); for each file, regex out every
 * `from "..."` / `require("...")` / `import("...")` specifier; resolve
 * `@/x` against the repo root (tsconfig's own `@/*` -> `./*` mapping) and
 * `.`/`..`-prefixed specifiers against the importing file's own directory,
 * trying .ts/.tsx/.js and /index variants; keep only specifiers that
 * resolve to a real file under lib/. A module's own co-located test file
 * (X.test.ts importing ./X) is excluded from its importer count -- testing
 * a module is not the same as something depending on it.
 *
 * Run: npx vite-node scripts/audit-lib-dependency-map.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "lib", "components", "scripts", "types"];
const EXCLUDE_DIR_NAMES = new Set(["node_modules", ".next", ".git"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const IMPORT_RE = /\bfrom\s*["']([^"']+)["']/g;
const REQUIRE_RE = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

function extractSpecifiers(content: string): string[] {
  const specs: string[] = [];
  for (const re of [IMPORT_RE, REQUIRE_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) specs.push(m[1]);
  }
  return specs;
}

function resolveSpecifier(spec: string, importerFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) {
    base = path.join(ROOT, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = path.resolve(path.dirname(importerFile), spec);
  } else {
    return null; // external package, not something this map tracks
  }
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function isTestFile(file: string): boolean {
  return /\.test\.(ts|tsx)$/.test(file);
}

function ownTestFileOf(file: string): string | null {
  if (isTestFile(file)) return null;
  const withoutExt = file.replace(/\.(ts|tsx)$/, "");
  const ext = file.endsWith(".tsx") ? ".tsx" : ".ts";
  const candidate = `${withoutExt}.test${ext}`;
  return fs.existsSync(candidate) ? candidate : null;
}

const allFiles = SCAN_DIRS.flatMap(d => walk(path.join(ROOT, d)));
const libDir = path.join(ROOT, "lib");

const libModules = allFiles.filter(f => f.startsWith(libDir + path.sep) && !isTestFile(f));

// importers: libModulePath -> Set of file paths that import it (excluding its own test)
const importers = new Map<string, Set<string>>();
// libToLib: libModulePath -> Set of lib/ modules it imports
const libToLib = new Map<string, Set<string>>();
for (const m of libModules) {
  importers.set(m, new Set());
  libToLib.set(m, new Set());
}

for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf8");
  const specs = extractSpecifiers(content);
  for (const spec of specs) {
    const resolved = resolveSpecifier(spec, file);
    if (!resolved) continue;
    if (!resolved.startsWith(libDir + path.sep)) continue;
    if (!importers.has(resolved)) continue; // resolved to a .test.ts or unknown -- skip

    const ownTest = ownTestFileOf(resolved);
    if (file === ownTest) continue; // a module's own test doesn't count as a real importer

    importers.get(resolved)!.add(file);
    if (libToLib.has(file)) {
      libToLib.get(file)!.add(resolved);
    }
  }
}

function rel(p: string): string {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

// ---- Report ----

const topLevel = libModules.filter(m => path.dirname(m) === libDir);
const inSubdirs = libModules.filter(m => path.dirname(m) !== libDir);

console.log(`Top-level lib/ modules: ${topLevel.length}`);
console.log(`lib/ modules in subdirectories: ${inSubdirs.length}`);
const subdirs = new Set(inSubdirs.map(m => path.relative(libDir, path.dirname(m))));
console.log(`Subdirectories: ${[...subdirs].sort().join(", ")}`);

console.log("\n--- Zero importers (unreferenced candidates) ---");
const zero = libModules.filter(m => importers.get(m)!.size === 0);
for (const m of zero) console.log(`  ${rel(m)}`);

console.log("\n--- Used only by scripts/ (never by app/, lib/, components/) ---");
const scriptsOnly = libModules.filter(m => {
  const imp = importers.get(m)!;
  if (imp.size === 0) return false;
  return [...imp].every(i => i.startsWith(path.join(ROOT, "scripts") + path.sep));
});
for (const m of scriptsOnly) console.log(`  ${rel(m)} (${importers.get(m)!.size} importer(s))`);

console.log("\n--- Full importer/importee table (JSON, for programmatic use) ---");
const table = libModules.map(m => ({
  module: rel(m),
  importerCount: importers.get(m)!.size,
  importers: [...importers.get(m)!].map(rel).sort(),
  importsFromLib: [...libToLib.get(m)!].map(rel).sort(),
}));
console.log(JSON.stringify(table, null, 2));

console.log("\n--- Files over 500 lines (app/, lib/, components/) ---");
const bigFiles: Array<{ file: string; lines: number }> = [];
for (const dir of ["app", "lib", "components"]) {
  for (const f of walk(path.join(ROOT, dir))) {
    if (isTestFile(f)) continue;
    const lines = fs.readFileSync(f, "utf8").split("\n").length;
    if (lines > 500) bigFiles.push({ file: rel(f), lines });
  }
}
bigFiles.sort((a, b) => b.lines - a.lines);
for (const { file, lines } of bigFiles) console.log(`  ${lines}\t${file}`);
