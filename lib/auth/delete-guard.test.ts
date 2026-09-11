import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative, sep } from "node:path";
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
  // I2 (final-fix-brief.md): a never-sold product is erased for good,
  // history and all -- CLAUDE.md's "Món chưa bán lần nào được xoá hẳn kèm
  // lịch sử giá … chỉ vai ADMIN xoá, chặn bằng requireOwner()". This was
  // guarded by requireAdmin() (MANAGER could erase a product), found by
  // the I2 completeness scan below.
  ["app/admin/products/actions.ts", "eraseProduct"],
];

// I2 completeness check -- a scan, not a fixed list, so a NEW hard delete
// added later fails this test by default instead of silently shipping
// unguarded. Named exemptions are a delete that is a side effect inside an
// edit/create flow, not a row the user picked to destroy.
const EXEMPTIONS: Array<[string, string, string]> = [
  ["app/pos/actions.ts", "deletePOSDraft", "the owner's stated exception -- a draft is scratch state, never history"],
  ["app/admin/inventory/actions.ts", "updatePurchasedItem", "sibling-conversion cleanup inside an edit, not a user-picked delete"],
  ["app/admin/inventory/items/actions.ts", "updatePurchasedItem", "sibling-conversion cleanup inside an edit, not a user-picked delete"],
];

// remove()/removeMany() (lib/db/tables.ts) and deleteEntity() (lib/db/shared-actions.ts)
// are the only bulk-delete helpers in the codebase. eraseProduct itself calls
// neither directly -- it goes through eraseProductAtomic()'s .rpc(), so the
// erase-prefixed-call pattern is needed too; grep across the whole repo
// confirms "erase" naming is used exclusively for that one hard-delete path
// (no other rpc("erase_..." or rpc("delete_..." exists anywhere).
const HARD_DELETE_CALL_PATTERN = /\bremove\(|\bremoveMany\(|\bdeleteEntity\(|\.rpc\(["'`]erase_|\.rpc\(["'`]delete_|\berase[A-Za-z]*\(/g;

function listActionsFiles(repoRoot: string): string[] {
  const appDir = join(repoRoot, "app");
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (entry === "actions.ts") files.push(relative(repoRoot, full).split(sep).join("/"));
    }
  }
  walk(appDir);
  return files;
}

// A match sitting right after "function " is the declaration itself
// (e.g. "export async function eraseProduct(" also matches the
// erase-prefixed-call pattern on its own name) -- skip it, the real call
// inside the function body is what identifies the enclosing function.
function isFunctionDeclarationSelfMatch(source: string, matchIndex: number): boolean {
  const before = source.slice(Math.max(0, matchIndex - 30), matchIndex);
  return /function\s*$/.test(before);
}

function findEnclosingExportedFunction(source: string, matchIndex: number): string | null {
  const before = source.slice(0, matchIndex);
  const fnMatches = Array.from(before.matchAll(/export (?:async )?function (\w+)/g));
  if (fnMatches.length === 0) return null;
  return fnMatches[fnMatches.length - 1][1];
}

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

// I2 -- completeness check: every hard-delete call site under app/**/actions.ts
// must be a listed HARD_DELETE_ACTIONS entry (requireOwner-checked above) or a
// named EXEMPTIONS entry. Anything else is a hard delete nobody decided on.
describe("every hard-delete call site is accounted for (I2 completeness scan)", () => {
  it("finds no unlisted, unexempted hard-delete site under app/**/actions.ts", () => {
    const allowed = new Set(HARD_DELETE_ACTIONS.map(([file, fn]) => `${file}::${fn}`));
    const exempt = new Set(EXEMPTIONS.map(([file, fn]) => `${file}::${fn}`));
    const unlisted: string[] = [];

    for (const file of listActionsFiles(process.cwd())) {
      const source = read(file);
      for (const match of source.matchAll(HARD_DELETE_CALL_PATTERN)) {
        const matchIndex = match.index as number;
        if (isFunctionDeclarationSelfMatch(source, matchIndex)) continue;

        const fn = findEnclosingExportedFunction(source, matchIndex);
        if (!fn) continue;
        const key = `${file}::${fn}`;
        if (!allowed.has(key) && !exempt.has(key) && !unlisted.includes(key)) {
          unlisted.push(key);
        }
      }
    }

    expect(unlisted).toEqual([]);
  });

  it("every HARD_DELETE_ACTIONS and EXEMPTIONS entry still points at a real file and function", () => {
    for (const [file, fn] of [...HARD_DELETE_ACTIONS, ...EXEMPTIONS.map(([f, n]) => [f, n] as [string, string])]) {
      expect(read(file)).toContain(`function ${fn}(`);
    }
  });
});
