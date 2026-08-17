import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// OPEN-ITEMS 38. This file used to assert the whole of StocktakeClient's
// behaviour against source text -- converted to real render tests in
// StocktakeClient.test.tsx, which is where that coverage now lives.
//
// What is left here is deliberately narrow: Tailwind responsive/positioning
// classes whose actual effect (an element hidden at one breakpoint and
// shown at another; an element staying visible on screen while the page
// scrolls) is CSS media-query and layout behaviour that jsdom does not
// evaluate. jsdom builds a DOM with no real layout engine -- both the
// "hidden md:block" and "md:hidden" variants of the same table are
// simultaneously present in the rendered tree regardless of viewport, and
// position: fixed has no scroll physics to observe. A render test cannot
// tell the difference between these classes being correct and them being
// swapped; only a source check (or real browser/visual testing, out of
// scope here) can. This is bucket (b) from the task's own classification --
// a claim a render test genuinely cannot express -- not an oversight.
const source = readFileSync(resolve(__dirname, "StocktakeClient.tsx"), "utf8");

describe("StocktakeClient Plan D D10 -- mobile (M1/M4), CSS-only claims a render test cannot see", () => {
  it("M1: the confirm-preview table has a stacked-card alternative for phones, not just overflow-x-auto", () => {
    expect(source).toContain('hidden md:block');
    expect(source).toContain('md:hidden space-y-2');
    expect(source).toContain("grid-cols-1 sm:grid-cols-3");
  });

  it("M4: the progress badge is pinned (position: fixed), so it stays visible without scrolling back to the top", () => {
    expect(source).toContain("fixed right-4 bottom-");
  });
});
