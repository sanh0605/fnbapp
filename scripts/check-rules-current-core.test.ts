import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRulesCurrent } from "./check-rules-current-core";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rules-check-"));
  mkdirSync(join(root, "lib"), { recursive: true });
  mkdirSync(join(root, "docs"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(relativePath: string, contents: string): void {
  writeFileSync(join(root, relativePath), contents, "utf8");
}

function resultFor(check: string, docs: string[]) {
  return checkRulesCurrent(docs, root).find(r => r.check === check)!;
}

describe("check 1: every path named in a rule doc exists", () => {
  it("passes when every named path is real", () => {
    write("lib/real-file.ts", "export const x = 1;");
    write("CLAUDE.md", "Read `lib/real-file.ts` before editing.");
    expect(resultFor("paths-exist", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("fails and names the missing path", () => {
    write("CLAUDE.md", "Read `lib/deleted-file.ts` before editing.");
    const result = resultFor("paths-exist", ["CLAUDE.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("lib/deleted-file.ts");
  });

  it("ignores glob patterns, which name no single file", () => {
    write("CLAUDE.md", "UI lives in `app/**/page.tsx`.");
    expect(resultFor("paths-exist", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("ignores backticked text that is not a path", () => {
    write("CLAUDE.md", "Run `npx tsc --noEmit` and `--apply` carefully.");
    expect(resultFor("paths-exist", ["CLAUDE.md"]).ok).toBe(true);
  });

  // Prefix matching alone skipped every root-level file, so CLAUDE.md could
  // point at a deleted README.md forever without the checker noticing.
  it("checks root-level documents that carry no directory prefix", () => {
    write("CLAUDE.md", "Bối cảnh nằm ở `CONTEXT.md`.");
    const result = resultFor("paths-exist", ["CLAUDE.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("CONTEXT.md");
  });

  it("passes a root-level document that exists", () => {
    write("CONTEXT.md", "bối cảnh");
    write("CLAUDE.md", "Bối cảnh nằm ở `CONTEXT.md`.");
    expect(resultFor("paths-exist", ["CLAUDE.md"]).ok).toBe(true);
  });

  // Documents under docs/ cite their siblings relatively. Resolving only from
  // the repo root would fail every one of them.
  it("resolves a sibling reference relative to the citing document", () => {
    write("docs/ACCESS-MODEL.md", "roles");
    write("docs/BUSINESS-RULES.md", "Xem `ACCESS-MODEL.md`.");
    expect(resultFor("paths-exist", ["docs/BUSINESS-RULES.md"]).ok).toBe(true);
  });
});

describe("check 2: no retired agent is named as current", () => {
  it("passes for the two current agents", () => {
    write("CLAUDE.md", "Opus 5 coordinates. Sonnet 5 implements.");
    expect(resultFor("no-retired-agents", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("fails and names the retired agent", () => {
    write("CLAUDE.md", "Codex owns the engine files.");
    const result = resultFor("no-retired-agents", ["CLAUDE.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("Codex");
  });

  // OPEN-ITEMS.md must be able to say a task was stranded when Codex left.
  // Policing history out of the backlog would destroy the very record that
  // makes stranded work findable.
  it("polices only the rulebook, not the backlog", () => {
    write("docs/OPEN-ITEMS.md", "Việc này từng giao cho Codex, agent đã ngừng.");
    expect(resultFor("no-retired-agents", ["docs/OPEN-ITEMS.md"]).ok).toBe(true);
  });
});

describe("check 3: a declared test link points at a test that exists", () => {
  it("passes when the test file and the test name are both present", () => {
    write("lib/rounding.test.ts", `it("tiền luôn làm tròn lên", () => {});`);
    write(
      "docs/BUSINESS-RULES.md",
      'Test: `lib/rounding.test.ts` — "tiền luôn làm tròn lên"',
    );
    expect(resultFor("business-rule-tests", ["docs/BUSINESS-RULES.md"]).ok).toBe(true);
  });

  it("fails when the test file is missing", () => {
    write("docs/BUSINESS-RULES.md", 'Test: `lib/gone.test.ts` — "một luật nào đó"');
    expect(resultFor("business-rule-tests", ["docs/BUSINESS-RULES.md"]).ok).toBe(false);
  });

  it("fails when the file exists but no longer contains the named test", () => {
    write("lib/rounding.test.ts", `it("một tên khác hẳn", () => {});`);
    write(
      "docs/BUSINESS-RULES.md",
      'Test: `lib/rounding.test.ts` — "tiền luôn làm tròn lên"',
    );
    const result = resultFor("business-rule-tests", ["docs/BUSINESS-RULES.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("tiền luôn làm tròn lên");
  });

  it("passes a rule that declares no test link at all", () => {
    write("docs/BUSINESS-RULES.md", "Một luật chưa có test.");
    expect(resultFor("business-rule-tests", ["docs/BUSINESS-RULES.md"]).ok).toBe(true);
  });
});
