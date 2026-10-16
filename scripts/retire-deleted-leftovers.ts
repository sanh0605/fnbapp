import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

/**
 * Erase the last two leftovers of the DELETED vocabulary so
 * migration 0125 can drop it.
 *   modifiers MOD-007 (Dâu sấy): status DELETED, never sold -> row deleted
 *   units U-001: name DELETED_gram, referenced nowhere -> row deleted
 * Owner 2026-10-15: "Xoá hẳn (Khuyến nghị)" for both rows.
 * A row is deleted only when it still holds the old value and passes its guard; anything else is
 * reported with the reason and skipped, so a second run deletes nothing.
 * Side effects: none (modifiers has only a BEFORE UPDATE trigger, units has none; no delete
 * triggers; measured 2026-10-15).
 *
 * Dry run by default. Only --apply writes.
 * Run: npx vite-node scripts/retire-deleted-leftovers.ts [--apply]
 */

const apply = process.argv.includes("--apply");

const UNIT_REFS = [
  ["uom_conversions", "base_unit"],
  ["uom_conversions", "purchased_unit"],
  ["purchase_order_lines", "unit"],
] as const;

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");

  // Returns null when the row may be deleted, otherwise the reason to skip it.
  async function modifierGuard(): Promise<string | null> {
    const { data, error } = await supabase.from("modifiers").select("id,name,status").eq("id", "MOD-007").maybeSingle();
    if (error) throw new Error(`modifiers: ${error.message}`);
    if (!data) return "không có dòng";
    if (data.status !== "DELETED") return `trạng thái là ${data.status}, không còn DELETED`;
    const sold = await supabase.rpc("find_sold_modifier_ids");
    if (sold.error) throw new Error(`find_sold_modifier_ids: ${sold.error.message}`);
    return (sold.data as string[]).includes("MOD-007") ? "đã có đơn bán dùng topping này" : null;
  }

  async function unitGuard(): Promise<string | null> {
    const { data, error } = await supabase.from("units").select("id,name").eq("id", "U-001").maybeSingle();
    if (error) throw new Error(`units: ${error.message}`);
    if (!data) return "không có dòng";
    if (data.name !== "DELETED_gram") return `tên là "${data.name}", không còn DELETED_gram`;
    for (const [table, col] of UNIT_REFS) {
      // purchase_order_lines.unit is plain text with no FK: it may hold the id or the name.
      const values = col === "unit" ? ["U-001", "DELETED_gram"] : ["U-001"];
      const { count, error: e } = await supabase.from(table).select("*", { count: "exact", head: true }).in(col, values);
      if (e) throw new Error(`${table}.${col}: ${e.message}`);
      if (count) return `còn ${count} dòng trong ${table}.${col} tham chiếu`;
    }
    return null;
  }

  const targets = [
    { table: "modifiers", id: "MOD-007", reason: await modifierGuard() },
    { table: "units", id: "U-001", reason: await unitGuard() },
  ];
  for (const t of targets) console.log(`${t.table} ${t.id}: ${t.reason ? `bỏ qua (${t.reason})` : "sẽ xoá hẳn"}`);
  const deletes = targets.filter(t => !t.reason);
  console.log(`Sẽ xoá ${deletes.length} dòng trên ${targets.length} đối tượng.`);

  if (!apply) {
    console.log("Chạy thử xong, chưa ghi gì.");
    return;
  }

  for (const t of deletes) {
    const { error } = await supabase.from(t.table).delete().eq("id", t.id);
    if (error) throw new Error(`${t.table} ${t.id}: ${error.message}`);
  }
  // Re-read: every target must now be gone.
  let gone = 0;
  for (const t of targets) {
    const { data, error } = await supabase.from(t.table).select("id").eq("id", t.id).maybeSingle();
    if (error) throw new Error(`${t.table}: ${error.message}`);
    if (!data) gone++;
  }
  console.log(gone === targets.length ? `OK: ${gone} trên ${targets.length} đối tượng đã xoá` : `LỆCH: ${gone} trên ${targets.length} đối tượng đã xoá`);
  if (gone !== targets.length) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
