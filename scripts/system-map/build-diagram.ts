// Pure builder for the generated architecture diagram. Given the flow-decls
// (each flow's name plus the tables it writes), emit a Mermaid flowchart as a
// markdown string. Kept pure and deterministic so the diagram regenerates
// identically from the same input and cannot drift from the flow-decls the doc
// gates already enforce. The CLI wrapper lives in generate-diagram.ts.

export type DiagramFlow = { name: string; tables: string[] };

// Mermaid node ids must be alphanumeric + underscore. Any other character in a
// flow or table name is replaced so the id is always safe; the original name is
// still shown verbatim in the node label.
function safeId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_]/g, "_");
}

export function buildDiagram(flows: DiagramFlow[]): string {
  // Sort flows and their tables so the output is deterministic.
  const sortedFlows = flows
    .map(f => ({ name: f.name, tables: [...f.tables].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lines: string[] = [];
  lines.push("# Architecture diagram (generated)");
  lines.push("");
  lines.push(
    "Do not edit by hand. Regenerate with `vite-node scripts/system-map/generate-diagram.ts`.",
  );
  lines.push("");
  lines.push("```mermaid");
  lines.push("flowchart LR");
  for (const flow of sortedFlows) {
    const flowId = safeId(flow.name);
    const flowNode = `flow_${flowId}`;
    lines.push(`  subgraph ${flowId}["${flow.name}"]`);
    lines.push(`    ${flowNode}(["${flow.name}"])`);
    // Table node ids are scoped to the flow so a table written by two flows
    // stays a distinct node inside each subgraph (mermaid cannot share a node
    // across subgraphs cleanly).
    for (const table of flow.tables) {
      lines.push(`    ${flowId}__${safeId(table)}["${table}"]`);
    }
    lines.push("  end");
    for (const table of flow.tables) {
      lines.push(`  ${flowNode} -->|ghi| ${flowId}__${safeId(table)}`);
    }
  }
  lines.push("```");
  return lines.join("\n") + "\n";
}
