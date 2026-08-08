import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "IssueSlipClient.tsx"), "utf8");

describe("IssueSlipClient -- Plan D D7a", () => {
  it("enters quantity in purchase units via a package-size picker, same shape as counting (I3)", () => {
    expect(source).toContain("item?.packageLines.map(p =>");
    expect(source).toContain("p.sizeLabel");
    // The base quantity sent to the server is derived, not typed directly.
    expect(source).toContain("parsedQty * pkg.conversionRate");
  });

  it("warns which months move before submitting a backdated slip, and requires an explicit confirm (I6)", () => {
    expect(source).toContain("computeAffectedMonths");
    expect(source).toContain("affectedMonths.length > 0");
    expect(source).toContain("if (!approved) return;");
  });

  it("does not compute or check on-hand itself -- I4's refusal comes from the RPC, surfaced verbatim", () => {
    expect(source).not.toMatch(/parsedQty\s*>\s*item/);
    expect(source).toContain("I4/I5 refusals from the RPC surface here verbatim");
  });

  it("defaults the time field to now and lets it be edited, storing a real instant not a bare date", () => {
    expect(source).toContain('type="datetime-local"');
    expect(source).toContain("toLocalInputValue(new Date())");
    expect(source).toContain("issuedAt.toISOString()");
  });
});
