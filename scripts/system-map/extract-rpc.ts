import type { WriteSite, UnresolvedWrite } from "./extract-writes";

const RPC_CALL = /\.rpc\(\s*"([a-z_]+)"/g;

export function rpcCallSites(files: { path: string; source: string }[]): { file: string; fn: string }[] {
  const out: { file: string; fn: string }[] = [];
  for (const { path, source } of files) {
    for (const m of source.matchAll(RPC_CALL)) out.push({ file: path, fn: m[1] });
  }
  return out;
}

// Latest definition wins: iterate sqlSources in order, overwrite the map.
const FN_DEF = /create\s+(?:or replace\s+)?function\s+(?:public\.)?(\w+)\b([\s\S]*?)\$\$([\s\S]*?)\$\$/gi;
const WRITE_TARGET = /(?:insert\s+into|update|delete\s+from)\s+(?:public\.)?(\w+)/gi;

export function rpcWriteTargets(sqlSources: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const sql of sqlSources) {
    for (const def of sql.matchAll(FN_DEF)) {
      const fn = def[1];
      const body = def[3];
      const tables = new Set<string>();
      for (const w of body.matchAll(WRITE_TARGET)) tables.add(w[1]);
      map.set(fn, [...tables].sort()); // later migration overwrites earlier
    }
  }
  return map;
}

export function resolveRpcWrites(
  callSites: { file: string; fn: string }[],
  targets: Map<string, string[]>,
): { writes: WriteSite[]; unresolved: UnresolvedWrite[] } {
  const writes: WriteSite[] = [];
  const unresolved: UnresolvedWrite[] = [];
  for (const { file, fn } of callSites) {
    const tables = targets.get(fn);
    if (!tables) { unresolved.push({ file, reason: `rpc('${fn}') has no function body found in migrations` }); continue; }
    for (const table of tables) writes.push({ file, table });
  }
  const key = (w: WriteSite) => `${w.file}|${w.table}`;
  const deduped = [...new Map(writes.map(w => [key(w), w])).values()]
    .sort((a, b) => a.file.localeCompare(b.file) || a.table.localeCompare(b.table));
  return { writes: deduped, unresolved };
}
