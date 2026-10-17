/**
 * Creates the option groups Độ ngọt and Đá (7 options, all 0đ) and links them to the
 * dishes that carry Thêm Topping (MG-001), in one transaction.
 *
 * Dry run by default: the transaction executes the inserts, prints the would-be state,
 * then ends with rollback;. Only --apply ends with commit;.
 *
 * Side effects: inserts fire no trigger (the touch_updated_at triggers are BEFORE UPDATE only);
 * nothing else is queued.
 *
 * Run: npx vite-node scripts/seed-sweetness-ice-groups.ts [--apply]
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeedSql } from "./seed-sweetness-ice-groups-core";

// Dish names to leave out of the new links; filled from the owner's answer before any apply.
const EXCLUDE: string[] = [];
const apply = process.argv.includes("--apply");
const dir = resolve(import.meta.dirname, "../.worktrees"); // repo root, not cwd; .worktrees is gitignored
const file = resolve(dir, "seed-sweetness-ice.sql");
const run = (args: string) => execSync(`npx supabase db query --linked ${args}`, { encoding: "utf8" });

console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes)");

// Skill step 1: live triggers on the written tables.
console.log("\nTriggers:");
console.log(run(`"select tgrelid::regclass as tbl, tgname, pg_get_triggerdef(oid) as def from pg_trigger where tgrelid in ('public.modifier_groups'::regclass, 'public.modifiers'::regclass, 'public.modifier_group_products'::regclass) and not tgisinternal"`));

mkdirSync(dir, { recursive: true });
writeFileSync(file, buildSeedSql(apply, EXCLUDE));
console.log(run(`-f "${file}"`));

if (apply) {
  console.log("Re-read after commit:");
  console.log(run(`"select g.id, g.name, count(distinct m.id) as options, count(distinct l.product_id) as dishes from public.modifier_groups g left join public.modifiers m on m.group_id = g.id left join public.modifier_group_products l on l.group_id = g.id group by g.id, g.name order by g.id"`));
}
