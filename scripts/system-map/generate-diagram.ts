import { writeFileSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { parseFlowDecl } from "../doc-checks/flow-doc-core";
import { buildDiagram, type DiagramFlow } from "./build-diagram";

// CLI: read every flow doc under docs/03-workflows, parse its flow-decl for the
// tables it writes, and emit a Mermaid architecture diagram to
// docs/generated/architecture.md. Built from the same flow-decls the doc gates
// check, so the picture tracks the code and cannot drift silently.
const root = process.cwd();
const workflowsDir = join(root, "docs/03-workflows");

const flows: DiagramFlow[] = [];
for (const entry of readdirSync(workflowsDir)) {
  if (!entry.endsWith(".md")) continue;
  const full = join(workflowsDir, entry);
  const decl = parseFlowDecl(readFileSync(full, "utf8"), `docs/03-workflows/${entry}`);
  if (!decl) continue; // a doc without a flow-decl fence is not a flow doc
  flows.push({ name: basename(entry, ".md"), tables: decl.tables });
}

const diagram = buildDiagram(flows);
mkdirSync(join(root, "docs/generated"), { recursive: true });
writeFileSync(join(root, "docs/generated/architecture.md"), diagram);
console.log(`[architecture] ${flows.length} flows diagrammed`);
