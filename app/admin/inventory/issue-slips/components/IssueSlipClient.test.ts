import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// OPEN-ITEMS 38. This file used to assert 20 claims about IssueSlipClient
// against source text -- converted to real render tests in
// IssueSlipClient.test.tsx, which is where that coverage now lives.
//
// What is left here is deliberately narrow: the two-column-on-wide-screen
// layout (`lg:grid-cols-2`) is a Tailwind breakpoint-conditional class.
// jsdom builds a DOM with no real layout engine and does not evaluate media
// queries -- the single-column and two-column arrangements are the exact
// same static className in the rendered tree regardless of viewport, so a
// render test cannot tell a correct breakpoint from a swapped one. This is
// bucket (b) from the task's own classification -- a claim a render test
// genuinely cannot express -- not an oversight. Same reasoning as
// StocktakeClient.test.ts's M1/M4 cases.
const source = readFileSync(resolve(__dirname, "IssueSlipClient.tsx"), "utf8");

describe("IssueSlipClient Plan D D10 -- two-column layout, a CSS-only claim a render test cannot see", () => {
  it("form and recent slips sit in two columns on a wide screen, one column otherwise", () => {
    expect(source).toContain("function TwoColumnLayout(");
    expect(source).toContain("lg:grid-cols-2");
  });
});
