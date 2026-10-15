import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { selectErasures, type Input } from "./erase-never-sold-deleted-core";

/**
 * Data write 3 of docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md.
 * Erases DELETED dishes (with their sizes and price history), DELETED
 * categories with no dish left, and DELETED options that were never sold.
 * A row that anything else still points at is kept and reported, the rest still go
 * (today: Dâu sấy MOD-007 is named in pos_snapshot_json of order 260624002014).
 * A dish goes through the existing erase_never_sold_product_atomic rpc
 * (migration 0075: price history, sizes, dish in one transaction).
 *
 * Dry run by default. Only --apply writes.
 * Run: npx vite-node scripts/erase-never-sold-deleted.ts [--apply]
 */

const PAGE = 1000;
const apply = process.argv.includes("--apply");

// Where an id can hide besides an order line. Foreign-key children of products,
// product_variants and product_categories, read from pg_constraint on
// 2026-10-15: order_lines_v2 (checked by hasLine), modifiers and
// modifier_group_products (scanned below; the latter is ON DELETE CASCADE),
// product_price_history and product_variants (erased with the dish).
// The rest are plain-text places with no foreign key.
const SCANS = [
  { table: "orders_v2", cols: ["pos_snapshot_json", "applied_promotion_snapshot_json"], key: "order_no" },
  { table: "order_events", cols: ["delta_json"], key: "id" },
  { table: "promotions", cols: ["applicable_products_json"], key: "id" },
  { table: "pos_drafts", cols: ["cart_json"], key: "id" },
  { table: "dashboard_settings", cols: ["food_product_ids"], key: "id" },
  { table: "modifier_group_products", cols: ["product_id"], key: "group_id" },
  { table: "modifiers", cols: ["product_id"], key: "id" },
];

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const all = async (table: string, cols: string): Promise<any[]> => {
    const out: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select(cols).order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data as any[]));
      if (data.length < PAGE) return out;
    }
  };
  const hasLine = async (col: "product_id" | "variant_id", id: string): Promise<boolean> => {
    const { data, error } = await supabase.from("order_lines_v2").select("id").eq(col, id).limit(1);
    if (error) throw new Error(`order_lines_v2: ${error.message}`);
    return data.length > 0;
  };

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");
  const [products, variants, categories, modifiers, history] = await Promise.all([
    all("products", "id,name,status,category_id"),
    all("product_variants", "id,product_id,status"),
    all("product_categories", "id,name,status"),
    all("modifiers", "id,name,status"),
    all("product_price_history", "id,variant_id"),
  ]);

  const soldProductIds: string[] = [];
  const soldVariantIds: string[] = [];
  for (const p of products.filter(p => p.status === "DELETED")) if (await hasLine("product_id", p.id)) soldProductIds.push(p.id);
  for (const v of variants.filter(v => v.status === "DELETED")) if (await hasLine("variant_id", v.id)) soldVariantIds.push(v.id);
  const { data: soldModifierIds, error: rpcErr } = await supabase.rpc("find_sold_modifier_ids");
  if (rpcErr) throw new Error(`find_sold_modifier_ids: ${rpcErr.message}`);

  const refs: Input["refs"] = [];
  for (const s of SCANS) {
    for (const row of await all(s.table, [...new Set([s.key, ...s.cols, "id"])].join(","))) {
      for (const c of s.cols) {
        if (row[c] == null) continue;
        refs.push({ where: `${s.table}.${c} (${row[s.key]})`, value: typeof row[c] === "string" ? row[c] : JSON.stringify(row[c]) });
      }
    }
  }

  const r = selectErasures({ products, variants, categories, modifiers, soldProductIds, soldVariantIds, soldModifierIds: soldModifierIds ?? [], refs });
  let sizes = 0;
  let prices = 0;
  for (const d of r.dishes) {
    const n = history.filter(h => d.variantIds.includes(h.variant_id)).length;
    sizes += d.variantIds.length;
    prices += n;
    console.log(`Xoá hẳn món\t${d.name} (${d.id})\t${d.variantIds.length} size, ${n} dòng lịch sử giá`);
  }
  for (const c of r.categories) console.log(`Xoá hẳn nhóm\t${c.name} (${c.id})`);
  for (const m of r.modifiers) console.log(`Xoá hẳn tuỳ chọn\t${m.name} (${m.id})`);
  for (const s of r.skipped) console.log(`Giữ lại\t${s.kind} ${s.name} (${s.id}): ${s.reason}`);
  console.log(`${r.dishes.length} món (${sizes} size, ${prices} dòng lịch sử giá), ${r.categories.length} nhóm, ${r.modifiers.length} tuỳ chọn sẽ xoá hẳn; ${r.skipped.length} chỗ giữ lại; trên ${products.length} món, ${categories.length} nhóm, ${modifiers.length} tuỳ chọn`);

  if (!apply) { console.log("Chạy thử xong, chưa ghi gì."); return; }

  for (const d of r.dishes) {
    const { error } = await supabase.rpc("erase_never_sold_product_atomic", { p_product_id: d.id });
    if (error) throw new Error(`${d.name}: ${error.message}`);
  }
  for (const [table, list] of [["product_categories", r.categories], ["modifiers", r.modifiers]] as const) {
    for (const t of list) {
      const { error } = await supabase.from(table).delete().eq("id", t.id);
      if (error) throw new Error(`${t.name}: ${error.message}`);
    }
  }
  const left = (await all("products", "id")).filter(p => r.dishes.some(d => d.id === p.id)).length
    + (await all("product_categories", "id")).filter(c => r.categories.some(t => t.id === c.id)).length
    + (await all("modifiers", "id")).filter(m => r.modifiers.some(t => t.id === m.id)).length;
  console.log(left === 0 ? "OK: các dòng đã chọn đều đã xoá" : `LỆCH: còn ${left} dòng chưa xoá`);
  if (left) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
