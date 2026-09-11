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

// A match sitting right after "function " or "const " is the declaration
// itself (e.g. "export async function eraseProduct(" also matches the
// erase-prefixed-call pattern on its own name, and a hypothetical
// "const eraseFoo(" would too) -- skip it, the real call inside the unit's
// body is what identifies the enclosing unit.
function isFunctionDeclarationSelfMatch(source: string, matchIndex: number): boolean {
  const before = source.slice(Math.max(0, matchIndex - 30), matchIndex);
  return /(?:function|const)\s*$/.test(before);
}

// A unit is any of: function name(, async function name(, const name = (,
// const name = async (, each optionally exported.
const UNIT_DECLARATION_PATTERN =
  /(export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|(export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;

// The const-form of UNIT_DECLARATION_PATTERN also matches an ordinary
// parenthesised expression that is not a function at all, e.g.
// `const id = ((formData.get("id") as string) || "").trim();` -- the "("
// right after "=" opens a grouping, not a parameter list. Caught against the
// real tree: without this check, that line's "(" became the nearest "unit"
// and the real deleteCashEntry call two lines later was misattributed to a
// unit named "id" instead. Walk the parens from the opening one to their
// balanced close and check what follows is "=>" (skipping an optional
// return-type annotation) -- stays textual, no AST, per
// residuals-fix-brief.md item 2's ruling.
function isArrowFunctionAssignment(source: string, openParenIndex: number): boolean {
  let depth = 0;
  for (let i = openParenIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        const after = source.slice(i + 1, i + 200);
        return /^\s*(?::[^={]+)?\s*=>/.test(after);
      }
    }
  }
  return false;
}

type Unit = { name: string; exported: boolean; index: number };

// All real units in a file, in source order, so a given match can be
// attributed to the nearest one preceding it. Fixes two ways the old
// `export (async )?function name` regex failed open (reviewer repros,
// residuals-fix-brief.md item 2):
//  (a) an arrow export -- `export const deleteFoo = async (fd) => {...}` --
//      never matched the old regex at all, so its calls were credited to
//      nothing and skipped outright (`if (!fn) continue`).
//  (b) a non-exported helper declared after a listed export was invisible
//      too, so a call inside it got credited to that earlier export by
//      textual proximity instead of to the helper.
function findUnitDeclarations(source: string): Unit[] {
  const units: Unit[] = [];
  for (const m of source.matchAll(UNIT_DECLARATION_PATTERN)) {
    const index = m.index as number;
    if (m[2] !== undefined) {
      units.push({ name: m[2], exported: Boolean(m[1]), index });
    } else if (m[4] !== undefined) {
      const openParenIndex = index + m[0].length - 1;
      if (isArrowFunctionAssignment(source, openParenIndex)) {
        units.push({ name: m[4], exported: Boolean(m[3]), index });
      }
    }
  }
  return units;
}

function findEnclosingUnit(units: Unit[], matchIndex: number): { name: string; exported: boolean } | null {
  let found: Unit | null = null;
  for (const u of units) {
    if (u.index >= matchIndex) break;
    found = u;
  }
  return found ? { name: found.name, exported: found.exported } : null;
}

// Non-exported helpers that a listed hard-delete action calls into. Each
// entry's `callers` must list every function in the same file that calls
// `helperName(`, and every one of those callers must itself be a
// requireOwner()-checked HARD_DELETE_ACTIONS entry -- otherwise an
// unlisted, unguarded export could reach the same helper unnoticed (repro b
// above). Empty on today's tree: the scan below confirms no hard-delete
// call site currently sits inside a non-exported unit.
const DELETE_HELPERS: Array<[file: string, helperName: string, callers: string[]]> = [];

function findCallersOf(source: string, helperName: string): string[] {
  const units = findUnitDeclarations(source);
  const pattern = new RegExp(`\\b${helperName}\\(`, "g");
  const callers = new Set<string>();
  for (const match of source.matchAll(pattern)) {
    const matchIndex = match.index as number;
    if (isFunctionDeclarationSelfMatch(source, matchIndex)) continue;
    const unit = findEnclosingUnit(units, matchIndex);
    if (unit && unit.name !== helperName) callers.add(unit.name);
  }
  return Array.from(callers);
}

// The scan itself, factored to take (file, source) pairs so a test can feed
// it synthetic source instead of always reading the real tree off disk.
function scanForUnlistedHardDeletes(files: Array<[string, string]>): string[] {
  const allowed = new Set(HARD_DELETE_ACTIONS.map(([file, fn]) => `${file}::${fn}`));
  const exempt = new Set(EXEMPTIONS.map(([file, fn]) => `${file}::${fn}`));
  const helpers = new Set(DELETE_HELPERS.map(([file, fn]) => `${file}::${fn}`));
  const unlisted: string[] = [];

  for (const [file, source] of files) {
    const units = findUnitDeclarations(source);
    for (const match of source.matchAll(HARD_DELETE_CALL_PATTERN)) {
      const matchIndex = match.index as number;
      if (isFunctionDeclarationSelfMatch(source, matchIndex)) continue;

      const unit = findEnclosingUnit(units, matchIndex);
      // Fail closed: a match with no enclosing unit is still reported, never
      // skipped -- the old `if (!fn) continue` was one of the two ways this
      // scan failed open.
      const key = unit ? `${file}::${unit.name}` : `${file}::<top-level>`;
      const isKnown = unit
        ? unit.exported
          ? allowed.has(key) || exempt.has(key)
          : helpers.has(key)
        : false;

      if (!isKnown && !unlisted.includes(key)) unlisted.push(key);
    }
  }
  return unlisted;
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
    const files = listActionsFiles(process.cwd()).map((file): [string, string] => [file, read(file)]);
    expect(scanForUnlistedHardDeletes(files)).toEqual([]);
  });

  it("every HARD_DELETE_ACTIONS and EXEMPTIONS entry still points at a real file and function", () => {
    for (const [file, fn] of [...HARD_DELETE_ACTIONS, ...EXEMPTIONS.map(([f, n]) => [f, n] as [string, string])]) {
      expect(read(file)).toContain(`function ${fn}(`);
    }
  });

  it.each(DELETE_HELPERS)(
    "%s :: %s -- every in-file caller is listed and requireOwner-checked",
    (file, helperName, callers) => {
      const source = read(file);
      const actualCallers = findCallersOf(source, helperName);
      for (const caller of actualCallers) {
        expect(callers, `${helperName} is called by ${caller}, missing from its callers list`).toContain(caller);
      }
      const allowed = new Set(HARD_DELETE_ACTIONS.map(([f, fn]) => `${f}::${fn}`));
      for (const caller of callers) {
        expect(
          allowed.has(`${file}::${caller}`),
          `${caller} calls ${helperName} but is not a requireOwner()-checked HARD_DELETE_ACTIONS entry`,
        ).toBe(true);
      }
    },
  );

  // Reviewer repros (residuals-fix-brief.md item 2) fed as synthetic source,
  // proving the scan itself catches both failure modes rather than relying
  // on today's tree happening to contain one.
  it("reports an arrow-function export's hard-delete call (repro a: arrow export was invisible)", () => {
    const file = "fake/arrow-export.ts";
    const source = `export const deleteFoo = async (fd) => { await requireAdmin(); await remove("Foo", id); };`;
    expect(scanForUnlistedHardDeletes([[file, source]])).toContain(`${file}::deleteFoo`);
  });

  it("attributes a non-exported helper's call to the helper, not to an earlier listed export (repro b: textual attribution)", () => {
    const file = "app/admin/finance/actions.ts"; // already listed for deleteCashEntry
    const source = `
export async function deleteCashEntry(formData) {
  await requireOwner();
  await remove("Cash_Entries", id);
}

function removeX(id) {
  return remove("Foo", id);
}

export async function deleteBar(formData) {
  await requireAdmin();
  return removeX(id);
}
`;
    const unlisted = scanForUnlistedHardDeletes([[file, source]]);
    expect(unlisted).toContain(`${file}::removeX`);
    expect(unlisted).not.toContain(`${file}::deleteCashEntry`);
  });
});
