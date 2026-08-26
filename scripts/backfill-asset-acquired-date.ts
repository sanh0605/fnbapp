import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * OPEN-ITEMS 64 (docs/superpowers/plans/2026-08-27-asset-acquired-date-off-by-one.md
 * section 5). Recomputes every asset's `acquired_date` from its purchase
 * order's real Saigon date -- the code fix (app/admin/inventory/
 * purchase-orders/actions.ts) only prevents new assets from being dated
 * one day early; it does not correct the 82 already written that way.
 *
 * Triggers on `assets` (checked via migration DDL, 0069_batch3_asset_
 * register.sql, since a live pg_get_triggerdef query is unavailable in
 * this environment): exactly one, trg_assets_touch, BEFORE UPDATE,
 * touch_updated_at() -- stamps updated_at, nothing else, no queue, no
 * cascade. `asset_disposals` carries no trigger at all, and (queried live
 * 2026-08-27) currently holds 0 rows, so there is nothing there to move.
 *
 * TS-009 and TS-010's purchase_order_line_id does not resolve to any real
 * Purchase_Order_Lines row (OPEN-ITEMS 65) -- the join below cannot reach
 * them, and this script does not invent a date for them. Their current
 * acquired_date (2026-04-03) is very likely wrong by the same one-day
 * defect (their source order, PO-098, has a real Saigon date of
 * 2026-04-04), but that is a guess about two hand-entered rows with no
 * real line to verify against, not something this mechanical backfill
 * should silently correct.
 *
 * Dry-run by default; --apply writes for real.
 */

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { findAll, update } = await import("@/lib/sheets_db");
  const { buildAssetSchedule } = await import("@/lib/asset-depreciation");

  console.log(`=== backfill-asset-acquired-date.ts (${apply ? "APPLY" : "DRY RUN"}) ===\n`);

  const [assets, lines, orders] = await Promise.all([
    findAll("assets"), findAll("Purchase_Order_Lines"), findAll("Purchase_Orders"),
  ]) as any[][];

  console.log(`assets: ${assets.length} rows`);
  const sumTotalCostBefore = assets.reduce((s: number, a: any) => s + Number(a.total_cost), 0);
  console.log(`sum(total_cost): ${sumTotalCostBefore.toLocaleString("vi-VN")}d`);

  const purchaseOrdersSum = orders.reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);
  console.log(`Purchase_Orders sum(total_amount): ${purchaseOrdersSum.toLocaleString("vi-VN")}d\n`);

  const lineById = new Map(lines.map((l: any) => [l.id, l]));
  const orderById = new Map(orders.map((o: any) => [o.id, o]));

  const unresolvable: string[] = [];
  const candidates: Array<{ id: string; name: string; from: string; to: string; total_cost: number; term_months: number }> = [];
  let alreadyCorrect = 0;

  for (const a of assets) {
    const line = lineById.get(a.purchase_order_line_id);
    const order = line ? orderById.get(line.purchase_order_id) : null;
    if (!line || !order) { unresolvable.push(a.id); continue; }

    const correctDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(order.transaction_date));

    if (a.acquired_date === correctDate) { alreadyCorrect++; continue; }
    candidates.push({
      id: a.id, name: a.name_snapshot, from: a.acquired_date, to: correctDate,
      total_cost: Number(a.total_cost), term_months: Number(a.term_months),
    });
  }

  console.log(`Resolvable via a real order: ${assets.length - unresolvable.length}`);
  console.log(`Unresolvable (purchase_order_line_id does not exist): ${unresolvable.join(", ") || "none"}`);
  console.log(`Already correct: ${alreadyCorrect}`);
  console.log(`To correct: ${candidates.length}\n`);

  const monthMovers = candidates.filter(c => c.from.slice(0, 7) !== c.to.slice(0, 7));
  console.log(`Month-crossing corrections: ${monthMovers.length}`);
  for (const m of monthMovers) {
    console.log(`  ${m.id} ${m.name}: ${m.from} -> ${m.to} (${m.from.slice(0, 7)} -> ${m.to.slice(0, 7)})`);
  }
  const sameMonth = candidates.length - monthMovers.length;
  console.log(`Same-month corrections (date moves, no schedule changes): ${sameMonth}\n`);

  // Depreciation-per-month impact of the month-crossers, as of the current
  // Saigon month -- the same computation used to independently verify the
  // plan's own 72.728d claim.
  const nowMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  let misreportedTotal = 0;
  for (const m of monthMovers) {
    const wrongSchedule = buildAssetSchedule({ acquired_date: m.from, total_cost: m.total_cost, quantity: 1, term_months: m.term_months }, []);
    // quantity doesn't affect the schedule's charge amounts (only total_cost
    // and term_months do -- see lib/asset-depreciation.ts), so a placeholder
    // quantity of 1 is safe here; only the month labels and charge amounts matter.
    const correctSchedule = buildAssetSchedule({ acquired_date: m.to, total_cost: m.total_cost, quantity: 1, term_months: m.term_months }, []);
    const correctMonths = new Set(correctSchedule.map(x => x.month));
    const misreported = wrongSchedule.filter(x => x.month <= nowMonth && !correctMonths.has(x.month));
    misreportedTotal += misreported.reduce((s, x) => s + x.charge, 0);
  }
  console.log(`Depreciation currently sitting in the wrong month (as of ${nowMonth}): ${misreportedTotal.toLocaleString("vi-VN")}d\n`);

  if (!apply) {
    console.log("=== DRY RUN ONLY -- nothing written. Pass --apply to write for real. ===");
    return;
  }

  console.log("=== APPLYING ===");
  let updated = 0;
  for (const c of candidates) {
    await update("assets", c.id, { acquired_date: c.to });
    updated++;
  }
  console.log(`Updated ${updated} rows.`);

  // Re-read and confirm.
  const after = (await findAll("assets")) as any[];
  console.log(`\nassets after: ${after.length} rows`);
  const sumTotalCostAfter = after.reduce((s: number, a: any) => s + Number(a.total_cost), 0);
  console.log(`sum(total_cost) after: ${sumTotalCostAfter.toLocaleString("vi-VN")}d (before: ${sumTotalCostBefore.toLocaleString("vi-VN")}d)`);

  let stillWrong = 0;
  for (const a of after) {
    const line = lineById.get(a.purchase_order_line_id);
    const order = line ? orderById.get(line.purchase_order_id) : null;
    if (!line || !order) continue;
    const correctDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(order.transaction_date));
    if (a.acquired_date !== correctDate) stillWrong++;
  }
  console.log(`Rows still not matching their order's Saigon date: ${stillWrong}`);
}

main().catch(e => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
