import { writeFileSync, readFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { extractTables } from "./extract-tables";
import { extractWrites } from "./extract-writes";
import { rpcCallSites, rpcWriteTargets, resolveRpcWrites } from "./extract-rpc";
import { extractRoutes } from "./extract-routes";
import { buildMap } from "./build-map";

const root = process.cwd();
function walk(dir: string, hit: (p: string) => void) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, hit);
    else hit(full);
  }
}
const sql: string[] = [];
walk(join(root, "supabase/migrations"), p => { if (p.endsWith(".sql")) sql.push(readFileSync(p, "utf8")); });
const codeFiles: { path: string; source: string }[] = [];
for (const base of ["app", "lib"]) {
  walk(join(root, base), p => {
    if (!p.endsWith(".ts") || p.endsWith(".test.ts")) return;
    // Exclude the adapter files that call the DB verbs with a parameter, not a
    // real table name: sheets_db (the adapter) and shared-actions (the generic
    // wrapper). Including them only produces permanent, meaningless "unresolved"
    // noise (Sonnet round-4 review). lib/historical is dead code.
    if (p.includes("sheets_db") || p.includes(join("lib", "shared-actions")) || p.includes(join("lib", "historical"))) return;
    codeFiles.push({ path: relative(root, p).split(sep).join("/"), source: readFileSync(p, "utf8") });
  });
}
const tables = extractTables(sql);
const direct = extractWrites(codeFiles);
const rpc = resolveRpcWrites(rpcCallSites(codeFiles), rpcWriteTargets(sql));
// Merge and dedupe direct + RPC write-sites.
const key = (w: { file: string; table: string }) => `${w.file}|${w.table}`;
const writes = [...new Map([...direct.writes, ...rpc.writes].map(w => [key(w), w])).values()]
  .sort((a, b) => a.file.localeCompare(b.file) || a.table.localeCompare(b.table));
const unresolved = [...direct.unresolved, ...rpc.unresolved];
const map = buildMap({ tables, writes, unresolved, routes: extractRoutes([]) });
mkdirSync(join(root, "docs/generated"), { recursive: true });
writeFileSync(join(root, "docs/generated/system-map.md"), map);
console.log(`[system-map] ${tables.length} tables, ${writes.length} writes, ${unresolved.length} unresolved`);
