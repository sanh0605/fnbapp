import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { selectFixes, type HistoryRow, type LineRow, type VariantRow } from "./backfill-price-history-zero-core";

/**
 * Data write 1 of docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md.
 * Price history rows the 2026-06-28 import left at new_price 0 get their size's
 * first sale price (or today's price if never sold). Touches only
 * product_price_history, which has no triggers and no updated_at.
 *
 * Dry run by default. Only --apply writes.
 * Run: npx vite-node scripts/backfill-price-history-zero.ts [--apply]
 */

const PAGE = 1000;
const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const loadHistory = async (): Promise<HistoryRow[]> => {
    const { data, error } = await supabase.from("product_price_history").select("id,variant_id,new_price").order("id");
    if (error) throw new Error(`product_price_history: ${error.message}`);
    return data as HistoryRow[];
  };

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");
  const history = await loadHistory();
  const variantIds = [...new Set(history.filter(h => h.new_price === 0).map(h => h.variant_id))];

  const { data: vData, error: vErr } = await supabase.from("product_variants").select("id,price,size_name,products(name)").in("id", variantIds);
  if (vErr) throw new Error(`product_variants: ${vErr.message}`);
  const variants: VariantRow[] = (vData as any[]).map(v => ({ id: v.id, price: v.price, label: `${v.products?.name ?? v.id} ${v.size_name}` }));

  // PostgREST caps a response at 1000 rows; the sold sizes have more lines than that.
  const lines: LineRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("order_lines_v2").select("id,variant_id,unit_price,line_no,order_id,orders_v2(created_at)")
      .in("variant_id", variantIds).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`order_lines_v2: ${error.message}`);
    lines.push(...(data as any[]).map(l => ({ ...l, order_created_at: l.orders_v2.created_at })));
    if (data.length < PAGE) break;
  }

  const fixes = selectFixes(history, variants, lines);
  const bad = fixes.filter(f => f.next <= 0);
  if (bad.length) throw new Error(`Would write a price of 0 or less on ${bad.map(f => f.id).join(", ")}; stopping`);

  for (const f of fixes) console.log(`${f.id}\t${f.label}\t${f.now}đ -> ${f.next}đ\t(nguồn: ${f.source})`);
  console.log(`${fixes.length} dòng sẽ sửa trên ${history.length} dòng lịch sử giá`);

  if (!apply) { console.log("Chạy thử xong, chưa ghi gì."); return; }

  for (const f of fixes) {
    const { error } = await supabase.from("product_price_history").update({ new_price: f.next }).eq("id", f.id);
    if (error) throw new Error(`${f.id}: ${error.message}`);
  }
  const left = (await loadHistory()).filter(h => h.new_price <= 0).length;
  console.log(left === 0 ? `OK: còn 0 dòng ở 0đ trên ${history.length} dòng lịch sử giá` : `LỆCH: còn ${left} dòng ở 0đ`);
  if (left) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
