import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  planRelinks,
  summarizeAfterRelink,
  type AssetRow,
  type LineRow,
  type OrderRow,
} from "./relink-orphan-assets-core";

/**
 * Owner approved 2026-10-08: assets whose purchase_order_line_id points at a
 * line deleted by an old purchase-order edit (before 2026-10-05) are relinked
 * to the one live line with the same item and quantity that no asset uses.
 *
 * Dry run by default. Only --apply writes:
 *   assets.purchase_order_line_id only, one update per asset, filtered by id AND
 *   the old line id so a row changed meanwhile is not touched.
 *
 * Run: npx vite-node scripts/relink-orphan-assets.ts [--apply]
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
    fetchAll<AssetRow>(
      "assets",
      "id,purchased_item_id,purchase_order_line_id,name_snapshot,acquired_date,unit_cost,quantity",
    );
  const loadLines = () =>
    fetchAll<LineRow>("purchase_order_lines", "id,purchase_order_id,purchased_item_id,quantity,unit_price");

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");
  const [assets, lines, orders] = await Promise.all([
    loadAssets(),
    loadLines(),
    fetchAll<OrderRow>("purchase_orders", "id,status,transaction_date"),
  ]);
  const plan = planRelinks({ assets, lines, orders });

  console.log(`tài sản đã xét: ${fmt(plan.checked)}`);
  console.log(`tài sản mồ côi (dòng mua đã mất): ${plan.orphans} trên ${fmt(plan.checked)} tài sản`);
  console.log(`sẽ nối lại: ${plan.relinks.length} trên ${plan.orphans} tài sản mồ côi`);
  for (const r of plan.relinks) {
    console.log(
      `  ${r.assetId}  ${r.nameSnapshot}: ${r.oldLineId} -> ${r.newLineId}`
      + `  đơn ${r.purchaseOrderId} ngày ${r.orderDate}, tài sản mua ngày ${r.assetAcquiredDate}`
      + `, đơn giá dòng ${fmt(r.lineUnitPrice)}đ vs giá vốn tài sản ${fmt(r.assetUnitCost)}đ`,
    );
  }
  console.log(`bỏ qua (không đoán): ${plan.skips.length} trên ${plan.orphans} tài sản mồ côi`);
  for (const s of plan.skips) {
    console.log(`  ${s.assetId}  ${s.reason}${s.candidateLineIds.length ? ` [${s.candidateLineIds.join(", ")}]` : ""}`);
  }
  console.log(
    "Ghi chú: trigger duy nhất trên assets là trg_assets_touch, chỉ đổi updated_at của từng dòng được ghi; không có gì khác chạy.",
  );

  if (!apply) {
    console.log("Chạy thử xong, chưa ghi gì.");
    return;
  }

  for (const r of plan.relinks) {
    const { error } = await supabase
      .from("assets")
      .update({ purchase_order_line_id: r.newLineId })
      .eq("id", r.assetId)
      .eq("purchase_order_line_id", r.oldLineId);
    if (error) throw new Error(`assets ${r.assetId}: ${error.message}`);
  }

  const [assetsAfter, linesAfter] = await Promise.all([loadAssets(), loadLines()]);
  const after = summarizeAfterRelink(
    assetsAfter,
    new Set(linesAfter.map(l => l.id)),
    plan.relinks.map(r => r.assetId),
  );
  console.log(`assets: ${fmt(after.pointingAtLiveLine)} trỏ vào dòng mua còn sống trên ${fmt(after.assetsTotal)} tài sản`);
  console.log(`tài sản mồ côi còn lại: ${after.orphansNow}`);
  console.log(`dòng đã định nối mà vẫn mồ côi: ${after.plannedStillOrphan.length} trên ${plan.relinks.length}`);
  const ok = after.plannedStillOrphan.length === 0;
  console.log(ok ? "OK" : "LỆCH: kiểm tra lại");
  if (!ok) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
