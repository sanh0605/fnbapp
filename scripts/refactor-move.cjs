// scripts/refactor-move.cjs -- one-off helper for the 2026-09 restructure
// (docs/superpowers/plans/2026-09-07-repo-structure.md). Deleted in that plan's last task.
//
// Usage: node scripts/refactor-move.cjs <old-module-path> <new-module-path>   (no extension)
//   e.g. node scripts/refactor-move.cjs lib/order-math lib/sales/order-math
//
// 1. git-mv the module and its sibling tests (<old>.test.ts, <old>.<x>.test.ts, .tsx variants)
// 2. rewrite every reference to the old path across the repo:
//    - alias form         @/lib/order-math
//    - repo-path form     lib/order-math.ts   (docs, comments, config strings)
//    - relative form      ./order-math, ../lib/order-math  (resolved against the importing file)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const [oldMod, newMod] = process.argv.slice(2);
if (!oldMod || !newMod) {
  console.error("usage: node scripts/refactor-move.cjs <old-module-path> <new-module-path>");
  process.exit(1);
}
const oldDir = path.posix.dirname(oldMod);
const oldBase = path.posix.basename(oldMod);
const newDir = path.posix.dirname(newMod);
const newBase = path.posix.basename(newMod);

// 1. move the module and its sibling tests
fs.mkdirSync(newDir, { recursive: true });
const siblings = fs
  .readdirSync(oldDir)
  .filter(
    (n) =>
      n === `${oldBase}.ts` ||
      n === `${oldBase}.tsx` ||
      (n.startsWith(`${oldBase}.`) && /\.test\.tsx?$/.test(n)),
  );
if (siblings.length === 0) {
  console.error(`nothing to move: no ${oldBase}.ts(x) in ${oldDir}`);
  process.exit(1);
}
for (const n of siblings) {
  const target = n.replace(oldBase, newBase);
  execSync(`git mv "${path.posix.join(oldDir, n)}" "${path.posix.join(newDir, target)}"`, { stdio: "inherit" });
}

// 2. rewrite references
const ROOTS = ["app", "lib", "components", "scripts", "supabase", "tests", "docs", ".claude", "types"];
const ROOT_FILES = ["CLAUDE.md", "README.md", "vitest.config.ts", "package.json", "middleware.ts"];
function walk(dir, out) {
  for (const e of fs.readdirSync(dir)) {
    // docs/superpowers holds this plan and the spec; their old paths are history, not references
    if (e === "node_modules" || e === ".next" || e === "superpowers") continue;
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|md|json|cjs|js|sh)$/.test(p)) out.push(p);
  }
  return out;
}
const files = [
  ...ROOTS.filter((r) => fs.existsSync(r)).flatMap((r) => walk(r, [])),
  ...ROOT_FILES.filter((f) => fs.existsSync(f)),
].map((p) => p.split(path.sep).join("/"));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const aliasRe = new RegExp(`@/${esc(oldMod)}(?=["'./:\\s)]|$)`, "g");
const docRe = new RegExp(`(?<![\\w/@])${esc(oldMod)}\\.(ts|tsx)\\b`, "g");
const relRe = /(from\s+|vi\.mock\(\s*|import\(\s*)(["'])(\.{1,2}\/[^"']+)\2/g;

let rewritten = 0;
for (const f of files) {
  const before = fs.readFileSync(f, "utf8");
  const dir = path.posix.dirname(f);
  let s = before.replace(aliasRe, `@/${newMod}`).replace(docRe, `${newMod}.$1`);
  s = s.replace(relRe, (m, kw, q, spec) => {
    const resolved = path.posix.normalize(path.posix.join(dir, spec)).replace(/\.(ts|tsx)$/, "");
    if (resolved === oldMod) return `${kw}${q}@/${newMod}${q}`;
    // a sibling that moved in the same call still imports "./<oldBase>"; keep it relative
    if (dir === newDir && resolved === path.posix.join(newDir, oldBase)) return `${kw}${q}./${newBase}${q}`;
    return m;
  });
  if (s !== before) {
    fs.writeFileSync(f, s);
    rewritten++;
  }
}
console.log(`${oldMod} -> ${newMod}: moved ${siblings.length} file(s), rewrote ${rewritten} file(s)`);
