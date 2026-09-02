export type WriteSite = { file: string; table: string };
export type UnresolvedWrite = { file: string; reason: string };

const SHEETS_VERBS = ["insert", "insertMany", "update", "updateMany", "remove", "removeMany"];
const WRAPPERS = ["createEntity", "updateEntity", "deleteEntity", "softDeleteEntity"];

// `const NAME = "Table"` declarations in the same file.
function localConsts(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of source.matchAll(/const\s+(\w+)\s*=\s*"([^"]+)"/g)) map.set(m[1], m[2]);
  return map;
}

// Resolve one call argument to a table name, or null if not statically known.
function resolveArg(arg: string, consts: Map<string, string>): string | null {
  const literal = /^"([^"]+)"$/.exec(arg.trim());
  if (literal) return literal[1];
  const asConst = consts.get(arg.trim());
  return asConst ?? null;
}

function firstArg(callBody: string): string {
  // callBody is what's inside the parens; take up to the first top-level comma.
  let depth = 0;
  for (let i = 0; i < callBody.length; i++) {
    const c = callBody[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) return callBody.slice(0, i);
  }
  return callBody;
}

// A single regex cannot match a balanced call — insert(computeName(x), data)
// would stop at the inner ")". Scan forward from each verb name, tracking paren
// depth, to capture the whole argument list. The `(?<![.\w])` lookbehind skips
// method calls (supabase's `.update(...)`, `.insert(...)`) and identifiers that
// merely end in a verb name; sheets_db verbs and shared-actions wrappers are
// always called as bare functions.
const VERB_CALL = /(?<![.\w])(\w+)\s*\(/g;
const SUPABASE_WRITE = /\.from\(\s*"([^"]+)"\s*\)\s*\.\s*(insert|update|upsert|delete)\b/g;

function callArgs(source: string, openParenIndex: number): string | null {
  let depth = 1;
  let i = openParenIndex + 1;
  const start = i;
  for (; i < source.length && depth > 0; i++) {
    const c = source[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
  }
  return depth === 0 ? source.slice(start, i - 1) : null;
}

export function extractWrites(files: { path: string; source: string }[]) {
  const writes: WriteSite[] = [];
  const unresolved: UnresolvedWrite[] = [];

  for (const { path, source } of files) {
    const consts = localConsts(source);

    for (const sm of source.matchAll(SUPABASE_WRITE)) {
      writes.push({ file: path, table: sm[1] });
    }

    for (const m of source.matchAll(VERB_CALL)) {
      const fn = m[1];
      if (!SHEETS_VERBS.includes(fn) && !WRAPPERS.includes(fn)) continue;
      const argsBody = callArgs(source, m.index + m[0].length - 1);
      if (argsBody === null) continue;
      const arg = firstArg(argsBody);
      const table = resolveArg(arg, consts);
      if (table) writes.push({ file: path, table });
      else unresolved.push({ file: path, reason: `${fn}(...) with a non-literal table argument: ${arg.trim()}` });
    }
  }

  const key = (w: WriteSite) => `${w.file}|${w.table}`;
  const deduped = [...new Map(writes.map(w => [key(w), w])).values()]
    .sort((a, b) => a.file.localeCompare(b.file) || a.table.localeCompare(b.table));
  return { writes: deduped, unresolved };
}
