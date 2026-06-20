import { Project, Node, CallExpression, SyntaxKind } from "ts-morph";
import * as fs from "fs";
import * as path from "path";

interface GraphNode {
  id: string;          // e.g., "lib/report-utils.ts::computeLineRevenue"
  type: "function" | "component" | "interface" | "file";
  file: string;        // Relative path, e.g., "lib/report-utils.ts"
  name: string;        // e.g., "computeLineRevenue"
  description: string; // Extracted JSDoc or first line of implementation
}

interface GraphEdge {
  source: string;      // Node ID of the caller/consumer
  target: string;      // Node ID of the dependency
  type: "calls" | "imports" | "implements";
}

interface KnowledgeGraph {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}

const ROOT_DIR = process.cwd();

function getRelativePath(absolutePath: string) {
  let rel = path.relative(ROOT_DIR, absolutePath).replace(/\\/g, "/");
  return rel;
}

async function main() {
  console.log("[generate-knowledge-graph] Initializing ts-morph project...");
  const project = new Project({
    tsConfigFilePath: path.join(ROOT_DIR, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  const targetDirs = ["app/**/*.ts", "app/**/*.tsx", "lib/**/*.ts", "components/**/*.tsx", "types/**/*.ts"];
  console.log(`[generate-knowledge-graph] Adding source files from: ${targetDirs.join(", ")}`);
  
  targetDirs.forEach(glob => {
    project.addSourceFilesAtPaths(glob);
  });

  const typeChecker = project.getTypeChecker();
  const graph: KnowledgeGraph = { nodes: {}, edges: [] };
  const sourceFiles = project.getSourceFiles();
  
  console.log(`[generate-knowledge-graph] Analyzed ${sourceFiles.length} source files.`);

  // Pass 1: Extract Nodes (Exported Declarations)
  console.log("[generate-knowledge-graph] Pass 1: Extracting nodes...");
  
  for (const sf of sourceFiles) {
    const relPath = getRelativePath(sf.getFilePath());
    
    // Add file node
    graph.nodes[relPath] = {
      id: relPath,
      type: "file",
      file: relPath,
      name: path.basename(relPath),
      description: `File: ${relPath}`
    };

    const exportedDecls = sf.getExportedDeclarations();
    for (const [name, decls] of exportedDecls.entries()) {
      for (const decl of decls) {
        let type: GraphNode["type"] = "function";
        let description = "";

        if (Node.isFunctionDeclaration(decl)) {
          type = "function";
          description = decl.getJsDocs()[0]?.getCommentText() || "";
        } else if (Node.isVariableDeclaration(decl)) {
          const init = decl.getInitializer();
          if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
            type = "function";
            // Check if it looks like a React Component (Capitalized name)
            if (/^[A-Z]/.test(name)) {
              type = "component";
            }
          } else {
             continue; // Skip non-function variables
          }
        } else if (Node.isInterfaceDeclaration(decl) || Node.isTypeAliasDeclaration(decl)) {
          type = "interface";
          description = decl.getJsDocs()[0]?.getCommentText() || "";
        } else {
           continue; // Skip other exports
        }

        const nodeId = `${relPath}::${name}`;
        graph.nodes[nodeId] = {
          id: nodeId,
          type,
          file: relPath,
          name,
          description: description.trim()
        };
      }
    }
  }

  // Pass 2: Extract Edges (Call Expressions via forEachDescendant)
  console.log("[generate-knowledge-graph] Pass 2: Extracting edges...");
  
  for (const sf of sourceFiles) {
    const relPath = getRelativePath(sf.getFilePath());
    const exportedDecls = sf.getExportedDeclarations();
    
    for (const [callerName, decls] of exportedDecls.entries()) {
      for (const decl of decls) {
        if (!Node.isFunctionDeclaration(decl) && !Node.isVariableDeclaration(decl)) continue;
        
        const sourceId = `${relPath}::${callerName}`;
        if (!graph.nodes[sourceId]) continue;

        decl.forEachDescendant(node => {
          if (Node.isCallExpression(node)) {
            const expr = node.getExpression();
            const symbol = typeChecker.getSymbolAtLocation(expr);
            if (symbol) {
              const aliasedSymbol = symbol.getAliasedSymbol() || symbol;
              const valueDecl = aliasedSymbol.getValueDeclaration();
              if (valueDecl) {
                const targetFilePath = valueDecl.getSourceFile().getFilePath();
                const targetRelPath = getRelativePath(targetFilePath);
                
                // Only track internal dependencies
                if (!targetRelPath.includes("node_modules")) {
                   const targetName = aliasedSymbol.getName();
                   const targetId = `${targetRelPath}::${targetName}`;
                   
                   if (graph.nodes[targetId]) {
                     graph.edges.push({
                       source: sourceId,
                       target: targetId,
                       type: "calls"
                     });
                   }
                }
              }
            }
          }
        });
      }
    }
  }

  // Deduplicate edges
  const uniqueEdges = new Set<string>();
  const finalEdges: GraphEdge[] = [];
  for (const edge of graph.edges) {
    const key = `${edge.source}->${edge.target}`;
    if (!uniqueEdges.has(key)) {
      uniqueEdges.add(key);
      finalEdges.push(edge);
    }
  }
  graph.edges = finalEdges;

  console.log(`[generate-knowledge-graph] Extracted ${Object.keys(graph.nodes).length} nodes and ${graph.edges.length} edges.`);

  // Write JSON
  const outputDir = path.join(ROOT_DIR, "scripts", "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "knowledge-graph.json");
  fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2), "utf8");
  console.log(`[generate-knowledge-graph] Wrote JSON to ${jsonPath}`);

  // Generate ARCHITECTURE.md
  console.log("[generate-knowledge-graph] Generating ARCHITECTURE.md...");
  let md = `# Auto-Generated Architecture Map\n*Last updated: ${new Date().toISOString()}*\n\n`;

  // Group nodes by directory/module
  const libNodes = Object.values(graph.nodes).filter(n => n.file.startsWith("lib/"));
  const actionNodes = Object.values(graph.nodes).filter(n => n.file.startsWith("app/") && n.file.includes("actions.ts"));
  
  function getConsumers(nodeId: string) {
    return graph.edges.filter(e => e.target === nodeId).map(e => e.source);
  }

  function getConsumes(nodeId: string) {
    return graph.edges.filter(e => e.source === nodeId).map(e => e.target);
  }

  function renderGroup(title: string, nodes: GraphNode[]) {
    if (nodes.length === 0) return "";
    let out = `## ${title}\n`;
    
    // Group by file
    const byFile: Record<string, GraphNode[]> = {};
    for (const n of nodes) {
      if (n.type === "file") continue;
      if (!byFile[n.file]) byFile[n.file] = [];
      byFile[n.file].push(n);
    }

    for (const [file, fileNodes] of Object.entries(byFile)) {
      out += `* **\`${file}\`**\n`;
      for (const fn of fileNodes) {
        const consumers = getConsumers(fn.id).map(id => `\`${id.split("::")[1] || id}\``).join(", ");
        const consumes = getConsumes(fn.id).map(id => `\`${id.split("::")[1] || id}\``).join(", ");
        
        let line = `  * \`${fn.name}\``;
        if (consumes) line += ` -> Consumes: ${consumes}`;
        if (consumers) line += ` -> Consumed by: ${consumers}`;
        out += `${line}\n`;
      }
    }
    return out + "\n";
  }

  md += renderGroup("Core Libraries (`lib/`)", libNodes);
  md += renderGroup("Actions (`app/actions/`)", actionNodes);

  // Add more sections as needed, but keep it compressed.
  const componentsNodes = Object.values(graph.nodes).filter(n => n.file.startsWith("components/"));
  md += renderGroup("Shared Components (`components/`)", componentsNodes);

  const archPath = path.join(ROOT_DIR, "ARCHITECTURE.md");
  fs.writeFileSync(archPath, md, "utf8");
  console.log(`[generate-knowledge-graph] Wrote ARCHITECTURE.md to ${archPath}`);
}

main().catch(console.error);
