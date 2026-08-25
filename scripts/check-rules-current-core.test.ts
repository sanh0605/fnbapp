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

// docs/superpowers/plans/2026-08-26-undated-data-claims.md.
describe("check 4: a number with a data unit must have a date nearby", () => {
  it("fails and names a line carrying a number-plus-unit with no date anywhere nearby", () => {
    write("CLAUDE.md", "Kho hiện có 0đ giá trị hàng tồn.");
    const result = resultFor("undated-data-claims", ["CLAUDE.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("0đ");
  });

  it("passes the identical claim once a date sits on the same line", () => {
    // The original defect this gate exists to catch: CLAUDE.md section 7
    // carried "stock_issues rong, gia von 0d" with no date at all.
    write("CLAUDE.md", "Đo 2026-08-07: kho hiện có 0đ giá trị hàng tồn.");
    expect(resultFor("undated-data-claims", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("accepts a date within the small window above the claim", () => {
    write("CLAUDE.md", "Đo 2026-08-07.\nMột dòng đệm ở giữa.\nKho hiện có 300 đơn.");
    expect(resultFor("undated-data-claims", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("still flags a date that sits outside the window", () => {
    write("CLAUDE.md", "Đo 2026-08-07.\nA.\nB.\nC.\nD.\nKho hiện có 300 đơn.");
    const result = resultFor("undated-data-claims", ["CLAUDE.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toContain("300");
  });

  it("recognises DD/MM dates, not only YYYY-MM-DD", () => {
    write("CLAUDE.md", "Đo 26/08: kho hiện có 300 đơn.");
    expect(resultFor("undated-data-claims", ["CLAUDE.md"]).ok).toBe(true);
  });

  // Found by hand while measuring this exact file: a naive "digit, optional
  // space, d" regex reads the day-of-month in "24/08 da" as "08 d" (8 dong),
  // because "da" (da roi) starts with the same letter as the currency unit.
  it("does not mistake a date's day-of-month plus the next word's first letter for a currency figure", () => {
    write("CLAUDE.md", "Ngày 24/08 đã viết lại một bản thiết kế cũ.");
    expect(resultFor("undated-data-claims", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("requires a space before a multi-character unit, so a bare number is not a claim", () => {
    write("CLAUDE.md", "Phòng họp 20 người, không liên quan đến đơn hàng.");
    expect(resultFor("undated-data-claims", ["CLAUDE.md"]).ok).toBe(true);
  });

  it("the escape-hatch marker suppresses exactly the line it is on, not its neighbours", () => {
    write(
      "CLAUDE.md",
      "Kho hiện có 0đ giá trị hàng tồn. <!-- undated-ok -->\n" +
        "Đã bán 500 đơn trong tháng.",
    );
    const result = resultFor("undated-data-claims", ["CLAUDE.md"]);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).not.toContain("0đ");
    expect(result.problems.join(" ")).toContain("500");
  });

  // Scoping to RULE_DOCS is enforced by the caller's docs list (this check
  // has no internal allow-list of its own, unlike check 2's
  // AGENT_CURRENT_DOCS) -- proven here by simply not passing the file in.
  it("never reads a document that was not passed in the docs list", () => {
    write("DEVELOPMENT-TRACKING.md", "Ngày xong: đã xử lý 900 đơn không ghi ngày lại lần nữa.");
    expect(resultFor("undated-data-claims", []).ok).toBe(true);
  });
});
