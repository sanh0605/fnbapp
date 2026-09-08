import { describe, expect, it } from "vitest";
import { buildStandaloneToppingProductLinks } from "./standalone-topping-links";

// docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 5 +
// BR-CATALOG-003 (owner decision 2026-09-08, "The link is the join, not the
// name"). One helper decides which product ids are linked standalone
// toppings so app/admin/reports/actions.ts (buildStandaloneToppingMap) and
// app/pos/actions.ts (getPOSBestSellerProductIds) read the same join instead
// of two copies of the same regex-on-a-dead-column logic.
describe("buildStandaloneToppingProductLinks", () => {
  it("maps a linked modifier's product_id to the modifier's own id", () => {
    const modifiers = [
      { id: "MOD-002", status: "ACTIVE", product_id: "PROD-020" },
    ];
    const result = buildStandaloneToppingProductLinks(modifiers);
    expect(result).toEqual(new Map([["PROD-020", "MOD-002"]]));
  });

  it("a modifier with no product_id (state c, e.g. MOD-009) contributes no entry", () => {
    const modifiers = [{ id: "MOD-009", status: "ACTIVE", product_id: null }];
    expect(buildStandaloneToppingProductLinks(modifiers)).toEqual(new Map());
  });

  // Real production shape, measured 2026-09-08: MOD-007 (DELETED) and
  // MOD-008 (ACTIVE) both carry product_id PROD-035 -- only one modifier may
  // ever govern that product's switch (plan question 3), so a DELETED
  // modifier must never win the map entry regardless of array order.
  it("a DELETED modifier never wins the link, even if it appears after the ACTIVE one", () => {
    const modifiers = [
      { id: "MOD-007", status: "DELETED", product_id: "PROD-035" },
      { id: "MOD-008", status: "ACTIVE", product_id: "PROD-035" },
    ];
    expect(buildStandaloneToppingProductLinks(modifiers)).toEqual(
      new Map([["PROD-035", "MOD-008"]]),
    );
  });

  it("a DELETED modifier appearing before the ACTIVE one still loses", () => {
    const modifiers = [
      { id: "MOD-008", status: "ACTIVE", product_id: "PROD-035" },
      { id: "MOD-007", status: "DELETED", product_id: "PROD-035" },
    ];
    expect(buildStandaloneToppingProductLinks(modifiers)).toEqual(
      new Map([["PROD-035", "MOD-008"]]),
    );
  });

  it("an empty modifiers list produces an empty map", () => {
    expect(buildStandaloneToppingProductLinks([])).toEqual(new Map());
  });

  // Opus code review, 2026-09-08: two ACTIVE modifiers pointing at one
  // product is the exact state 0098's sync_topping_price_atomic refuses at
  // write time ("more than one ACTIVE modifier -- price sync needs exactly
  // one writer"). Unreachable today (measured: 0 products with >1 ACTIVE
  // modifier), but this read-side helper must not resolve it by silent
  // first-or-last-wins the way the DELETED/ACTIVE case above was fixed to
  // avoid. Chosen here: skip, not refuse -- both getPnLDataV2 and
  // getPOSBestSellerProductIds call this on every page load / report run,
  // and app/pos/CLAUDE.md is explicit that POS must not go down over a data
  // anomaly. A collision drops that product_id from the map entirely
  // (falls through as an ordinary product, same as an unlinked orphan)
  // rather than crashing the read path, and is deterministic regardless of
  // input order -- unlike a thrown exception, which would still be a build
  // failure either way, this keeps reports and POS quick-add available
  // while the data anomaly gets fixed.
  it("two ACTIVE modifiers pointing at one product: the product is excluded from the map, not order-dependent", () => {
    const conflicted = [
      { id: "MOD-050", status: "ACTIVE", product_id: "PROD-200" },
      { id: "MOD-051", status: "ACTIVE", product_id: "PROD-200" },
      { id: "MOD-052", status: "ACTIVE", product_id: "PROD-201" },
    ];
    const reversed = [conflicted[1], conflicted[0], conflicted[2]];

    const resultA = buildStandaloneToppingProductLinks(conflicted);
    const resultB = buildStandaloneToppingProductLinks(reversed);

    expect(resultA).toEqual(new Map([["PROD-201", "MOD-052"]]));
    expect(resultB).toEqual(resultA);
  });
});
