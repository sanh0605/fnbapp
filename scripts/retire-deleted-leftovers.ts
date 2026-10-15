import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

/**
 * Plan 2026-10-15-bo-deleted: retire the last two leftovers of the DELETED vocabulary so
 * migration 0125 can drop it.
 *   modifiers MOD-007 (Dâu sấy): status DELETED -> INACTIVE
 *   units U-001: name DELETED_gram -> "gram (cũ)", status ACTIVE -> INACTIVE
 * A row is written only when it still holds the expected old value; anything else is reported
 * and skipped, so a second run writes nothing.
 * Side effect: trg_modifiers_touch moves modifiers.updated_at on MOD-007; units has no trigger.
 *
 * Dry run by default. Only --apply writes.
 * Run: npx vite-node scripts/retire-deleted-leftovers.ts [--apply]
 */

const apply = process.argv.includes("--apply");

const TARGETS = [
  { table: "modifiers", id: "MOD-007", expect: { status: "DELETED" }, set: { status: "INACTIVE" } },
  { table: "units", id: "U-001", expect: { name: "DELETED_gram", status: "ACTIVE" }, set: { name: "gram (cũ)", status: "INACTIVE" } },
] as const;

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");

  const writes: Array<(typeof TARGETS)[number]> = [];
  for (const t of TARGETS) {
    const { data, error } = await supabase.from(t.table).select("id,name,status").eq("id", t.id).maybeSingle();
    if (error) throw new Error(`${t.table}: ${error.message}`);
    const row = data as Record<string, string> | null;
    const matches = row && Object.entries(t.expect).every(([col, value]) => row[col] === value);
    console.log(`${t.table} ${t.id}: ${row ? `"${row.name}" ${row.status}` : "không có dòng"} -> ${matches ? JSON.stringify(t.set) : "bỏ qua (không còn đúng giá trị cũ)"}`);
    if (matches) writes.push(t);
  }
  console.log(`Sẽ ghi ${writes.length} dòng trên ${TARGETS.length} đối tượng.`);

  if (!apply) {
    console.log("Chạy thử xong, chưa ghi gì.");
    return;
  }

  for (const t of writes) {
    const { error } = await supabase.from(t.table).update(t.set).eq("id", t.id);
    if (error) throw new Error(`${t.table} ${t.id}: ${error.message}`);
  }
  // Re-read: every target must now hold the new value.
  let bad = 0;
  for (const t of TARGETS) {
    const { data, error } = await supabase.from(t.table).select("id,name,status").eq("id", t.id).maybeSingle();
    if (error) throw new Error(`${t.table}: ${error.message}`);
    const row = data as Record<string, string> | null;
    if (!row || !Object.entries(t.set).every(([col, value]) => row[col] === value)) bad++;
  }
  console.log(bad === 0 ? `OK: ${TARGETS.length} trên ${TARGETS.length} đối tượng đúng giá trị mới` : `LỆCH: ${bad} đối tượng chưa đúng`);
  if (bad > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
