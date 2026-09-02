import { serializeRelations, type Relation } from "../doc-map/relation-block";
import type { TableInfo } from "./extract-tables";
import type { WriteSite, UnresolvedWrite } from "./extract-writes";
import type { RouteActions } from "./extract-routes";

export function buildMap(input: {
  tables: TableInfo[];
  writes: WriteSite[];
  unresolved: UnresolvedWrite[];
  routes: RouteActions[];
}): string {
  const rels: Relation[] = input.writes.map(w => ({ from: w.file, to: w.table, kind: "write" }));
  const out: string[] = [];
  out.push("# System map (generated)");
  out.push("");
  out.push("Do not edit by hand. Regenerate with `vite-node scripts/system-map/generate.ts`.");
  out.push("");
  out.push("## Write relations");
  out.push(serializeRelations(rels));
  out.push("");
  out.push("## Tables");
  for (const t of input.tables) {
    const status = t.statusValues.length ? ` status: ${t.statusValues.join(", ")}` : "";
    out.push(`- ${t.name} (${t.columns.join(", ")})${status}`);
  }
  if (input.unresolved.length) {
    out.push("");
    out.push("## UNRESOLVED write-sites (need a human)");
    for (const u of input.unresolved) out.push(`- ${u.file}: ${u.reason}`);
  }
  return out.join("\n") + "\n";
}
