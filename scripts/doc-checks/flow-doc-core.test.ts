import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkFlowFacts,
  checkFlowStagedCoupling,
  parseFlowDecl,
  type FlowDecl,
} from "./flow-doc-core";

const decl: FlowDecl = {
  doc: "docs/03-workflows/stock-issue.md",
  routes: ["/admin/inventory/issue-slips"],
  files: ["lib/manual-issue-transaction.ts"],
  tables: ["stock_issues"],
  brCodes: ["BR-COGS-005"],
};

describe("checkFlowFacts", () => {
  it("passes when every declared fact matches reality", () => {
    const r = checkFlowFacts(decl, {
      routes: new Set(["/admin/inventory/issue-slips"]),
      files: new Set(["lib/manual-issue-transaction.ts"]),
      writesByFile: new Map([["lib/manual-issue-transaction.ts", new Set(["stock_issues"])]]),
      brCodes: new Set(["BR-COGS-005"]),
    });
    expect(r.ok).toBe(true);
  });

  it("fails when a declared table is not actually written by the declared files", () => {
    const r = checkFlowFacts(decl, {
      routes: new Set(["/admin/inventory/issue-slips"]),
      files: new Set(["lib/manual-issue-transaction.ts"]),
      writesByFile: new Map([["lib/manual-issue-transaction.ts", new Set()]]),
      brCodes: new Set(["BR-COGS-005"]),
    });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("stock_issues");
  });
});

describe("checkFlowStagedCoupling", () => {
  it("fails when a flow's source file is staged but its doc is not", () => {
    const r = checkFlowStagedCoupling([decl], ["lib/manual-issue-transaction.ts"]);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("stock-issue.md");
  });

  it("passes when both the source file and its doc are staged", () => {
    const r = checkFlowStagedCoupling([decl],
      ["lib/manual-issue-transaction.ts", "docs/03-workflows/stock-issue.md"]);
    expect(r.ok).toBe(true);
  });
});

describe("parseFlowDecl", () => {
  it("parses a flow-decl block into a FlowDecl", () => {
    const md = [
      "# Luồng xuất kho",
      "```flow-decl",
      "routes: /admin/inventory/issue-slips",
      "files: lib/manual-issue-transaction.ts",
      "tables: issue_slips, stock_issues",
      "brCodes: BR-COGS-005",
      "```",
    ].join("\n");
    expect(parseFlowDecl(md, "docs/03-workflows/stock-issue.md")).toEqual({
      doc: "docs/03-workflows/stock-issue.md",
      routes: ["/admin/inventory/issue-slips"],
      files: ["lib/manual-issue-transaction.ts"],
      tables: ["issue_slips", "stock_issues"],
      brCodes: ["BR-COGS-005"],
    });
  });

  it("returns null when the markdown has no flow-decl fence", () => {
    expect(parseFlowDecl("# Just prose\n\nNo declaration here.", "docs/x.md")).toBeNull();
  });

  it("parses the real seed workflow doc", () => {
    const md = readFileSync("docs/03-workflows/stock-issue.md", "utf8");
    const parsed = parseFlowDecl(md, "docs/03-workflows/stock-issue.md");
    expect(parsed).not.toBeNull();
    expect(parsed!.files).toContain("lib/manual-issue-transaction.ts");
    expect(parsed!.tables).toContain("stock_issues");
  });
});
