# Design Spec: Symbol-Level Knowledge Graph Engine

## Overview
This document specifies the design for a "Grapuco-like" Knowledge Graph engine. It will parse the Next.js/TypeScript codebase (`app/`, `lib/`, `components/`, and `types/`) at the symbol level (functions, components, interfaces) using `ts-morph`. The engine will output a raw `knowledge-graph.json` for deep tooling integration and a dynamic, compressed `ARCHITECTURE.md` to provide immediate, token-efficient context to AI agents.

## Architecture

The engine will be implemented as a standalone Node.js CLI script (`scripts/generate-knowledge-graph.ts`).

### Data Model (JSON Schema)
The output `knowledge-graph.json` will adhere to a Nodes/Edges structure.

```typescript
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
```

### Execution Flow

1. **Initialization:** Initialize a `ts-morph` `Project` instance pointing to the workspace `tsconfig.json`. This ensures path aliases (e.g., `@/components/`) are resolved correctly.
2. **File Discovery:** Add source files from the target directories (`app/`, `lib/`, `components/`, `types/`).
3. **Node Extraction (First Pass):** Iterate through all files and extract exported declarations (Functions, Arrow Functions acting as components, Interfaces/Types). Create `GraphNode` entries.
4. **Edge Extraction (Second Pass):** 
   - For each exported declaration, use `ts-morph`'s `.findReferences()` or analyze import declarations and Call Expressions within the AST to identify dependencies.
   - Map these back to known `GraphNode` IDs to create `GraphEdge` entries.
5. **Output Generation:**
   - Write the structure to `scripts/output/knowledge-graph.json`.
   - Aggregate the data to generate a markdown summary and overwrite the project root `ARCHITECTURE.md`.

## Output 2: Dynamic `ARCHITECTURE.md`

The generated markdown should be highly compressed. It should group symbols by file/module and list their top-level consumers, serving as an index.

**Proposed Structure:**
```markdown
# Auto-Generated Architecture Map
*Last updated: [Timestamp]*

## Core Libraries (`lib/`)
* **`lib/sheets_db.ts`**
  * `findAll` -> Consumed by: `pos.ts`, `reports.ts`, `inventory.ts`
  * `update` -> Consumed by: `order-edit.ts`

## Actions (`app/actions/`)
* **`app/actions/pos.ts`**
  * `submitOrder` -> Consumes: `lib/sheets_db.ts`, `lib/crypto.ts` -> Consumed by: `POSScreen.tsx`
```

## `ts-morph` Implementation Tips & Constraints

1. **Performance & Memory:** `ts-morph` can consume significant memory. Do not load `node_modules`. Ensure the `Project` is initialized with `skipAddingFilesFromTsConfig: true` and manually add only the target directories (`app/`, `lib/`, `components/`, `types/`) using `project.addSourceFilesAtPaths()`.
2. **Finding Caller Dependencies:** While traversing a function's AST, use `node.forEachDescendant()` to find `CallExpression` nodes. You can then use the Type Checker (`project.getTypeChecker()`) to resolve the symbol being called and map it to its original declaration file/name. This is much faster than running `.findReferences()` globally for every symbol.
3. **Circular Dependencies:** The graph data structure natively handles circular references (A calls B, B calls A). When generating `ARCHITECTURE.md`, do not attempt to recursively print trees; simply list immediate dependencies to prevent infinite loops and stack overflows.
4. **Path Aliases:** Ensure your script handles `@/` imports. `ts-morph` usually resolves these if `tsconfig.json` is loaded correctly, but you may need to normalize paths to relative formats (e.g., `lib/sheets_db.ts`) for consistent Node IDs.
5. **JSDoc Extraction:** Use `node.getJsDocs()[0]?.getCommentText()` to easily grab the summary description for the node.

## Success Criteria
- Script executes without out-of-memory errors.
- `knowledge-graph.json` contains accurate node-to-node mapping.
- `ARCHITECTURE.md` provides a human and AI-readable overview of system boundaries.
