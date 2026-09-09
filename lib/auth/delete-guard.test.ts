import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// BR-ACCESS-003 (owner decision 2026-09-08): every role below ADMIN may
// create, edit and cancel. Only ADMIN may destroy a row for good.
const HARD_DELETE_ACTIONS: Array<[string, string]> = [
  ["app/admin/inventory/actions.ts", "deleteItemCategory"],
  ["app/admin/inventory/actions.ts", "deletePurchasedItem"],
  ["app/admin/inventory/actions.ts", "deleteConversion"],
  ["app/admin/inventory/actions.ts", "deleteUnit"],
  ["app/admin/inventory/asset-bands/actions.ts", "deleteAssetBand"],
  ["app/admin/inventory/conversions/actions.ts", "deleteConversionAction"],
  ["app/admin/inventory/items/actions.ts", "deletePurchasedItemAction"],
  ["app/admin/promotions/actions.ts", "deletePromotionAction"],
  ["app/admin/users/actions.ts", "deleteUserAction"],
  // Both of these delete through the shared deleteEntity() helper. The guard
  // belongs here, in the caller: the helper is not handed an actor, and its
  // siblings createEntity/updateEntity carry no guard either.
  ["app/admin/brands/actions.ts", "deleteBrand"],
  ["app/admin/suppliers/actions.ts", "deleteSupplierAction"],
  // Added by the controller ruling for task 7: these three were built by
  // tasks 4-6 of this same plan after the brief above was written, and must
  // be covered by the same regression test.
  ["app/admin/finance/categories/actions.ts", "deleteCashCategory"],
  ["app/admin/finance/bank-accounts/actions.ts", "deleteBankAccount"],
  ["app/admin/finance/actions.ts", "deleteCashEntry"],
];

const read = (f: string) => readFileSync(resolve(process.cwd(), f), "utf8");

// The guard is the first thing each function does, so looking at its head is
// enough -- and stops a requireAdmin in a neighbouring function passing.
const head = (source: string, fn: string) => {
  const start = source.indexOf(`function ${fn}(`);
  expect(start, `${fn} not found`).toBeGreaterThan(-1);
  return source.slice(start, start + 400);
};

describe("permanent deletion is ADMIN only", () => {
  it.each(HARD_DELETE_ACTIONS)("%s :: %s calls requireOwner", (file, fn) => {
    const h = head(read(file), fn);
    expect(h).toContain("requireOwner()");
    expect(h).not.toContain("requireAdmin()");
  });

  it("leaves the POS draft delete alone -- the owner's stated exception", () => {
    const source = read("app/pos/actions.ts");
    expect(source).toContain('remove("POS_Drafts", draftId)');
    expect(source).not.toContain("requireOwner");
  });

  it("leaves the two sibling-conversion cleanups alone -- those are edits", () => {
    // Tightening these would stop a MANAGER editing an item at all.
    expect(head(read("app/admin/inventory/actions.ts"), "updatePurchasedItem"))
      .toContain("requireAdmin()");
    expect(head(read("app/admin/inventory/items/actions.ts"), "updatePurchasedItem"))
      .toContain("requireAdmin()");
  });
});
