import { describe, expect, it } from "vitest";
import { parseLineRecipeSnapshot } from "@/lib/order-types";

// docs/superpowers/plans/2026-08-31-remove-recipe-snapshots.md section 1.4
// named this "the fragile part": recipe_snapshot_json stops being written
// with real content (2026-09-01), so the parser must tolerate an empty
// cell without throwing.
//
// Checked empirically before writing this, per the instruction to prove
// redness rather than assume it: this function does NOT throw on the
// unfixed code. `if (!json || json === "{}" || json === "") { return
// <empty default> }` already guards the empty-string/null/undefined case,
// and the try/catch below it silently falls through to the same empty
// default on malformed JSON -- there is no throw statement in the function
// body at all, despite its own doc comment ("Throws InvariantError on
// malformed JSON") saying otherwise. The doc comment is stale, not the
// behavior; not corrected here, out of this task's stated scope (recipe
// snapshots, not this comment).
//
// This test is therefore NOT red-before/green-after -- it was already
// green, confirmed by temporarily running it against the unmodified
// function before any other change in this task. Written anyway, as a
// permanent regression lock: it is exactly the guarantee section 1.4 asks
// for, and the fact that it already held is worth pinning down precisely
// so a future change to this function can't silently remove it. The
// actual risk this task's write-side change eliminates was a different,
// unguarded `JSON.parse(...)` call at the old order-cart.ts:225
// (resolvedRecipes) -- removed outright (section 2), not patched, since
// nothing consumed its output.
describe("parseLineRecipeSnapshot tolerates an empty cell (order_lines_v2.recipe_snapshot_json after 2026-09-01)", () => {
  it("does not throw on an empty string, and returns the inert default shape", () => {
    expect(() => parseLineRecipeSnapshot("")).not.toThrow();
    const result = parseLineRecipeSnapshot("");
    expect(result).toEqual({
      variant: { target_type: "PRODUCT_VARIANT", target_id: "", ingredients: [] },
      modifiers: [],
    });
  });

  it("does not throw on malformed JSON, and returns the same inert default", () => {
    expect(() => parseLineRecipeSnapshot("not json")).not.toThrow();
    expect(parseLineRecipeSnapshot("not json")).toEqual({
      variant: { target_type: "PRODUCT_VARIANT", target_id: "", ingredients: [] },
      modifiers: [],
    });
  });
});
