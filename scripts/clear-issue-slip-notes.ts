import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  selectIssueSlipsToClear,
  selectStockIssuesToClear,
  summarizeAfterClear,
  CLEARABLE_ISSUE_NOTES,
  type SlipRow,
  type StockIssueRow,
} from "./clear-issue-slip-notes-core";

/**
 * Owner decision 2026-10-01 (BR-INV-014): old issue slips were all made for
 * brewing, the stored reason ("Khác" / "Hao hụt / hư hỏng") is misleading, so
 * it is cleared. BR-INV-014.
 *
 * Dry run by default. Only --apply writes:
 *   issue_slips.note  -> '' where note has text
 *   stock_issues.note -> '' where source = 'MANUAL', reverses_issue_id is null
 *                        and note is one of the two old reasons
 * Return rows (reverses_issue_id not null) are never touched: their note
 * carries the cancel reason.
 *
 * Run: npx vite-node scripts/clear-issue-slip-notes.ts [--apply]
 */

const PAGE = 1000;
const apply = process.argv.includes("--apply");

function fmt(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
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

  const load = async () => ({
    slips: await fetchAll<SlipRow>("issue_slips", "id,note"),
    issues: await fetchAll<StockIssueRow>("stock_issues", "id,source,reverses_issue_id,note"),
  });

  console.log(apply ? "MODE: --apply (WILL WRITE)" : "MODE: dry run (no writes; pass --apply to write)");
  const before = await load();
  const slipTargets = selectIssueSlipsToClear(before.slips);
  const issueTargets = selectStockIssuesToClear(before.issues);
  const returnsBefore = before.issues.filter(r => r.reverses_issue_id);

  console.log(`issue_slips: ${fmt(slipTargets.length)} dòng sẽ sửa trên ${fmt(before.slips.length)} dòng`);
  console.log(`  5 mã đầu: ${slipTargets.slice(0, 5).map(s => s.id).join(", ") || "(không có)"}`);
  console.log(`stock_issues: ${fmt(issueTargets.length)} dòng sẽ sửa trên ${fmt(before.issues.length)} dòng (chỉ MANUAL, không phải dòng trả hàng, note thuộc ${CLEARABLE_ISSUE_NOTES.map(n => `"${n}"`).join(", ")})`);
  console.log(`  5 mã đầu: ${issueTargets.slice(0, 5).map(r => r.id).join(", ") || "(không có)"}`);
  console.log(`dòng trả hàng (reverses_issue_id có giá trị): ${fmt(returnsBefore.length)}, không đụng tới`);

  if (!apply) {
    console.log("Chạy thử xong, chưa ghi gì.");
    return;
  }

  async function clearInChunks(table: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error } = await supabase.from(table).update({ note: "" }).in("id", chunk);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }
  await clearInChunks("issue_slips", slipTargets.map(s => s.id));
  await clearInChunks("stock_issues", issueTargets.map(r => r.id));

  const after = await load();
  const s = summarizeAfterClear(after.slips, after.issues);
  console.log(`issue_slips: ${s.slipsWithNote} còn ghi chú trên ${fmt(s.slipsTotal)} dòng`);
  console.log(`stock_issues MANUAL (không phải trả hàng): ${s.manualNonReturnWithOldReason} còn lý do cũ trên ${fmt(s.manualNonReturnTotal)} dòng`);
  const returnsKept = s.returnRowsTotal === returnsBefore.length && s.returnRowsWithNote === returnsBefore.filter(r => (r.note ?? "").trim() !== "").length;
  console.log(`dòng trả hàng: ${s.returnRowsWithNote} giữ ghi chú trên ${fmt(s.returnRowsTotal)} dòng (trước khi ghi: ${returnsBefore.filter(r => (r.note ?? "").trim() !== "").length} trên ${returnsBefore.length})`);
  const ok = s.slipsWithNote === 0 && s.manualNonReturnWithOldReason === 0 && returnsKept;
  console.log(ok ? "OK" : "LỆCH: kiểm tra lại");
  if (!ok) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
