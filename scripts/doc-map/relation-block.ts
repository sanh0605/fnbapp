export type Relation = { from: string; to: string; kind: "write" | "read" };

const LINE = /^(\S+)\s*->\s*(\S+)\s*\((write|read)\)\s*$/;

export function parseRelationBlock(markdown: string): Relation[] {
  const rels: Relation[] = [];
  const lines = markdown.split("\n");
  let inside = false;
  for (const line of lines) {
    if (line.trim() === "```relations") { inside = true; continue; }
    if (inside && line.trim() === "```") { inside = false; continue; }
    if (!inside) continue;
    const m = LINE.exec(line.trim());
    if (m) rels.push({ from: m[1], to: m[2], kind: m[3] as "write" | "read" });
  }
  return rels;
}

export function serializeRelations(rels: Relation[]): string {
  const sorted = [...rels].sort((a, b) =>
    a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
  const body = sorted.map(r => `${r.from} -> ${r.to} (${r.kind})`).join("\n");
  return "```relations\n" + body + "\n```";
}
