import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * docs/superpowers/plans/2026-08-31-move-non-inventory-flag-to-items.md
 * section 2, change 1.
 *
 * Sets purchased_items.is_non_inventory = true on SPM-005 (Đá viên) and
 * SPM-052 (Khoai lang) -- the two items currently excluded from stocktake
 * only via their group's (base_ingredients) flag, not their own. The
 * owner decided 2026-08-29 to remove the tier-2 ingredient groups; once
 * that happens these two items would silently lose their exclusion and
 * reappear in the stocktake screen (OPEN-ITEMS 75). This script does not
 * remove the group flag and does not delete anything -- purely additive.
 *
 * Neutrality check (plan section 3): the additive union of
 * is_non_inventory items (item flag OR group flag) must be the same 9
 * ids before and after -- moving the flag's source must not change who is
 * excluded. Also re-reads SPM-052's completed-purchase total, which the
 * plan's own section 1.7 flags as money-adjacent (BR-COGS-007's
 * "Nguyên liệu mua dùng ngay" line, even though nothing reads it for
 * money yet -- see this task's own critique) and must be unchanged by a
 * write that only moves where a flag lives, not what it means.
 *
 * Dry run by default; --apply writes for real.
 */

const TARGETS = ["SPM-005", "SPM-052"] as const;

type FlaggedItemRow = { id: string; name: string; route: "ITEM_FLAG" | "GROUP_ONLY" };

