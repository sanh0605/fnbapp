// Item 79: a screen writes a table, calls revalidatePath, but the cache is
// keyed by table name -- so any OTHER screen reading that table keeps the old
// copy until its TTL expires. Only long-cached tables can hurt.
//
// docs/superpowers/plans/2026-09-01-stale-screens-after-editing-a-unit.md
// section 3: copied here from scratchpad/ to keep, since this is worth
// re-running whenever a new screen is added.
//
// Two known blind spots, found while using this script to verify that
// task's fix -- read the printed rows, don't trust "0 rows" alone as proof
// nothing is wrong:
//
// 1. RE_WRITE only matches a literal string passed directly to
//    insert/update/updateMany/remove, e.g. insert("UOM_Conversions", ...).
//    A file that assigns the table name to a constant first --
//    const SHEET = "UOM_Conversions"; ...; insert(SHEET, ...) -- is
//    invisible to it. This is exactly how the first run of this script
//    missed app/admin/inventory/conversions/actions.ts (the real, live
//    UOM_Conversions writer, which uses that pattern) while counting a
//    dead, unreferenced duplicate in app/admin/inventory/actions.ts instead
//    (which happened to use literal strings).
// 2. This script has no notion of whether an exported function is ever
//    actually imported/called anywhere. A dead function that writes a
//    long-cached table via a literal string still counts as a "pair" here.
//    Two such pairs were found and left alone 2026-09-01 (confirmed dead by
//    grepping app/ and components/ for real imports) rather than "fixed"
//    with a revalidateTag call that would never run.
//
// Both mean this script can under-count (blind spot 1, a false negative --
// the dangerous direction) and over-count (blind spot 2, a false positive).
// Read the file column, not just the row count.
import * as fs from "fs";
import * as path from "path";

const TTL: Record<string, number> = {};
for (const t of ["Units","Item_Categories","Product_Categories","Brands","Outlets","Suppliers","Users"]) TTL[t] = 1800;
for (const t of ["Products","Product_Variants","Modifiers","Recipes","Promotions","Semi_Products","Purchased_Items","UOM_Conversions","Product_Price_History"]) TTL[t] = 600;

const files: string[] = [];
(function walk(d: string) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p) && !/\.test\./.test(p)) files.push(p);
  }
})("app");

const RE_READ = /(?:findAll|findAllWhere)\(\s*["'`]([A-Za-z_]+)["'`]/g;
const RE_WRITE = /(?:insert|update|updateMany|remove)\(\s*["'`]([A-Za-z_]+)["'`]/g;

const info = files.map(f => {
  const src = fs.readFileSync(f, "utf-8");
  return {
    f,
    reads: new Set([...src.matchAll(RE_READ)].map(m => m[1])),
    writes: new Set([...src.matchAll(RE_WRITE)].map(m => m[1])),
    hasPath: /revalidatePath\(/.test(src),
    hasTag: /revalidateTag\(/.test(src),
  };
});

const rows: Array<{ f: string; t: string; ttl: number; others: number }> = [];
for (const a of info) {
  if (!a.hasPath || a.hasTag) continue;
  for (const t of a.writes) {
    const ttl = TTL[t];
    if (!ttl) continue; // short-lived, 2 minutes, not worth it
    const others = info.filter(b => b.f !== a.f && b.reads.has(t) && path.dirname(b.f) !== path.dirname(a.f)).length;
    if (others > 0) rows.push({ f: a.f, t, ttl, others });
  }
}
rows.sort((x, y) => y.ttl - x.ttl || y.others - x.others);
console.log(`${"cu toi".padEnd(8)}${"bang".padEnd(22)}${"man hinh khac doc".padEnd(19)}file ghi`);
for (const r of rows) console.log(`${(r.ttl / 60 + " phut").padEnd(8)}${r.t.padEnd(22)}${String(r.others).padEnd(19)}${r.f}`);
console.log("\ntong cap co rui ro:", rows.length, "| so file can sua:", new Set(rows.map(r => r.f)).size);
