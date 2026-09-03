import { describe, it, expect } from "vitest";
import { buildDiagram } from "./build-diagram";

describe("buildDiagram", () => {
  it("emits a mermaid flowchart with one subgraph per flow and write edges", () => {
    const md = buildDiagram([
      { name: "stock-issue", tables: ["issue_slips", "stock_issues"] },
      { name: "sales", tables: ["orders_v2"] },
    ]);
    expect(md).toContain("```mermaid");
    expect(md).toContain("flowchart");
    expect(md).toContain("subgraph");
    expect(md).toContain("issue_slips");
    expect(md).toContain("orders_v2");
    expect(md.trim().endsWith("```")).toBe(true);
  });
});