async function readFlaggedUnion(supabase: any): Promise<FlaggedItemRow[]> {
  const { data: items, error: itemsError } = await supabase
    .from("purchased_items")
    .select("id, name, is_non_inventory, base_ingredient_id");
  if (itemsError) throw new Error(`Read purchased_items failed: ${itemsError.message}`);

  const { data: ingredients, error: ingredientsError } = await supabase
    .from("base_ingredients")
    .select("id, is_non_inventory");
  if (ingredientsError) throw new Error(`Read base_ingredients failed: ${ingredientsError.message}`);

  const flaggedGroupIds = new Set(
    (ingredients ?? [])
      .filter((b: any) => b.is_non_inventory === true)
      .map((b: any) => b.id),
  );

  const rows: FlaggedItemRow[] = [];
  for (const item of items ?? []) {
    const itemFlagged = item.is_non_inventory === true;
    const groupFlagged = item.base_ingredient_id && flaggedGroupIds.has(item.base_ingredient_id);
    if (itemFlagged) {
      rows.push({ id: item.id, name: item.name, route: "ITEM_FLAG" });
    } else if (groupFlagged) {
      rows.push({ id: item.id, name: item.name, route: "GROUP_ONLY" });
    }
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

async function readKhoaiLangTotal(supabase: any): Promise<{ lineCount: number; total: number }> {
  const { data, error } = await supabase
    .from("purchase_order_lines")
    .select("subtotal, purchase_order_id")
    .eq("purchased_item_id", "SPM-052");
  if (error) throw new Error(`Read SPM-052 lines failed: ${error.message}`);

  const orderIds = [...new Set((data ?? []).map((l: any) => l.purchase_order_id))];
  if (orderIds.length === 0) return { lineCount: 0, total: 0 };

  const { data: orders, error: ordersError } = await supabase
    .from("purchase_orders")
    .select("id, status")
    .in("id", orderIds);
  if (ordersError) throw new Error(`Read purchase_orders failed: ${ordersError.message}`);
  const completedIds = new Set((orders ?? []).filter((o: any) => o.status === "COMPLETED").map((o: any) => o.id));

  const completedLines = (data ?? []).filter((l: any) => completedIds.has(l.purchase_order_id));
  const total = completedLines.reduce((sum: number, l: any) => sum + (Number(l.subtotal) || 0), 0);
  return { lineCount: completedLines.length, total };
}

function describeUnion(rows: FlaggedItemRow[]): string {
  return rows.map(r => `${r.id} ${r.name} (${r.route})`).join("\n  ");
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Targets: ${TARGETS.join(", ")}\n`);

  const { data: targetRows, error: targetError } = await supabase
    .from("purchased_items")
    .select("id, name, is_non_inventory, base_ingredient_id, item_category_id")
    .in("id", TARGETS);
  if (targetError) throw new Error(`Read targets failed: ${targetError.message}`);
  if (!targetRows || targetRows.length !== TARGETS.length) {
    throw new Error(`Expected ${TARGETS.length} rows, found ${targetRows?.length ?? 0}. Stop.`);
  }

  console.log("Current state of the two targets:");
  console.table(targetRows.map((r: any) => ({ id: r.id, name: r.name, is_non_inventory: r.is_non_inventory })));

  const already = targetRows.filter((r: any) => r.is_non_inventory === true);
  const toWrite = targetRows.filter((r: any) => r.is_non_inventory !== true);
  if (already.length > 0) {
    console.log(`\nAlready true, no write needed: ${already.map((r: any) => r.id).join(", ")}`);
  }

  console.log("\n=== Neutrality check, BEFORE ===");
  const before = await readFlaggedUnion(supabase);
  console.log(`Additive union: ${before.length} items\n  ${describeUnion(before)}`);

  const khoaiLangBefore = await readKhoaiLangTotal(supabase);
  console.log(`\nSPM-052 completed-purchase total (BEFORE): ${khoaiLangBefore.lineCount} lines, ${khoaiLangBefore.total.toLocaleString("vi-VN")}đ`);

  if (toWrite.length === 0) {
    console.log("\nNothing to write -- both targets already flagged. Stop.");
    return;
  }

  console.log(`\nWould set is_non_inventory = true on: ${toWrite.map((r: any) => r.id).join(", ")}`);

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write this change.");
    return;
  }

  for (const row of toWrite) {
    const { data: updated, error: updateError } = await supabase
      .from("purchased_items")
      .update({ is_non_inventory: true })
      .eq("id", row.id)
      .select("id, name, is_non_inventory")
      .maybeSingle();
    if (updateError) throw new Error(`Update ${row.id} failed: ${updateError.message}`);
    console.log(`Updated: ${JSON.stringify(updated)}`);
  }

  console.log("\n=== Neutrality check, AFTER ===");
  const after = await readFlaggedUnion(supabase);
  console.log(`Additive union: ${after.length} items\n  ${describeUnion(after)}`);

  const beforeIds = new Set(before.map(r => r.id));
  const afterIds = new Set(after.map(r => r.id));
  const sameIds = before.length === after.length && [...beforeIds].every(id => afterIds.has(id));
  console.log(`\nSame ${before.length} ids before and after: ${sameIds ? "YES" : "NO -- MISMATCH, investigate"}`);
  if (!sameIds) {
    console.log("TASK FAILED VERIFICATION -- the write changed who is excluded from stocktake, not just where the flag lives.");
    process.exitCode = 1;
    return;
  }

  const khoaiLangAfter = await readKhoaiLangTotal(supabase);
  console.log(`\nSPM-052 completed-purchase total (AFTER): ${khoaiLangAfter.lineCount} lines, ${khoaiLangAfter.total.toLocaleString("vi-VN")}đ`);
  const totalUnchanged = khoaiLangAfter.lineCount === khoaiLangBefore.lineCount && khoaiLangAfter.total === khoaiLangBefore.total;
  console.log(`Unchanged from BEFORE: ${totalUnchanged ? "YES" : "NO -- MISMATCH, investigate"}`);
  if (!totalUnchanged) {
    console.log("TASK FAILED VERIFICATION -- this write must not touch purchase data or its total.");
    process.exitCode = 1;
    return;
  }

  const { data: verifyRows, error: verifyError } = await supabase
    .from("purchased_items")
    .select("id, name, is_non_inventory")
    .in("id", TARGETS);
  if (verifyError) throw new Error(`Verify failed: ${verifyError.message}`);
  const allTrue = (verifyRows ?? []).every((r: any) => r.is_non_inventory === true);
  console.log(`\nRe-read confirms both targets are now is_non_inventory = true: ${allTrue ? "YES" : "NO"}`);
  if (!allTrue) {
    console.log("TASK FAILED VERIFICATION -- do not treat as done.");
    process.exitCode = 1;
    return;
  }

  console.log("\nAll post-write checks passed.");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
