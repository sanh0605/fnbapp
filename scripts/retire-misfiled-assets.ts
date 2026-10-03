import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  planAssetRetirement,
  summarizeAfterRetire,
  type AssetRow,
  type CategoryRow,
  type ItemRow,
} from "./retire-misfiled-assets-core";

/**
 * Owner decision 2026-10-03 (BR-COGS-008): an asset whose item has left the
 * equipment category stops depreciating. Marks it INACTIVE, never deletes.
 * docs/superpowers/plans/2026-10-03-go-tai-san-khi-doi-loai.md "Task B".
 *
 * Dry run by default. Only --apply writes:
 *   assets.status -> 'INACTIVE' for active assets of items whose category is
 *   not EQUIPMENT, unless one of that item's assets already has a disposal
 *   (those are listed as refused and left alone).
 *
 * Run: npx vite-node scripts/retire-misfiled-assets.ts [--apply]
 */

const PAGE = 1000;
const apply = process.argv.includes("--apply");

function fmt(n: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n);
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // PostgREST returns at most 1000 rows per request; page until a short page.
  async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table).select(columns).order("id").range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const rows = (data ?? []) as unknown as T[];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  }

  const loadAssets = () =>
    fetchAll<AssetRow>("assets", "id,purchased_item_id,name_snapshot,quantity,total_cost,status");

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");
  const [items, categories, assets, disposals] = await Promise.all([
    fetchAll<ItemRow>("purchased_items", "id,name,item_category_id"),
    fetchAll<CategoryRow>("item_categories", "id,system_type"),
    loadAssets(),
    fetchAll<{ id: string; asset_id: string }>("asset_disposals", "id,asset_id"),
  ]);
  const plan = planAssetRetirement({ items, categories, assets, disposals });

  console.log(`tài sản sẽ gỡ (INACTIVE): ${plan.toRetire.length} trên ${fmt(plan.assetsTotal)} tài sản`);
  for (const t of plan.toRetire) {
    console.log(`  ${t.assetId}  ${t.itemName} (${t.itemId}), ${fmt(t.quantity)} cái, ${fmt(t.totalCost)}đ`);
  }
  console.log(`tài sản bị từ chối vì đã có lần thanh lý: ${plan.refused.length} trên ${fmt(plan.assetsTotal)} tài sản`);
  for (const r of plan.refused) console.log(`  ${r.assetId}  ${r.itemName} (${r.itemId})`);

  if (!apply) {
    console.log("Chạy thử xong, chưa ghi gì.");
    return;
  }

  const ids = plan.toRetire.map(t => t.assetId);
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase.from("assets").update({ status: "INACTIVE" }).in("id", ids.slice(i, i + 100));
    if (error) throw new Error(`assets: ${error.message}`);
  }

  const after = summarizeAfterRetire(await loadAssets(), ids);
  console.log(`assets: ${fmt(after.inactive)} INACTIVE trên ${fmt(after.assetsTotal)} tài sản`);
  console.log(`dòng đã định gỡ mà còn ACTIVE: ${after.plannedStillActive.length}`);
  const ok = after.plannedStillActive.length === 0;
  console.log(ok ? "OK" : "LỆCH: kiểm tra lại");
  if (!ok) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
