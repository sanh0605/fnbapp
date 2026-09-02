import type { CheckResult } from "../check-result";

export type FlowDecl = {
  doc: string; routes: string[]; files: string[]; tables: string[]; brCodes: string[];
};

// Parse a fenced ```flow-decl block with four fixed keys (routes, files, tables,
// brCodes), each a comma-separated value list. Returns null when the markdown has
// no flow-decl fence (a doc without one is simply not a flow doc). Same
// fenced-block reading technique as doc-map/relation-block.ts parseRelationBlock.
export function parseFlowDecl(markdown: string, docPath: string): FlowDecl | null {
  const lines = markdown.split("\n");
  let inside = false;
  let found = false;
  const values: Record<string, string[]> = { routes: [], files: [], tables: [], brCodes: [] };
  for (const line of lines) {
    if (line.trim() === "```flow-decl") { inside = true; found = true; continue; }
    if (inside && line.trim() === "```") { inside = false; continue; }
    if (!inside) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!(key in values)) continue;
    values[key] = line.slice(colon + 1).split(",").map(s => s.trim()).filter(s => s.length > 0);
  }
  if (!found) return null;
  return {
    doc: docPath,
    routes: values.routes,
    files: values.files,
    tables: values.tables,
    brCodes: values.brCodes,
  };
}

export function checkFlowFacts(
  decl: FlowDecl,
  world: { routes: Set<string>; files: Set<string>; writesByFile: Map<string, Set<string>>; brCodes: Set<string> },
): CheckResult {
  const problems: string[] = [];
  for (const r of decl.routes) if (!world.routes.has(r)) problems.push(`${decl.doc}: route '${r}' does not exist`);
  for (const f of decl.files) if (!world.files.has(f)) problems.push(`${decl.doc}: file '${f}' does not exist`);
  for (const code of decl.brCodes) if (!world.brCodes.has(code)) problems.push(`${decl.doc}: rule '${code}' does not exist`);
  const actuallyWritten = new Set<string>();
  for (const f of decl.files) for (const t of world.writesByFile.get(f) ?? []) actuallyWritten.add(t);
  for (const t of decl.tables) {
    if (!actuallyWritten.has(t)) problems.push(`${decl.doc}: declares writing '${t}' but no declared file writes it`);
  }
  return { check: "flow-doc-facts", ok: problems.length === 0, problems };
}

export function checkFlowStagedCoupling(decls: FlowDecl[], stagedPaths: string[]): CheckResult {
  const staged = new Set(stagedPaths);
  const problems: string[] = [];
  for (const decl of decls) {
    const touched = decl.files.some(f => staged.has(f));
    if (touched && !staged.has(decl.doc)) {
      problems.push(`${decl.doc}: a declared source file changed but the flow doc was not updated ` +
        `(if truly behaviour-neutral, add a "reviewed, no behaviour change — <date>" line and stage the doc)`);
    }
  }
  return { check: "flow-doc-staged", ok: problems.length === 0, problems };
}
