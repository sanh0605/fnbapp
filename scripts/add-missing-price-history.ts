import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { planPriceHistory, type HistoryRow, type SaleRow, type VariantRow } from "./add-missing-price-history-core";

/**
 * 6d batch 1a, H1: adds the price history rows that are missing (Cacao latte's
 * 27.000 -> 23.000 change, and the opening rows of VAR-038..VAR-045). Touches
 * only product_price_history: it has no triggers and no updated_at, and
 * nothing reads new rows as they arrive. product_variants is not written.
 * Run verify-price-cart afterwards: "every size's price equals its latest history row".
 *
 * Dry run by default. Only --apply writes.
 * Run: npx vite-node scripts/add-missing-price-history.ts [--apply]
 */

const PAGE = 1000;
const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // PostgREST caps a response at 1000 rows; page until a short page.
  async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from(table).select(columns).order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data as unknown as T[]));
      if (data.length < PAGE) break;
    }
    return out;
  }

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");
  const history = await fetchAll<HistoryRow>("product_price_history", "id,variant_id,new_price,created_at");
  const variants = (await fetchAll<any>("product_variants", "id,price,created_at,size_name,products(name)"))
    .map((v): VariantRow => ({ id: v.id, price: v.price, created_at: v.created_at, label: `${v.products?.name ?? v.id} ${v.size_name}` }));
  const lines = await fetchAll<any>("order_lines_v2", "id,variant_id,unit_price,orders_v2(created_at,status)");
  const sales: SaleRow[] = lines
    .filter(l => l.orders_v2?.status === "COMPLETED")
    .map(l => ({ variant_id: l.variant_id, unit_price: l.unit_price, order_created_at: l.orders_v2.created_at }));

  const rows = planPriceHistory(variants, history, sales);
  for (const r of rows) {
    console.log(`${r.id}\t${r.variant_id}\t${r.label}\t${r.old_price ?? "(mở đầu)"} -> ${r.new_price}đ\thiệu lực ${r.effective_at}`);
  }
  console.log(`${rows.length} dòng sẽ thêm vào product_price_history (đang có ${history.length} dòng, ${variants.length} cỡ món)`);
  if (!apply) { console.log("Chạy thử xong, chưa ghi gì."); return; }

  const { error } = await supabase.from("product_price_history")
    .insert(rows.map(({ label: _label, ...row }) => row));
  if (error) throw new Error(`insert: ${error.message}`);

  const after = await fetchAll<HistoryRow>("product_price_history", "id,variant_id,new_price,created_at");
  const left = planPriceHistory(variants, after, sales).length;
  console.log(left === 0 ? `OK: còn 0 cỡ món thiếu hoặc lệch lịch sử giá trên ${variants.length} cỡ` : `LỆCH: còn ${left} dòng cần thêm`);
  if (left) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
