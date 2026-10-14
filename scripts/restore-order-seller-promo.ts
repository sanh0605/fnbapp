import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { selectPatches, type OrderRow } from "./restore-order-seller-promo-core";

/**
 * Data write 2 of docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md.
 * Live orders that were edited before 2026-10-15 get created_by_id/name (and,
 * where lost, applied_promotion_id + snapshot) copied back from the root
 * version. Touches only orders_v2; updated_at moves on the patched rows.
 *
 * Dry run by default. Only --apply writes.
 * Run: npx vite-node scripts/restore-order-seller-promo.ts [--apply]
 */

const PAGE = 1000;
const apply = process.argv.includes("--apply");
const COLS = "id,order_no,status,parent_order_id,superseded_by,created_by_id,created_by_name,applied_promotion_id,applied_promotion_snapshot_json";

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const load = async (): Promise<OrderRow[]> => {
    const out: OrderRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from("orders_v2").select(COLS).order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(`orders_v2: ${error.message}`);
      out.push(...(data as unknown as OrderRow[]));
      if (!data || data.length < PAGE) return out;
    }
  };

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");
  const rows = await load();
  const patches = selectPatches(rows);
  const live = rows.filter(r => r.status === "COMPLETED" && !r.superseded_by && r.parent_order_id).length;
  const changes = patches.flatMap(p => p.changes);
  const show = (v: unknown) => (v === null || v === undefined ? "(trống)" : typeof v === "object" ? JSON.stringify(v) : String(v));

  for (const c of changes) console.log(`${c.order_no}\t${c.field}\t${show(c.now)}\t->\t${show(c.next)}`);
  console.log(`${patches.length} đơn sẽ sửa (${changes.length} ô) trên ${live} đơn đang sống đã từng sửa, ${rows.length} dòng orders_v2`);

  if (!apply) { console.log("Chạy thử xong, chưa ghi gì."); return; }

  for (const p of patches) {
    const { error } = await supabase.from("orders_v2").update(p.values).eq("id", p.id);
    if (error) throw new Error(`${p.order_no}: ${error.message}`);
  }
  const left = selectPatches(await load()).length;
  console.log(left === 0 ? `OK: còn 0 đơn lệch trên ${live} đơn` : `LỆCH: còn ${left} đơn`);
  if (left) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
